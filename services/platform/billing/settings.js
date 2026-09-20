/**
 * Platform billing settings — stored in `platformconfigs._id:"billing"`
 * (same raw-collection pattern as feature flags / phone countries) with code
 * defaults and a short in-process cache.
 *
 * `enforcement.onOverdue` starts at "none" (decision 5): statements are
 * generated and tracked, nothing blocks a store until the operator says so.
 */
import mongoose from "mongoose";
import { APIError } from "../../../middlewares/errorHandler.js";
import logger from "../../../utils/logger.js";

const CONFIG_ID = "billing";
const CACHE_TTL_MS = 30_000;

export const ENFORCEMENT_MODES = Object.freeze(["none", "warn", "read_only", "suspend"]);

export const DEFAULT_BILLING_SETTINGS = Object.freeze({
  defaultCommissionPolicyKey: null,
  // Plan assigned at signup when the client sends none, an inactive one, or
  // one that is not self-service selectable.
  defaultPlanKey: "trial",
  statementDay: 1, // day of month the period-close cron runs (for the previous period)
  dueDays: 7,
  graceDays: 14,
  enforcement: { onOverdue: "none" },
  // First period the platform bills (YYYY-MM). Set automatically on the first
  // period run when absent; run-period refuses anything earlier (N4).
  billingStartPeriod: null,
});

let cache = { value: null, at: 0 };

function col() {
  return mongoose.connection?.db?.collection("platformconfigs") || null;
}

export function sanitizeBillingSettings(raw = {}) {
  const out = { ...DEFAULT_BILLING_SETTINGS, enforcement: { ...DEFAULT_BILLING_SETTINGS.enforcement } };
  if (raw.defaultCommissionPolicyKey !== undefined) {
    const k = raw.defaultCommissionPolicyKey == null ? null : String(raw.defaultCommissionPolicyKey).toLowerCase().trim();
    out.defaultCommissionPolicyKey = k || null;
  }
  for (const [field, min, max] of [
    ["statementDay", 1, 28],
    ["dueDays", 0, 90],
    ["graceDays", 0, 180],
  ]) {
    if (raw[field] !== undefined) {
      const n = Number(raw[field]);
      if (!Number.isInteger(n) || n < min || n > max) {
        throw new APIError(`${field} must be an integer between ${min} and ${max}`, 400);
      }
      out[field] = n;
    }
  }
  if (raw.defaultPlanKey !== undefined) {
    const k = String(raw.defaultPlanKey || "").toLowerCase().trim();
    if (!/^[a-z0-9][a-z0-9-_]{0,63}$/.test(k)) throw new APIError("defaultPlanKey must be a plan key", 400);
    out.defaultPlanKey = k;
  }
  if (raw.billingStartPeriod !== undefined) {
    const v = raw.billingStartPeriod == null ? null : String(raw.billingStartPeriod);
    if (v !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw new APIError("billingStartPeriod must be YYYY-MM", 400);
    out.billingStartPeriod = v;
  }
  if (raw.enforcement?.onOverdue !== undefined) {
    const mode = String(raw.enforcement.onOverdue);
    if (!ENFORCEMENT_MODES.includes(mode)) throw new APIError("Invalid enforcement.onOverdue", 400);
    out.enforcement.onOverdue = mode;
  }
  return out;
}

export async function getBillingSettings() {
  if (cache.value && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  let value = sanitizeBillingSettings({});
  try {
    const c = col();
    if (c) {
      const doc = await c.findOne({ _id: CONFIG_ID });
      if (doc) value = sanitizeBillingSettings(doc);
    }
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    logger.error("billingSettings: failed to load; using defaults", { error: err?.message });
    return cache.value || value;
  }
}

export async function setBillingSettings(patch, updatedBy) {
  const current = await getBillingSettings();
  const next = sanitizeBillingSettings({ ...current, ...patch, enforcement: { ...current.enforcement, ...(patch?.enforcement || {}) } });
  if (next.defaultCommissionPolicyKey) {
    const exists = await mongoose.model("CommissionPolicy").exists({ key: next.defaultCommissionPolicyKey, isActive: true });
    if (!exists) throw new APIError("defaultCommissionPolicyKey must reference an active commission policy", 400);
  }
  if (patch?.defaultPlanKey !== undefined) {
    const plan = await mongoose.model("SubscriptionPlan").findOne({ key: next.defaultPlanKey }).select("isActive").lean();
    if (!plan || !plan.isActive) throw new APIError("defaultPlanKey must reference an active plan", 400);
  }
  const c = col();
  if (!c) throw new APIError("Platform config store unavailable", 503);
  await c.updateOne(
    { _id: CONFIG_ID },
    { $set: { ...next, updatedAt: new Date(), updatedBy: updatedBy || null } },
    { upsert: true }
  );
  invalidateBillingSettingsCache();
  return { before: current, after: next };
}

export function invalidateBillingSettingsCache() {
  cache = { value: null, at: 0 };
}
