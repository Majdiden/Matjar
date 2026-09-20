/**
 * Usage snapshots + effective limits (Phase B, no enforcement).
 *
 * Limits ladder (lowest → highest precedence):
 *   platform default (null = unlimited) → plan.limits → active program
 *   limitOverrides (membership order, later wins) → tenant.limitOverrides.
 *
 * Snapshots are computed from the tenant-scoped collections through
 * createScopedModels so nothing crosses tenants.
 */
import mongoose from "mongoose";
import { APIError } from "../../middlewares/errorHandler.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { findActiveProgramsFor } from "../featureFlags.js";
import logger from "../../utils/logger.js";

import { LIMIT_KEYS } from "../../config/limits.js";
export { LIMIT_KEYS };
export const USAGE_BY_LIMIT = Object.freeze({
  maxProducts: "products",
  maxStaff: "staff",
  maxOrdersPerMonth: "ordersThisMonth",
  maxStorageMB: "storageMB",
});
const STAFF_ROLES = ["admin", "manager", "staff"];

function Tenant() {
  return mongoose.model("Tenant");
}
function Snapshot() {
  return mongoose.model("TenantUsageSnapshot");
}

/** Pure: resolve every limit with its source. */
export function resolveLimitLayers({ planLimits = {}, programs = [], tenantOverrides = {} }) {
  const out = {};
  for (const k of LIMIT_KEYS) {
    const plan = planLimits?.[k] ?? null;
    let program = null;
    let programKey = null;
    for (const p of programs || []) {
      const v = p?.limitOverrides?.[k];
      if (v !== null && v !== undefined) {
        program = v;
        programKey = p.key;
      }
    }
    const tenant = tenantOverrides?.[k] ?? null;
    let effective = null;
    let source = "default";
    if (plan !== null) {
      effective = plan;
      source = "plan";
    }
    if (program !== null) {
      effective = program;
      source = "program";
    }
    if (tenant !== null) {
      effective = tenant;
      source = "tenant";
    }
    out[k] = { default: null, plan, program, programKey, tenant, effective, source };
  }
  return out;
}

export async function resolveEffectiveLimits(tenant) {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const plan = tenant?.subscriptionPlan
    ? await SubscriptionPlan.findOne({ key: String(tenant.subscriptionPlan).toLowerCase() }).select("limits").lean()
    : null;
  const programs = await findActiveProgramsFor(tenant);
  return resolveLimitLayers({
    planLimits: plan?.limits || {},
    programs,
    tenantOverrides: tenant?.limitOverrides || {},
  });
}

/** Compute one snapshot for a tenant (does not persist). */
export async function computeUsage(tenantId) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const safe = async (fn, fallback = 0) => {
    try {
      return await fn();
    } catch (err) {
      logger.warn("usage: metric failed", { tenantId: String(tenantId), error: err?.message });
      return fallback;
    }
  };
  const [products, staff, ordersThisMonth, storage] = await Promise.all([
    safe(() => models.Product.countDocuments({})),
    safe(() => models.User.countDocuments({ roles: { $in: STAFF_ROLES }, isActive: true })),
    safe(() => models.Order.countDocuments({ createdAt: { $gte: monthStart }, status: { $nin: ["Draft"] } })),
    safe(async () => {
      if (!models.Asset) return 0;
      const agg = await models.Asset.aggregate([{ $group: { _id: null, bytes: { $sum: "$bytes" } } }]);
      return Math.round(((agg[0]?.bytes || 0) / (1024 * 1024)) * 100) / 100;
    }),
  ]);
  return { products, staff, ordersThisMonth, storageMB: storage, apiRequestsToday: null };
}

export async function snapshotTenant(tenantId, source = "job") {
  const t = await Tenant().findById(tenantId).select("deletedAt").lean();
  if (!t || t.deletedAt) throw new APIError("Tenant not found", 404);
  const usage = await computeUsage(tenantId);
  const doc = await Snapshot().create({ tenantId, at: new Date(), ...usage, source });
  return doc.toObject();
}

/**
 * Nightly: snapshot every non-deleted tenant with ONE $group per shared
 * collection (products / users / orders / assets) and a single insertMany,
 * instead of 4 queries × N tenants. Tenants absent from a group get 0.
 */
export async function snapshotAllTenants() {
  const tenants = await Tenant().find({ deletedAt: null }).select("_id").lean();
  const ids = tenants.map((t) => t._id);
  if (!ids.length) return { tenants: 0, ok: 0, errors: [] };
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const byTenant = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
  const errors = [];
  const safeAgg = async (name, model, pipeline) => {
    try {
      return byTenant(await mongoose.model(model).aggregate([{ $match: { tenantId: { $in: ids } } }, ...pipeline]));
    } catch (err) {
      errors.push({ metric: name, error: err?.message });
      return new Map();
    }
  };
  const [products, staff, orders, storage] = await Promise.all([
    safeAgg("products", "Product", [{ $group: { _id: "$tenantId", n: { $sum: 1 } } }]),
    safeAgg("staff", "User", [{ $match: { roles: { $in: STAFF_ROLES }, isActive: true } }, { $group: { _id: "$tenantId", n: { $sum: 1 } } }]),
    safeAgg("orders", "Order", [{ $match: { createdAt: { $gte: monthStart }, status: { $nin: ["Draft"] } } }, { $group: { _id: "$tenantId", n: { $sum: 1 } } }]),
    safeAgg("storage", "Asset", [{ $group: { _id: "$tenantId", n: { $sum: "$bytes" } } }]),
  ]);
  const docs = ids.map((id) => {
    const k = String(id);
    return {
      tenantId: id,
      at: now,
      products: products.get(k) || 0,
      staff: staff.get(k) || 0,
      ordersThisMonth: orders.get(k) || 0,
      storageMB: Math.round(((storage.get(k) || 0) / (1024 * 1024)) * 100) / 100,
      apiRequestsToday: null,
      source: "job",
    };
  });
  let ok = 0;
  try {
    const res = await Snapshot().insertMany(docs, { ordered: false });
    ok = res.length;
  } catch (err) {
    ok = err?.insertedDocs?.length || 0;
    errors.push({ metric: "insert", error: err?.message });
  }
  return { tenants: ids.length, ok, errors };
}

/** Latest operator-taken snapshot age check (throttle for on-demand refresh). */
export async function recentOperatorSnapshot(tenantId, withinMs = 60_000) {
  return Snapshot().findOne({ tenantId, source: "operator", at: { $gte: new Date(Date.now() - withinMs) } }).select("at").lean();
}

/** Current usage vs effective limits + 30 recent snapshots. */
export async function getTenantUsage(tenantId) {
  const tenant = await Tenant().findById(tenantId).select("subscriptionPlan accessPrograms limitOverrides limitOverridesReason deletedAt").lean();
  if (!tenant || tenant.deletedAt) throw new APIError("Tenant not found", 404);
  const [limits, history] = await Promise.all([
    resolveEffectiveLimits(tenant),
    Snapshot().find({ tenantId }).sort({ at: -1 }).limit(30).lean(),
  ]);
  const latest = history[0] || null;
  const resources = LIMIT_KEYS.map((k) => {
    const usageKey = USAGE_BY_LIMIT[k];
    const used = latest ? latest[usageKey] : null;
    const limit = limits[k].effective;
    return {
      key: k,
      usageKey,
      used,
      limit,
      source: limits[k].source,
      layers: limits[k],
      pct: used != null && limit ? Math.min(999, Math.round((used / limit) * 100)) : null,
      over: used != null && limit != null && used > limit,
    };
  });
  return {
    tenantId: String(tenantId),
    at: latest?.at || null,
    resources,
    limitOverridesReason: tenant.limitOverridesReason || null,
    history: history.map((h) => ({
      at: h.at,
      products: h.products,
      staff: h.staff,
      ordersThisMonth: h.ordersThisMonth,
      storageMB: h.storageMB,
      source: h.source,
    })),
  };
}

export async function setTenantLimitOverrides(tenantId, limitOverrides, reason) {
  const t = await Tenant().findById(tenantId).select("limitOverrides limitOverridesReason deletedAt").lean();
  if (!t || t.deletedAt) throw new APIError("Tenant not found", 404);
  const before = { ...(t.limitOverrides || {}), reason: t.limitOverridesReason || null };
  const $set = { limitOverridesReason: reason };
  for (const k of LIMIT_KEYS) {
    if (limitOverrides[k] !== undefined) $set[`limitOverrides.${k}`] = limitOverrides[k];
  }
  await Tenant().updateOne({ _id: tenantId }, { $set });
  const fresh = await Tenant().findById(tenantId).select("limitOverrides limitOverridesReason").lean();
  return { before, after: { ...(fresh.limitOverrides || {}), reason: fresh.limitOverridesReason } };
}
