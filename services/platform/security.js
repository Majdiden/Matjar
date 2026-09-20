/**
 * Platform security settings — `platformconfigs._id: "security"`.
 * Same sparse-override + 30 s cache pattern as the billing settings.
 *
 *   requireMfaForRoles: roles that must have MFA enrolled before they can
 *   use the console (platformAuthenticate returns 403 MFA_ENROLLMENT_REQUIRED
 *   until they enrol). Owner-editable only.
 */
import mongoose from "mongoose";
import { APIError } from "../../middlewares/errorHandler.js";
import { isValidRole } from "../../config/platformRoles.js";
import logger from "../../utils/logger.js";

const CONFIG_ID = "security";
const CACHE_TTL_MS = 30_000;

export const DEFAULT_SECURITY_SETTINGS = Object.freeze({
  requireMfaForRoles: [],
});

let cache = { value: null, at: 0 };

function col() {
  return mongoose.connection?.db?.collection("platformconfigs") || null;
}

/**
 * `strict` (API writes): unknown roles are a 400. Non-strict (reads of the
 * stored doc): unknown roles are dropped with a warning, known ones kept —
 * a role renamed later must never silently disable the whole policy.
 */
export function sanitizeSecuritySettings(raw = {}, { strict = false } = {}) {
  const roles = Array.isArray(raw.requireMfaForRoles) ? raw.requireMfaForRoles : DEFAULT_SECURITY_SETTINGS.requireMfaForRoles;
  const cleaned = [...new Set(roles.map((r) => String(r || "").trim().toLowerCase()).filter(Boolean))];
  const known = [];
  for (const r of cleaned) {
    if (isValidRole(r)) known.push(r);
    else if (strict) throw new APIError(`Unknown platform role: ${r}`, 400);
    else logger.warn("securitySettings: ignoring unknown role in requireMfaForRoles", { role: r });
  }
  return { requireMfaForRoles: known };
}

/**
 * FAILS CLOSED: a security policy that cannot be read must not degrade to
 * "no policy". A stale cached value is served if one exists; otherwise the
 * error propagates and the auth middleware rejects the request.
 */
export async function getSecuritySettings() {
  if (cache.value && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  try {
    const c = col();
    if (!c) throw new Error("Platform config store unavailable");
    const doc = await c.findOne({ _id: CONFIG_ID });
    const value = doc ? sanitizeSecuritySettings(doc) : { ...DEFAULT_SECURITY_SETTINGS };
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    logger.error("securitySettings: failed to load", { error: err?.message });
    if (cache.value) return cache.value;
    throw new APIError("Security policy unavailable", 503);
  }
}

export async function setSecuritySettings(patch, updatedBy) {
  const current = await getSecuritySettings();
  const next = sanitizeSecuritySettings({ ...current, ...patch }, { strict: true });
  const c = col();
  if (!c) throw new APIError("Platform config store unavailable", 503);
  await c.updateOne(
    { _id: CONFIG_ID },
    { $set: { ...next, updatedAt: new Date(), updatedBy: updatedBy || null } },
    { upsert: true }
  );
  invalidateSecuritySettingsCache();
  return { before: current, after: next };
}

export function invalidateSecuritySettingsCache() {
  cache = { value: null, at: 0 };
}
