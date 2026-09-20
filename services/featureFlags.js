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
  tenantCache.clear();
}

// ---------------------------------------------------------------------------
// Per-tenant layered resolution (Phase B)
//
// Ladder, lowest to highest precedence:
//   1. registry default
//   2. global operator override            (platformconfigs "features")
//   3. plan entitlement                     (plan.entitlements ∋ key → true)
//   4. ACTIVE access-program overrides      (membership order; later wins)
//   5. tenant override                      (FeatureOverride, live + unexpired)
//
// Only BOOLEAN flags participate in layers 3–5 — a stringList flag
// (themes.allowedSlugs) is global only. `resolveTenantLayers` is pure so the
// ladder is unit-testable without a DB; `resolveTenantFeatures` loads the
// inputs and caches the result per tenant for 30s (invalidated on writes).
// ---------------------------------------------------------------------------

const TENANT_CACHE_TTL_MS = 30_000;
const TENANT_CACHE_MAX = 5000;
const tenantCache = new Map(); // tenantId → { at, result }

/** True when a program applies right now (active + inside its window).
 *  Boundaries: startsAt === now → active; endsAt === now → inactive. */
export function isProgramActive(program, at = new Date()) {
  if (!program || program.status !== "active") return false;
  if (program.startsAt && new Date(program.startsAt) > at) return false;
  if (program.endsAt && new Date(program.endsAt) <= at) return false;
  return true;
}

/** Pure: keep only ACTIVE programs, preserving the tenant's membership order. */
export function selectActivePrograms(membershipKeys = [], programs = [], at = new Date()) {
  const byKey = new Map((programs || []).map((p) => [p.key, p]));
  return (membershipKeys || []).map((k) => byKey.get(k)).filter((p) => isProgramActive(p, at));
}

/** Pure: keep only live (unrevoked, unexpired) overrides. */
export function selectLiveOverrides(overrides = [], at = new Date()) {
  return (overrides || []).filter((o) => o && !o.revokedAt && (!o.endsAt || new Date(o.endsAt) > at));
}

/**
 * Pure ladder.
 * @param {object} args
 * @param {object} args.globalFlags   effective global flags (getEffectiveFlags)
 * @param {string[]} [args.entitlements]   plan.entitlements
 * @param {Array<{key:string, featureOverrides:Array<{k,v}>}>} [args.programs]  ACTIVE programs, in membership order
 * @param {Array<{key:string, value:boolean}>} [args.tenantOverrides]  live tenant overrides
 * @returns {{ flags: object, layers: object }}
 */
export function resolveTenantLayers({ globalFlags, entitlements = [], programs = [], tenantOverrides = [] }) {
  const flags = {};
  const layers = {};
  const ent = new Set((entitlements || []).map((k) => String(k)));

  for (const def of FEATURE_REGISTRY) {
    const key = def.key;
    const def0 = DEFAULT_FLAGS[key];
    const globalVal = globalFlags && globalFlags[key] !== undefined ? globalFlags[key] : def0;
    // Non-boolean flags: global only.
    if (def.type !== "boolean") {
      flags[key] = globalVal;
      layers[key] = { default: def0, global: globalVal, plan: null, program: null, tenant: null, effective: globalVal, source: "global" };
      continue;
    }
    let effective = globalVal === true;
    let source = globalFlags && globalFlags[key] !== undefined && globalFlags[key] !== def0 ? "global" : "default";
    let planVal = null;
    if (ent.has(key)) {
      planVal = true;
      effective = true;
      source = "plan";
    }
    let programVal = null;
    let programKey = null;
    for (const p of programs || []) {
      const hit = (p?.featureOverrides || []).find((o) => o && o.k === key && typeof o.v === "boolean");
      if (hit) {
        programVal = hit.v;
        programKey = p.key;
      }
    }
    if (programVal !== null) {
      effective = programVal;
      source = "program";
    }
    let tenantVal = null;
    const t = (tenantOverrides || []).find((o) => o && o.key === key && typeof o.value === "boolean");
    if (t) {
      tenantVal = t.value;
      effective = tenantVal;
      source = "tenant";
    }
    flags[key] = effective;
    layers[key] = {
      default: def0,
      global: globalVal === true,
      plan: planVal,
      program: programVal,
      programKey,
      tenant: tenantVal,
      effective,
      source,
    };
  }
  return { flags, layers };
}

/** Live (unrevoked, unexpired) tenant overrides, NEWEST first — the ladder
 *  picks the first match per key, so the most recent override wins. */
export async function findLiveTenantOverrides(tenantId, at = new Date()) {
  const FeatureOverride = mongoose.model("FeatureOverride");
  return FeatureOverride.find({
    scope: "tenant",
    scopeId: tenantId,
    revokedAt: null,
    $or: [{ endsAt: null }, { endsAt: { $gt: at } }],
  })
    .sort({ createdAt: -1 })
    .lean();
}

/** ACTIVE programs the tenant belongs to, in the tenant's membership order. */
export async function findActiveProgramsFor(tenant, at = new Date()) {
  const keys = Array.isArray(tenant?.accessPrograms) ? tenant.accessPrograms : [];
  if (!keys.length) return [];
  const AccessProgram = mongoose.model("AccessProgram");
  const rows = await AccessProgram.find({ key: { $in: keys } }).lean();
  return selectActivePrograms(keys, rows, at);
}

/**
 * Effective flags + per-flag layers for one tenant.
 *
 * Failure mode (deliberate, bounded): if loading any lower layer fails (DB
 * blip), the result collapses to the GLOBAL layer for this call only — it is
 * not cached, so the next call retries. Consequence: a tenant-level OFF
 * override (or a program forcing OFF) is NOT enforced during the blip; the
 * global value is. This is fail-closed relative to the global posture, but not
 * relative to a store-specific restriction. Acceptable for feature flags; do
 * not use this resolver for security decisions.
 *
 * @param {object} tenant  lean Tenant (needs _id, subscriptionPlan, accessPrograms)
 * @param {object} [opts]  { at?: Date, fresh?: boolean }
 */
export async function resolveTenantFeatures(tenant, opts = {}) {
  const id = tenant?._id ? String(tenant._id) : null;
  const at = opts.at || new Date();
  if (id && !opts.fresh) {
    const hit = tenantCache.get(id);
    if (hit && Date.now() - hit.at < TENANT_CACHE_TTL_MS) return hit.result;
  }
  const globalFlags = await getEffectiveFlags();
  let entitlements = [];
  let programs = [];
  let tenantOverrides = [];
  try {
    if (tenant?.subscriptionPlan) {
      const SubscriptionPlan = mongoose.model("SubscriptionPlan");
      const plan = await SubscriptionPlan.findOne({ key: String(tenant.subscriptionPlan).toLowerCase() })
        .select("entitlements")
        .lean();
      entitlements = plan?.entitlements || [];
    }
    programs = await findActiveProgramsFor(tenant, at);
    if (id) tenantOverrides = await findLiveTenantOverrides(tenant._id, at);
  } catch (err) {
    // Fail closed to the global layer (the restrictive posture): a partial
    // load must never turn a flag ON, and must never be cached.
    logger.error("featureFlags: tenant layer load failed; using global flags", { tenantId: id, error: err?.message });
    return resolveTenantLayers({ globalFlags, entitlements: [], programs: [], tenantOverrides: [] });
  }
  const result = resolveTenantLayers({ globalFlags, entitlements, programs, tenantOverrides });
  if (id) {
    if (tenantCache.size >= TENANT_CACHE_MAX) tenantCache.clear();
    tenantCache.set(id, { at: Date.now(), result });
  }
  return result;
}

/**
 * Tenant-aware boolean check for gates. Uses the layered resolution when a
 * tenant is in scope, else the global flag. Callers pass the lean tenant doc
 * (needs _id, subscriptionPlan, accessPrograms).
 */
export async function isFeatureEnabledFor(tenant, key) {
  if (!tenant?._id) return isFeatureEnabled(key);
  const { flags } = await resolveTenantFeatures(tenant);
  return flags[key] === true;
}

/** Same as isFeatureEnabledFor but from a bare tenant id (loads the lean doc). */
export async function isFeatureEnabledForTenantId(tenantId, key) {
  if (!tenantId) return isFeatureEnabled(key);
  const hit = tenantCache.get(String(tenantId));
  if (hit && Date.now() - hit.at < TENANT_CACHE_TTL_MS) return hit.result.flags[key] === true;
  const tenant = await mongoose.model("Tenant").findById(tenantId).select("subscriptionPlan accessPrograms").lean();
  return isFeatureEnabledFor(tenant, key);
}

/**
 * Drop the cached resolution for one tenant (or all when omitted). Call after
 * any write that changes a layer input (plan entitlements, program state or
 * membership, tenant overrides, tenant.subscriptionPlan). The cache is
 * per-process; across dynos the 30s TTL is the convergence bound.
 */
export function invalidateTenantFeatureCache(tenantId) {
  if (tenantId == null) tenantCache.clear();
  else tenantCache.delete(String(tenantId));
}
