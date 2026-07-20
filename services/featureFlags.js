/**
 * Effective feature-flag resolution.
 *
 * Effective flags = code DEFAULT_FLAGS merged with the operator's sparse
 * overrides stored in `platformconfigs._id:"features"` (same raw-collection
 * pattern as utils/webPush.js). Overrides win; only registry-known, type-valid
 * keys are honoured, so adding a flag to the registry later automatically picks
 * up its default with no migration, and a removed flag's stale override goes
 * inert.
 *
 * A 30s per-process cache keeps this cheap on hot paths; flag edits are rare and
 * converge across dynos within the TTL. On any DB error we fail CLOSED to the
 * defaults (the restrictive posture) — the correct failure direction.
 */
import mongoose from "mongoose";
import {
  DEFAULT_FLAGS,
  FEATURE_REGISTRY,
  getFlagDef,
} from "../config/featureFlags.js";
import { APIError } from "../middlewares/errorHandler.js";
import logger from "../utils/logger.js";

const CONFIG_ID = "features";
const CACHE_TTL_MS = 30_000;

let cache = { flags: null, at: 0 };

function col() {
  return mongoose.connection?.db?.collection("platformconfigs") || null;
}

/**
 * Read the stored overrides into a plain `{ key: value }` map.
 *
 * Overrides are stored as an ARRAY of `{ k, v }` pairs, NOT an object keyed by
 * the flag id. Flag keys contain dots (e.g. "payments.methods"), and a dot in a
 * field NAME is both mangled by express-mongo-sanitize on the way in and
 * mis-parsed as a nested path by a dot-path `$set`. Keeping the id as a VALUE
 * sidesteps both. A legacy object form is still tolerated on read.
 */
function overridesToMap(raw) {
  const map = {};
  if (Array.isArray(raw)) {
    for (const it of raw) {
      if (it && typeof it.k === "string") map[it.k] = it.v;
    }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) map[k] = v; // legacy form
  }
  return map;
}

/** Coerce a raw override value to the registry-declared type, or return
 *  undefined when it's invalid (so the default is used instead). */
function coerceOverride(def, value) {
  if (def.type === "boolean") {
    return typeof value === "boolean" ? value : undefined;
  }
  if (def.type === "stringList") {
    if (!Array.isArray(value)) return undefined;
    const cleaned = value
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }
  return undefined;
}

/**
 * The effective flags map. `options` is reserved for a future per-tenant merge
 * (v2) — accepted and ignored in v1.
 */
export async function getEffectiveFlags(/* options */) {
  if (cache.flags && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.flags;
  }
  const flags = { ...DEFAULT_FLAGS };
  try {
    const c = col();
    if (c) {
      const doc = await c.findOne({ _id: CONFIG_ID });
      const overrides = overridesToMap(doc?.overrides);
      for (const [key, raw] of Object.entries(overrides)) {
        const def = getFlagDef(key);
        if (!def) continue; // unknown / removed flag → ignore
        const coerced = coerceOverride(def, raw);
        if (coerced !== undefined) flags[key] = coerced;
      }
    }
    cache = { flags, at: Date.now() };
    return flags;
  } catch (err) {
    logger.error("featureFlags: failed to load overrides; using defaults", {
      error: err?.message,
    });
    return cache.flags || flags;
  }
}

/** True when a boolean flag is enabled. */
export async function isFeatureEnabled(key) {
  const flags = await getEffectiveFlags();
  return flags[key] === true;
}

/**
 * The theme slugs the catalog/picker/install is restricted to, or `null` when
 * the full catalog is enabled (unrestricted).
 */
export async function getAllowedThemeSlugs() {
  const flags = await getEffectiveFlags();
  if (flags["themes.catalogAll"]) return null;
  const slugs = flags["themes.allowedSlugs"];
  return Array.isArray(slugs) ? slugs : [];
}

/**
 * Persist operator flag overrides. Validates every key against the registry and
 * every value against its declared type; rejects unknown keys with a 400.
 * Returns the fresh effective flags.
 */
export async function setFeatureOverrides(updates, updatedBy) {
  // Accept either an array of { key, value } (the API contract — flag ids ride
  // as VALUES so express-mongo-sanitize can't mangle the dots) or a plain
  // object map (back-compat / internal callers).
  const list = Array.isArray(updates)
    ? updates
    : Object.entries(updates || {}).map(([key, value]) => ({ key, value }));
  if (!list.length) throw new APIError("No feature updates provided", 400);

  const c = col();
  if (!c) throw new APIError("Platform config store unavailable", 503);

  const doc = await c.findOne({ _id: CONFIG_ID });
  const current = overridesToMap(doc?.overrides);
  for (const { key, value } of list) {
    const def = getFlagDef(key);
    if (!def) throw new APIError(`Unknown feature flag: ${key}`, 400);
    const coerced = coerceOverride(def, value);
    if (coerced === undefined) {
      throw new APIError(`Invalid value for feature flag: ${key}`, 400);
    }
    current[key] = coerced;
  }

  // Store as an array of { k, v } pairs so no DB field name ever contains a dot
  // (see overridesToMap).
  const stored = Object.entries(current).map(([k, v]) => ({ k, v }));
  await c.updateOne(
    { _id: CONFIG_ID },
    { $set: { overrides: stored, updatedAt: new Date(), updatedBy: updatedBy || null } },
    { upsert: true }
  );
  invalidateFeatureFlagCache();
  return getEffectiveFlags();
}

export function invalidateFeatureFlagCache() {
  cache = { flags: null, at: 0 };
}
