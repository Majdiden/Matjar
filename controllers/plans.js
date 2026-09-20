import mongoose from "mongoose";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { localizePrice, detectCountry } from "../services/geoPricing.js";
import { isFeatureEnabled } from "../services/featureFlags.js";
import { planBaseFee, planFamilyOf } from "../services/platform/billing/resolver.js";

/**
 * Public-safe projection of a plan: family, base fee, and the commission
 * tier table (percentages are marketing-visible). Never internal fields.
 */
export async function publicPlanView(p, policiesByKey = new Map()) {
  const fee = planBaseFee(p);
  const family = planFamilyOf(p);
  const policy = p.pricing?.commissionPolicyKey ? policiesByKey.get(p.pricing.commissionPolicyKey) : null;
  return {
    key: p.key,
    name: p.name,
    description: p.description || "",
    family,
    interval: fee.interval,
    features: p.features || [],
    limits: p.limits || {},
    trialDays: Number(p.pricing?.trialDays) || 0,
    basePrice: Math.round(fee.amount || 0),
    baseCurrency: fee.currency,
    commission: policy
      ? {
          currency: policy.currency,
          tierMode: policy.tierMode,
          period: policy.period,
          tiers: (policy.tiers || []).map((t) => ({ upTo: t.upTo, percent: t.percent, fixedPerOrder: t.fixedPerOrder || 0 })),
          minFee: policy.perOrder?.minFee ?? null,
          maxFee: policy.perOrder?.maxFee ?? null,
        }
      : null,
    selfService: p.switching?.allowSelfService !== false,
  };
}

export async function loadActivePolicies(keys) {
  const list = [...new Set(keys.filter(Boolean))];
  if (!list.length) return new Map();
  const rows = await mongoose.model("CommissionPolicy").find({ key: { $in: list }, isActive: true }).lean();
  return new Map(rows.map((r) => [r.key, r]));
}

/**
 * @route   GET /api/plans
 * @desc    Public subscription-plan catalog for the marketing/landing page.
 *          Shows both families. Base fee optionally geo-localised for display.
 * @access  Public
 */
export const listPublicPlans = asyncHandler(async (req, res) => {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, key: 1 }).lean();
  const policies = await loadActivePolicies(plans.map((p) => p.pricing?.commissionPolicyKey));
  const geoEnabled = await isFeatureEnabled("billing.geoPricing");

  const data = [];
  for (const p of plans) {
    const view = await publicPlanView(p, policies);
    const local = geoEnabled
      ? localizePrice(req, view.basePrice, view.baseCurrency)
      : { displayPrice: view.basePrice, displayCurrency: view.baseCurrency, converted: false };
    data.push({ ...view, displayPrice: local.displayPrice, displayCurrency: local.displayCurrency, priceConverted: local.converted });
  }

  res.json({ success: true, data: { plans: data, country: geoEnabled ? detectCountry(req) : null } });
});
