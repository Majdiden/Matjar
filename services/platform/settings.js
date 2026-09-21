/**
 * Effective platform settings (global configuration registry).
 *
 * Effective = registry defaults merged with operator overrides stored in
 * `platformconfigs._id:"settings"` as `[{ k, v }]` (ids as VALUES — same
 * reason as feature flags: express-mongo-sanitize mangles dotted keys).
 * Every stored value is re-validated on read; an invalid one is IGNORED
 * (default wins) and logged, so a bad row can never break a consumer.
 *
 * 30 s per-process cache (writes invalidate locally; other processes
 * converge within the TTL). `getSettingSync()` serves the last loaded value
 * for hot synchronous paths (the multer file filter) and falls back to the
 * default before the first load.
 */
import mongoose from "mongoose";
import {
  PLATFORM_SETTINGS_REGISTRY,
  DEFAULT_SETTINGS,
  getSettingDef,
} from "../../config/platformSettingsRegistry.js";
import { APIError } from "../../middlewares/errorHandler.js";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

const CONFIG_ID = "settings";
const CACHE_TTL_MS = 30_000;

let cache = { values: null, at: 0 };
// Single in-flight refresh so a stale cache under load triggers ONE query.
let inflight = null;

const MB = 1024 * 1024;

function col() {
  // readyState 1 = connected. Before that we must not cache defaults, or the
  // first 30 s after boot would ignore every stored override.
  if (mongoose.connection?.readyState !== 1) return null;
  return mongoose.connection.db.collection("platformconfigs");
}

/**
 * Coerce + validate a raw value for a registry entry. Returns the clean
 * value, or `undefined` when invalid (callers decide: ignore on read, 400
 * on write). Pure — unit-tested.
 */
export function coerceSetting(def, raw) {
  if (!def || !def.editable) return undefined;
  const b = def.bounds || {};
  if (def.type === "integer") {
    const n = Number(raw);
    if (!Number.isInteger(n)) return undefined;
    if (b.min != null && n < b.min) return undefined;
    if (b.max != null && n > b.max) return undefined;
    return n;
  }
  if (def.type === "stringList") {
    if (!Array.isArray(raw)) return undefined;
    const cleaned = Array.from(new Set(raw.map((v) => String(v || "").trim()).filter(Boolean)));
    if (b.min != null && cleaned.length < b.min) return undefined;
    if (b.max != null && cleaned.length > b.max) return undefined;
    if (b.allowlist && cleaned.some((v) => !b.allowlist.includes(v))) return undefined;
    return cleaned;
  }
  return undefined;
}

function overridesToMap(raw) {
  const map = {};
  if (Array.isArray(raw)) for (const it of raw) if (it && typeof it.k === "string") map[it.k] = it.v;
  return map;
}

/** Effective map `{ key: value }` for every registry entry. */
export async function getEffectiveSettings() {
  if (cache.values && Date.now() - cache.at < CACHE_TTL_MS) return cache.values;
  if (inflight) return inflight;
  inflight = (async () => {
    const values = { ...DEFAULT_SETTINGS };
    try {
      const c = col();
      if (!c) return cache.values || values; // not connected yet: serve, don't cache
      const doc = await c.findOne({ _id: CONFIG_ID });
      for (const [key, raw] of Object.entries(overridesToMap(doc?.overrides))) {
        const def = getSettingDef(key);
        if (!def || !def.editable) continue;
        const clean = coerceSetting(def, raw);
        if (clean === undefined) {
          logger.warn("platformSettings: ignoring invalid stored value", { key });
          continue;
        }
        values[key] = clean;
      }
      cache = { values, at: Date.now() };
      return values;
    } catch (err) {
      logger.error("platformSettings: failed to load overrides; using defaults", { error: err?.message });
      return cache.values || values;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getSetting(key) {
  const def = getSettingDef(key);
  if (!def) throw new Error(`Unknown platform setting: ${key}`);
  const values = await getEffectiveSettings();
  return values[key];
}

/**
 * Synchronous read for hot paths. Serves the cached map (refreshing in the
 * background when stale) and the registry default before the first load.
 */
export function getSettingSync(key) {
  const def = getSettingDef(key);
  if (!def) throw new Error(`Unknown platform setting: ${key}`);
  if (!cache.values || Date.now() - cache.at >= CACHE_TTL_MS) {
    getEffectiveSettings().catch(() => {});
  }
  return cache.values?.[key] ?? DEFAULT_SETTINGS[key];
}

/**
 * Registry + effective values + which keys carry an override, for the
 * admin page.
 */
export async function describeSettings() {
  const values = await getEffectiveSettings();
  let stored = {};
  try {
    const c = col();
    if (c) stored = overridesToMap((await c.findOne({ _id: CONFIG_ID }))?.overrides);
  } catch {
    /* fall through — page still renders effective values */
  }
  // Upload knobs can never exceed the process ceilings (multer limits fixed
  // at boot): surface the ENFORCED value and clamp the editable range so the
  // page never shows a number larger than what actually applies.
  const { ceilingMB, ceilingFiles } = processCeilings();
  return PLATFORM_SETTINGS_REGISTRY.map((def) => {
    let bounds = def.bounds || null;
    let value = values[def.key];
    if (def.key === "uploads.maxFileSizeMB") {
      bounds = { ...bounds, max: Math.min(bounds.max, ceilingMB) };
      value = Math.min(value, ceilingMB);
    } else if (def.key === "uploads.maxFilesPerUpload") {
      bounds = { ...bounds, max: Math.min(bounds.max, ceilingFiles) };
      value = Math.min(value, ceilingFiles);
    }
    return {
      key: def.key,
      group: def.group,
      label: def.label,
      description: def.description,
      type: def.type,
      editable: def.editable,
      default: def.default,
      bounds,
      value,
      overridden: def.editable && stored[def.key] !== undefined && coerceSetting(def, stored[def.key]) !== undefined,
    };
  });
}

/**
 * Persist operator overrides. `updates` = [{ key, value }] (value `null`
 * clears the override). Unknown/non-editable keys and out-of-bounds values
 * → 400. Returns `{ before, after }` maps of the changed keys for auditing.
 */
/** Process-level upload ceilings (multer limits fixed at boot). */
export function processCeilings() {
  return {
    ceilingMB: Math.max(1, Math.floor(config.maxFileSize / MB)),
    ceilingFiles: Math.max(1, config.maxFilesPerUpload),
  };
}

// Upload knobs are capped by the process ceilings at write time so the stored
// override never exceeds what is actually enforced.
const UPLOAD_CEILINGS = {
  "uploads.maxFileSizeMB": (c) => ({ max: c.ceilingMB, unit: "MB" }),
  "uploads.maxFilesPerUpload": (c) => ({ max: c.ceilingFiles, unit: "files" }),
};

export async function setSettings(updates, updatedBy) {
  const list = Array.isArray(updates) ? updates : [];
  if (!list.length) throw new APIError("No settings provided", 400);
  const c = col();
  if (!c) throw new APIError("Platform config store unavailable", 503);

  const doc = await c.findOne({ _id: CONFIG_ID });
  const current = overridesToMap(doc?.overrides);
  const effectiveBefore = await getEffectiveSettings();
  const before = {};
  const after = {};

  for (const { key, value } of list) {
    const def = getSettingDef(key);
    if (!def) throw new APIError(`Unknown setting: ${key}`, 400);
    if (!def.editable) throw new APIError(`Setting is not editable: ${key}`, 400);
    before[key] = effectiveBefore[key];
    if (value === null) {
      delete current[key];
      after[key] = def.default;
      continue;
    }
    const clean = coerceSetting(def, value);
    if (clean === undefined) {
      const b = def.bounds || {};
      const hint =
        def.type === "integer"
          ? `integer between ${b.min} and ${b.max}`
          : `list of ${b.min ?? 1}+ values from the allow-list`;
      throw new APIError(`Invalid value for ${key} (expected ${hint})`, 400);
    }
    const ceiling = UPLOAD_CEILINGS[key]?.(processCeilings());
    if (ceiling && clean > ceiling.max) {
      throw new APIError(
        `${key} cannot exceed the process ceiling of ${ceiling.max} ${ceiling.unit}`,
        400
      );
    }
    current[key] = clean;
    after[key] = clean;
  }

  const stored = Object.entries(current).map(([k, v]) => ({ k, v }));
  await c.updateOne(
    { _id: CONFIG_ID },
    { $set: { overrides: stored, updatedAt: new Date(), updatedBy: updatedBy || null } },
    { upsert: true }
  );
  invalidatePlatformSettingsCache();
  return { before, after };
}

export function invalidatePlatformSettingsCache() {
  cache = { values: null, at: 0 };
}
