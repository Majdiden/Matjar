/**
 * Subscription plan catalog controllers (platform admin).
 *
 * Plans come in two families the merchant chooses between (see
 * docs/plans/platform-admin-operating-system.md §2): `commission` (no fee,
 * percentage via a CommissionPolicy) and `subscription` (fixed fee, no
 * percentage). `hybrid` is representable but inactive by default.
 *
 * Every mutation writes a platform audit row.
 */
import mongoose from "mongoose";
import { asyncHandler, APIError } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import { validatePlanFamily, planBaseFee, planFamilyOf } from "../../services/platform/billing/resolver.js";
import { schedulePlanChange } from "../../services/platform/billing/planChanges.js";

// Plan keys are stable slugs referenced by tenant.subscriptionPlan.
const PLAN_KEY_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/;
const LIMIT_KEYS = ["maxProducts", "maxStaff", "maxOrdersPerMonth", "maxStorageMB", "maxApiRequestsPerDay"];

const num = (v) => (v == null || v === "" ? null : Number(v));
const nonNegInt = (v, field) => {
  const n = num(v);
  if (n === null) return null;
  if (!Number.isInteger(n) || n < 0) throw new APIError(`${field} must be a non-negative integer`, 400);
  return n;
};

/**
 * Whitelist + coerce a plan payload into the catalog shape. `key` is never
 * taken from the body on update (immutable identifier).
 * Accepts both the new `pricing.*` shape and the legacy `price/currency/
 * interval` fields (mapped into pricing.baseFee).
 */
function sanitizePlanInput(body = {}, overrides = {}) {
  const out = {};
  if (body.name != null) out.name = String(body.name).trim().slice(0, 80);
  if (body.description != null) out.description = String(body.description).slice(0, 1000);
  if (body.family != null) {
    if (!["commission", "subscription", "hybrid"].includes(body.family)) throw new APIError("Invalid plan family", 400);
    out.family = body.family;
  }

  const pricing = {};
  const bf = body.pricing?.baseFee || {};
  const legacyAmount = body.price != null && body.price !== "" ? Number(body.price) : undefined;
  const amount = bf.amount != null ? Number(bf.amount) : legacyAmount;
  if (amount !== undefined) {
    if (!Number.isFinite(amount) || amount < 0) throw new APIError("Base fee amount must be a non-negative number", 400);
    pricing["baseFee.amount"] = amount;
  }
  const currency = bf.currency ?? body.currency;
  if (currency != null) {
    const c = String(currency).toUpperCase().trim();
    if (!/^[A-Z]{3}$/.test(c)) throw new APIError("Currency must be a 3-letter code", 400);
    pricing["baseFee.currency"] = c;
  }
  const interval = bf.interval ?? body.interval;
  if (interval != null) {
    if (!["month", "year"].includes(interval)) throw new APIError("Interval must be month or year", 400);
    pricing["baseFee.interval"] = interval;
  }
  if (body.pricing?.trialDays !== undefined) {
    const t = nonNegInt(body.pricing.trialDays, "trialDays") ?? 0;
    if (t > 365) throw new APIError("trialDays must be at most 365", 400);
    pricing.trialDays = t;
  }
  if (body.pricing?.commissionPolicyKey !== undefined) {
    const k = body.pricing.commissionPolicyKey == null ? null : String(body.pricing.commissionPolicyKey).toLowerCase().trim();
    pricing.commissionPolicyKey = k || null;
  }
  for (const [k, v] of Object.entries(pricing)) out[`pricing.${k}`] = v;

  if (Array.isArray(body.features)) out.features = body.features.map((f) => String(f).trim().slice(0, 120)).filter(Boolean).slice(0, 50);
  if (Array.isArray(body.entitlements)) {
    out.entitlements = body.entitlements.map((f) => String(f).trim()).filter((f) => /^[a-zA-Z0-9_.-]{1,60}$/.test(f)).slice(0, 100);
  }
  if (body.limits && typeof body.limits === "object") {
    for (const k of LIMIT_KEYS) if (body.limits[k] !== undefined) out[`limits.${k}`] = nonNegInt(body.limits[k], k);
  }
  if (body.switching && typeof body.switching === "object") {
    const s = body.switching;
    if (s.allowSelfService != null) out["switching.allowSelfService"] = !!s.allowSelfService;
    if (s.minimumTermDays != null) out["switching.minimumTermDays"] = nonNegInt(s.minimumTermDays, "minimumTermDays") ?? 0;
  }
  if (body.isActive != null) out.isActive = !!body.isActive;
  if (body.sortOrder != null && body.sortOrder !== "") out.sortOrder = Number(body.sortOrder) || 0;
  return { ...out, ...overrides };
}

/** Family/pricing consistency check against the MERGED plan. */
async function assertPlanConsistent(merged) {
  const family = planFamilyOf(merged);
  const fee = planBaseFee(merged);
  const policyKey = merged.pricing?.commissionPolicyKey || null;
  try {
    validatePlanFamily({ family, baseFeeAmount: fee.amount, commissionPolicyKey: policyKey });
  } catch (err) {
    throw new APIError(err.message, 400);
  }
  // (L9) Trials only make sense where there is a base fee to waive.
  if (family === "commission" && (Number(merged.pricing?.trialDays) || 0) > 0) {
    throw new APIError("A commission plan cannot have trial days", 400);
  }
  if (policyKey) {
    const ok = await mongoose.model("CommissionPolicy").exists({ key: policyKey, isActive: true });
    if (!ok) throw new APIError(`Commission policy "${policyKey}" does not exist or is inactive`, 400);
  }
}

export const listPlans = asyncHandler(async (_req, res) => {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const [plans, counts] = await Promise.all([
    SubscriptionPlan.find({}).sort({ sortOrder: 1, key: 1 }).lean(),
    mongoose.model("Tenant").aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: "$subscriptionPlan", n: { $sum: 1 } } },
    ]),
  ]);
  const byKey = new Map(counts.map((c) => [c._id, c.n]));
  res.json({ success: true, data: plans.map((pl) => ({ ...pl, tenantCount: byKey.get(pl.key) || 0 })) });
});

export const createPlan = asyncHandler(async (req, res) => {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const body = req.body || {};
  const key = String(body.key || "").toLowerCase().trim();
  if (!key || !PLAN_KEY_RE.test(key)) {
    throw new APIError('A valid plan key is required (lowercase slug, e.g. "starter").', 400);
  }
  if (!body.name || !String(body.name).trim()) throw new APIError("Plan name is required.", 400);
  if (await SubscriptionPlan.exists({ key })) throw new APIError(`A plan with key "${key}" already exists.`, 409);

  const flat = sanitizePlanInput(body, { key });
  // Build a nested doc from the dotted update shape.
  const doc = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split(".");
    let cur = doc;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) cur[p] = v;
      else cur = cur[p] = cur[p] || {};
    });
  }
  if (!doc.family) doc.family = doc.pricing?.commissionPolicyKey ? "commission" : "subscription";
  // Hybrid plans are not offered at launch — created inactive unless explicit.
  if (doc.family === "hybrid" && body.isActive == null) doc.isActive = false;
  await assertPlanConsistent(doc);

  const plan = await SubscriptionPlan.create(doc);
  await recordPlatformAudit(req, { action: "plan.create", resourceType: "SubscriptionPlan", resourceId: plan._id, after: plan.toObject() });
  res.status(201).json({ success: true, data: plan });
});

export const updatePlan = asyncHandler(async (req, res) => {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) throw new APIError("Plan not found.", 404);
  const update = sanitizePlanInput(req.body || {});
  if (Object.keys(update).length === 0) throw new APIError("No updatable fields provided.", 400);

  const before = plan.toObject();
  for (const [k, v] of Object.entries(update)) plan.set(k, v);
  await assertPlanConsistent(plan.toObject());
  await plan.save();
  const after = plan.toObject();
  const changed = Object.keys(update).map((k) => k.split(".")[0]);
  const pick = (o) => Object.fromEntries([...new Set(changed)].map((k) => [k, o[k]]));
  await recordPlatformAudit(req, { action: "plan.update", resourceType: "SubscriptionPlan", resourceId: plan._id, before: pick(before), after: pick(after) });
  res.json({ success: true, data: plan });
});

export const deletePlan = asyncHandler(async (req, res) => {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) throw new APIError("Plan not found.", 404);
  const Tenant = mongoose.model("Tenant");
  const inUse = await Tenant.countDocuments({ subscriptionPlan: plan.key });
  if (inUse > 0) {
    throw new APIError(`Cannot delete plan "${plan.key}" — ${inUse} tenant(s) are on it. Move them to another plan first.`, 409);
  }
  const scheduled = await mongoose.model("PlanChange").countDocuments({ toPlan: plan.key, status: "scheduled" });
  if (scheduled > 0) throw new APIError(`Cannot delete plan "${plan.key}" — ${scheduled} scheduled plan change(s) target it.`, 409);
  await plan.deleteOne();
  await recordPlatformAudit(req, { action: "plan.delete", resourceType: "SubscriptionPlan", resourceId: plan._id, before: { key: plan.key, name: plan.name } });
  res.json({ success: true, data: { id: req.params.id } });
});

/**
 * PATCH /tenants/:tenantId/plan — legacy immediate plan change. Routed
 * through the plan-change service so it is recorded like every other switch.
 */
export const changeTenantPlan = asyncHandler(async (req, res) => {
  const planKey = String(req.body?.plan ?? req.body?.planKey ?? req.body?.toPlan ?? "").toLowerCase().trim();
  if (!planKey) throw new APIError("A plan key is required.", 400);
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(req.params.tenantId).select("subscriptionPlan").lean();
  if (!tenant) throw new APIError("Tenant not found.", 404);

  const result = await schedulePlanChange({
    tenantId: tenant._id,
    toPlan: planKey,
    effectiveAt: "immediately",
    requestedBy: "operator",
    requestedById: req.platformUser?.id ? new mongoose.Types.ObjectId(req.platformUser.id) : null,
    reason: req.body?.reason || null,
  });
  await recordPlatformAudit(req, {
    action: "plan.change",
    resourceType: "Tenant",
    resourceId: tenant._id,
    tenantId: tenant._id,
    reason: req.body?.reason || null,
    before: { plan: tenant.subscriptionPlan },
    after: { plan: planKey, applied: true },
  });
  res.json({
    success: true,
    data: {
      tenantId: String(tenant._id),
      subscriptionPlan: result.tenant.subscriptionPlan,
      subscriptionStartDate: result.tenant.subscriptionStartDate,
      subscriptionEndDate: result.tenant.subscriptionEndDate,
    },
  });
});
