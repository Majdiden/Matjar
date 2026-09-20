/**
 * Effective pricing resolution for a tenant.
 *
 * Ladder (docs/plans/platform-admin-operating-system.md §2.1):
 *   platform default → plan → (access program, Phase B) → tenant override
 *
 * Returns everything the ledger and statements need, plus the SOURCE of each
 * value so the configuration inspector can explain a bill.
 */
import mongoose from "mongoose";

export const PLAN_FAMILIES = Object.freeze(["commission", "subscription", "hybrid"]);

/** Derive a plan's family for legacy rows that predate the field. */
export function planFamilyOf(plan) {
  if (!plan) return "subscription";
  if (PLAN_FAMILIES.includes(plan.family)) return plan.family;
  return "subscription";
}

/**
 * Base fee of a plan, honouring the legacy `price` mirror (M7): an
 * unmigrated lean row may carry a schema-default 0 under pricing.baseFee
 * while the real price still lives in `price`.
 */
export function planBaseFee(plan) {
  const bf = plan?.pricing?.baseFee;
  const legacy = Number(plan?.price) || 0;
  if (bf && bf.amount != null && (Number(bf.amount) > 0 || legacy === 0)) {
    return { amount: Number(bf.amount) || 0, currency: bf.currency || plan.currency || "SDG", interval: bf.interval || plan.interval || "month" };
  }
  return { amount: legacy, currency: plan?.currency || bf?.currency || "SDG", interval: plan?.interval || bf?.interval || "month" };
}

/**
 * Validate a plan's family/pricing combination. Pure; throws Error with a
 * human message. Used by the plans controller and unit tests.
 *   commission   → policy required, base fee must be 0
 *   subscription → no policy (base fee may be 0 for a free plan)
 *   hybrid       → policy required and base fee > 0
 */
export function validatePlanFamily({ family, baseFeeAmount, commissionPolicyKey }) {
  const fam = PLAN_FAMILIES.includes(family) ? family : "subscription";
  const fee = Number(baseFeeAmount) || 0;
  const hasPolicy = !!commissionPolicyKey;
  if (fam === "commission") {
    if (!hasPolicy) throw new Error("A commission plan needs a commissionPolicyKey");
    if (fee !== 0) throw new Error("A commission plan must have a base fee of 0");
  } else if (fam === "subscription") {
    if (hasPolicy) throw new Error("A subscription plan cannot reference a commission policy");
  } else if (fam === "hybrid") {
    if (!hasPolicy) throw new Error("A hybrid plan needs a commissionPolicyKey");
    if (fee <= 0) throw new Error("A hybrid plan needs a base fee greater than 0");
  }
  return fam;
}

/** All currently active tenant overrides, newest first. */
export async function findActiveOverrides(tenantId, at = new Date()) {
  const PricingOverride = mongoose.model("PricingOverride");
  return PricingOverride.find({
    scope: "tenant",
    scopeId: tenantId,
    revokedAt: null,
    startsAt: { $lte: at },
    $or: [{ endsAt: null }, { endsAt: { $gt: at } }],
  })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Pure (M6): merge active overrides per field — the newest non-null value
 * of each field wins, so a fee holiday created last week and a negotiated
 * policy created yesterday both apply. `overrides` must be newest-first.
 */
export function mergeOverrides(overrides = []) {
  const out = { baseFee: null, commissionPolicyKey: null, percentDelta: null, feeHolidayUntil: null, ids: [] };
  for (const o of overrides) {
    if (!o) continue;
    out.ids.push(String(o._id || ""));
    if (out.baseFee == null && o.baseFee?.amount != null) out.baseFee = o.baseFee;
    if (out.commissionPolicyKey == null && o.commissionPolicyKey) out.commissionPolicyKey = o.commissionPolicyKey;
    if (out.percentDelta == null && o.percentDelta != null) out.percentDelta = Number(o.percentDelta);
    if (out.feeHolidayUntil == null && o.feeHolidayUntil) out.feeHolidayUntil = new Date(o.feeHolidayUntil);
  }
  return out;
}

/**
 * @param {object} tenant  lean Tenant (needs _id, subscriptionPlan, subscriptionStartDate, settings)
 * @param {object} [opts]  { at?: Date, settings?: billing settings }
 */
export async function resolveEffectivePricing(tenant, opts = {}) {
  const at = opts.at || new Date();
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const CommissionPolicy = mongoose.model("CommissionPolicy");
  const plan = tenant?.subscriptionPlan
    ? await SubscriptionPlan.findOne({ key: String(tenant.subscriptionPlan).toLowerCase() }).lean()
    : null;
  const override = tenant?._id ? mergeOverrides(await findActiveOverrides(tenant._id, at)) : mergeOverrides([]);
  const settings = opts.settings || null;

  const family = planFamilyOf(plan);
  const planFee = planBaseFee(plan);
  const hasOverrideFee = override.baseFee?.amount != null;
  const baseFee = hasOverrideFee
    ? {
        amount: Number(override.baseFee.amount) || 0,
        currency: override.baseFee.currency || planFee.currency,
        interval: override.baseFee.interval || planFee.interval,
      }
    : planFee;

  let policyKey = null;
  let commissionSource = "none";
  if (override.commissionPolicyKey) {
    policyKey = override.commissionPolicyKey;
    commissionSource = "override";
  } else if (plan?.pricing?.commissionPolicyKey) {
    policyKey = plan.pricing.commissionPolicyKey;
    commissionSource = "plan";
  } else if (family !== "subscription" && settings?.defaultCommissionPolicyKey) {
    policyKey = settings.defaultCommissionPolicyKey;
    commissionSource = "default";
  }
  let policy = policyKey ? await CommissionPolicy.findOne({ key: policyKey, isActive: true }).lean() : null;
  // (M2) A plan/override pointing at an inactive or missing policy must not
  // silently waive commission: fall back to the platform default and flag it
  // so the ledger can log an error.
  let policyFallback = null;
  if (policyKey && !policy && settings?.defaultCommissionPolicyKey && settings.defaultCommissionPolicyKey !== policyKey) {
    const fallback = await CommissionPolicy.findOne({ key: settings.defaultCommissionPolicyKey, isActive: true }).lean();
    if (fallback) {
      policy = fallback;
      policyFallback = { wanted: policyKey, used: fallback.key };
      commissionSource = "default";
    }
  }
  if (!policy) commissionSource = "none";

  // (M3/N5) A trial is granted once per tenant, ever: applyPlanToTenant /
  // registration stamp `billing.trialUsedAt` + `billing.trialEndsAt` the first
  // time a trial plan is assigned. The resolver trusts ONLY the stored end
  // date — no heuristics — and a commission plan never has a trial.
  const trialEndsAt =
    family !== "commission" && tenant?.billing?.trialEndsAt ? new Date(tenant.billing.trialEndsAt) : null;

  const feeHolidayUntil = override.feeHolidayUntil ? new Date(override.feeHolidayUntil) : null;

  return {
    planKey: plan?.key || tenant?.subscriptionPlan || null,
    planName: plan?.name || null,
    family,
    baseFee,
    trialEndsAt,
    inTrial: !!(trialEndsAt && trialEndsAt > at),
    policy,
    policyKey: policy ? policy.key : null,
    percentDelta: Number(override?.percentDelta) || 0,
    feeHolidayUntil,
    inFeeHoliday: !!(feeHolidayUntil && feeHolidayUntil >= at),
    chargesCommission: !!policy && family !== "subscription",
    chargesBaseFee: family !== "commission" && baseFee.amount > 0,
    source: {
      baseFee: hasOverrideFee ? "override" : "plan",
      commission: commissionSource,
    },
    overrideIds: override.ids,
    policyFallback,
  };
}

// NOTE (H3): there is intentionally NO helper here that reads the tenant's own
// `settings.currencies.rates`. Platform pricing (tier lookups, base-fee
// conversion) uses the platform-owned reference table in ./fx.js only.
