/**
 * Merchant-facing billing (tenant-scoped via the normal auth middleware).
 * Exposes only the caller's tenant: current plan, effective pricing (no
 * internal source details), current-period totals, statements, available
 * plans with an estimate from the last 30 days of delivered orders, and a
 * self-service plan change (next period only).
 */
import mongoose from "mongoose";
import { asyncHandler, APIError } from "../middlewares/errorHandler.js";
import {
  resolveEffectivePricing,
  getBillingSettings,
  periodTotals,
  listStatements,
  schedulePlanChange,
  cancelOwnScheduledChange,
  nextPeriodStart,
  listPlanChanges,
  computeCommission,
  periodKeyFor,
  getFxTable,
  fxMultiplier,
  merchantLineDescription,
} from "../services/platform/billing/index.js";
import { publicPlanView, loadActivePolicies } from "./plans.js";
import { logAudit } from "../utils/audit.js";

/** Sum of delivered order totals (net of refunds) in the last 30 days. */
async function recentDeliveredGmv(models) {
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await models.Order.find({ status: "Delivered", updatedAt: { $gte: since } })
    .select("totalAmount refundedAmount")
    .lean();
  let gmv = 0;
  for (const o of rows) gmv += Math.max(0, (Number(o.totalAmount) || 0) - (Number(o.refundedAmount) || 0));
  return { gmv, orders: rows.length };
}

/** Estimate what a plan would cost per month for the given recent volume. */
function estimateForPlan(view, policy, tenant, recent, fxTable) {
  const monthlyBase = view.family === "commission" ? 0 : view.interval === "year" ? view.basePrice / 12 : view.basePrice;
  let commission = 0;
  let fxMissing = false;
  if (policy && recent.gmv > 0) {
    const fx = fxMultiplier(fxTable, tenant.settings?.currency, policy.currency);
    const avg = recent.orders ? recent.gmv / recent.orders : recent.gmv;
    // Approximate: run the average order through the tiers `orders` times.
    let basis = 0;
    let feeSoFar = 0;
    for (let i = 0; i < Math.max(1, recent.orders); i++) {
      const r = computeCommission({ policy, periodBasisSoFar: policy.basis === "order_count" ? i : basis, periodFeeSoFar: feeSoFar, orderAmount: avg, fxRateToPolicyCurrency: fx });
      commission += r.feeAmount;
      if (r.fxMissing) fxMissing = true;
      if (r.basisPolicyAmount) basis += r.basisPolicyAmount;
      if (r.feePolicyAmount) feeSoFar += r.feePolicyAmount;
    }
  }
  return { monthlyBase, estimatedCommission: Math.round(commission * 100) / 100, fxMissing, currencyNote: view.baseCurrency };
}

export const getBillingSummary = asyncHandler(async (req, res) => {
  const tenant = req.tenant;
  if (!tenant) throw new APIError("Tenant context not found", 400);
  const settings = await getBillingSettings();
  const pricing = await resolveEffectivePricing(tenant, { settings });
  const period = periodKeyFor();
  const [totals, statements, recent, changes, fxTable] = await Promise.all([
    periodTotals(tenant._id, period),
    listStatements({ tenantId: tenant._id, page: 1, limit: 12 }),
    recentDeliveredGmv(req.models),
    listPlanChanges(tenant._id, 3),
    getFxTable(),
  ]);

  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, key: 1 }).lean();
  const policies = await loadActivePolicies(plans.map((p) => p.pricing?.commissionPolicyKey));
  // Self-service switches always start next period; the current plan's
  // minimum term may push the earliest allowed request date further out.
  const nextPeriodStartsAt = nextPeriodStart();
  const currentPlan = plans.find((p) => p.key === pricing.planKey) || null;
  const minDays = Number(currentPlan?.switching?.minimumTermDays) || 0;
  const minimumTermEndsAt =
    minDays > 0 && tenant.subscriptionStartDate ? new Date(new Date(tenant.subscriptionStartDate).getTime() + minDays * 86400000) : null;
  const available = [];
  for (const p of plans) {
    const view = await publicPlanView(p, policies);
    const policy = p.pricing?.commissionPolicyKey ? policies.get(p.pricing.commissionPolicyKey) : null;
    available.push({
      ...view,
      current: p.key === pricing.planKey,
      minimumTermDays: Number(p.switching?.minimumTermDays) || 0,
      nextPeriodStartsAt,
      // Earliest date a switch to this plan can be REQUESTED (null = now).
      availableAfter: p.key === pricing.planKey ? null : minimumTermEndsAt && minimumTermEndsAt > new Date() ? minimumTermEndsAt : null,
      estimate: estimateForPlan(view, policy, tenant, recent, fxTable),
    });
  }

  res.json({
    success: true,
    responseObject: {
      plan: { key: pricing.planKey, name: pricing.planName, family: pricing.family },
      pricing: {
        baseFee: pricing.baseFee,
        chargesBaseFee: pricing.chargesBaseFee,
        chargesCommission: pricing.chargesCommission,
        commission: pricing.policy
          ? { currency: pricing.policy.currency, tierMode: pricing.policy.tierMode, period: pricing.policy.period, tiers: pricing.policy.tiers, percentDelta: pricing.percentDelta || 0 }
          : null,
        trialEndsAt: pricing.trialEndsAt,
        feeHolidayUntil: pricing.feeHolidayUntil,
      },
      currentPeriod: { periodKey: period, ...totals, currency: totals.currency || tenant.settings?.currency || "SDG" },
      recent30d: recent,
      // (N12) Drafts are internal; merchants only see issued statements.
      statements: statements.rows.filter((s) => s.status !== "draft").map((s) => ({
        id: String(s._id), periodKey: s.periodKey, currency: s.currency, status: s.status,
        amountDue: s.amountDue, amountPaid: s.amountPaid, balance: s.balance, issuedAt: s.issuedAt, dueAt: s.dueAt,
        // (L4) Operator reasons on adjustments/credits stay internal.
        lines: (s.lines || []).map((l) => ({ type: l.type, amount: l.amount, description: ["adjustment", "credit"].includes(l.type) ? merchantLineDescription({ type: l.type }) : l.description })),
      })),
      scheduledChange: (() => {
        const c = changes.find((x) => x.status === "scheduled");
        return c ? { toPlan: c.toPlan, effectiveAt: c.effectiveAt, status: c.status, requestedBy: c.requestedBy, cancellable: c.requestedBy === "merchant" } : null;
      })(),
      nextPeriodStartsAt,
      minimumTermEndsAt,
      availablePlans: available,
      dueDays: settings.dueDays,
    },
  });
});

export const requestPlanChange = asyncHandler(async (req, res) => {
  const tenant = req.tenant;
  if (!tenant) throw new APIError("Tenant context not found", 400);
  const result = await schedulePlanChange({
    tenantId: tenant._id,
    toPlan: req.body.toPlan,
    effectiveAt: "next_period",
    requestedBy: "merchant",
    requestedById: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : null,
    selfService: true,
  });
  logAudit(req.models, {
    action: "billing.plan_change_requested",
    resource: "Tenant",
    resourceId: String(tenant._id),
    req,
    metadata: { toPlan: req.body.toPlan, effectiveAt: result.change.effectiveAt },
  });
  res.status(201).json({ success: true, message: "Plan change scheduled", responseObject: result.change });
});
export const cancelPlanChangeRequest = asyncHandler(async (req, res) => {
  const tenant = req.tenant;
  if (!tenant) throw new APIError("Tenant context not found", 400);
  const cancelled = await cancelOwnScheduledChange(tenant._id);
  logAudit(req.models, {
    action: "billing.plan_change_cancelled",
    resource: "Tenant",
    resourceId: String(tenant._id),
    req,
    metadata: { toPlan: cancelled.toPlan, effectiveAt: cancelled.effectiveAt },
  });
  res.json({ success: true, message: "Plan change cancelled", responseObject: { cancelled: true, toPlan: cancelled.toPlan } });
});
