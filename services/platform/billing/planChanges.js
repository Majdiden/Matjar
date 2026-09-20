/**
 * Plan changes (family switches). A change is scheduled for the next
 * statement period by default so one period is never billed under two
 * models; operators may force "immediately".
 */
import mongoose from "mongoose";
import { APIError } from "../../../middlewares/errorHandler.js";
import { periodKeyFor, periodBounds } from "./money.js";
import { recordPlatformAudit } from "../audit.js";

const PlanChange = () => mongoose.model("PlanChange");

/** Start of the next calendar period (UTC). */
export function nextPeriodStart(now = new Date()) {
  const { end } = periodBounds(periodKeyFor(now));
  return end;
}

/**
 * Apply a plan to a tenant: pointer, subscription window, entitlement
 * limits. Grants the plan's trial only if this tenant has never had one
 * (M3: `billing.trialUsedAt` is set once and never cleared).
 */
export async function applyPlanToTenant(tenantId, plan) {
  const now = new Date();
  const interval = plan.pricing?.baseFee?.interval || plan.interval || "month";
  const endDate = new Date(now);
  if (interval === "year") endDate.setFullYear(endDate.getFullYear() + 1);
  else endDate.setMonth(endDate.getMonth() + 1);
  const set = { subscriptionPlan: plan.key, subscriptionStartDate: now, subscriptionEndDate: endDate };
  Object.assign(set, await trialGrant(tenantId, plan, now));
  if (plan.limits?.maxProducts != null) set["limits.maxProducts"] = plan.limits.maxProducts;
  if (plan.limits?.maxStaff != null) set["limits.maxUsers"] = plan.limits.maxStaff;
  if (plan.limits?.maxOrdersPerMonth != null) set["limits.maxOrders"] = plan.limits.maxOrdersPerMonth;
  const Tenant = mongoose.model("Tenant");
  const t = await Tenant.findByIdAndUpdate(tenantId, { $set: set }, { new: true }).select("subscriptionPlan subscriptionStartDate subscriptionEndDate").lean();
  if (!t) throw new APIError("Tenant not found", 404);
  return t;
}

/**
 * (N5) Fields to stamp when a trial plan is assigned to a tenant that has
 * NEVER had a trial: `billing.trialUsedAt` + `billing.trialEndsAt`. Returns
 * {} otherwise. Shared by registration and plan changes.
 */
export async function trialGrant(tenantId, plan, now = new Date()) {
  const trialDays = Number(plan?.pricing?.trialDays) || 0;
  if (!(trialDays > 0) || plan?.family === "commission") return {};
  const Tenant = mongoose.model("Tenant");
  const cur = await Tenant.findById(tenantId).select("billing.trialUsedAt").lean();
  if (!cur || cur.billing?.trialUsedAt) return {};
  return { "billing.trialUsedAt": now, "billing.trialEndsAt": new Date(now.getTime() + trialDays * 86400000) };
}

/**
 * @param {object} args { tenantId, toPlan, effectiveAt: 'immediately'|'next_period', requestedBy: 'merchant'|'operator', requestedById, reason, selfService }
 */
export async function schedulePlanChange({ tenantId, toPlan, effectiveAt = "next_period", requestedBy, requestedById = null, reason = null, selfService = false }) {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const Tenant = mongoose.model("Tenant");
  const key = String(toPlan || "").toLowerCase().trim();
  const plan = await SubscriptionPlan.findOne({ key }).lean();
  if (!plan) throw new APIError(`Unknown plan "${key}"`, 404);
  if (!plan.isActive) throw new APIError("That plan is not available", 400);
  if (selfService && plan.switching?.allowSelfService === false) {
    throw new APIError("That plan cannot be selected without contacting support", 403);
  }
  const tenant = await Tenant.findById(tenantId).select("subscriptionPlan subscriptionStartDate").lean();
  if (!tenant) throw new APIError("Tenant not found", 404);
  if (tenant.subscriptionPlan === key) throw new APIError("Tenant is already on that plan", 409);

  if (selfService) {
    const current = tenant.subscriptionPlan
      ? await SubscriptionPlan.findOne({ key: tenant.subscriptionPlan }).select("switching").lean()
      : null;
    const minDays = Number(current?.switching?.minimumTermDays) || 0;
    if (minDays > 0 && tenant.subscriptionStartDate) {
      const earliest = new Date(new Date(tenant.subscriptionStartDate).getTime() + minDays * 86400000);
      if (earliest > new Date()) {
        throw new APIError(`Your current plan has a minimum term until ${earliest.toISOString().slice(0, 10)}`, 403);
      }
    }
  }

  const now = new Date();
  const when = effectiveAt === "immediately" ? now : nextPeriodStart(now);

  // (N6) A merchant can never displace a change scheduled by an operator.
  if (selfService) {
    const operatorPending = await PlanChange().exists({ tenantId, status: "scheduled", requestedBy: "operator" });
    if (operatorPending) {
      throw new APIError("A plan change scheduled by Matjar support is pending; contact support to change it", 409);
    }
  }
  // One scheduled change at a time — a newer request supersedes the old one.
  await PlanChange().updateMany({ tenantId, status: "scheduled" }, { $set: { status: "cancelled" } });

  const change = await PlanChange().create({
    tenantId,
    fromPlan: tenant.subscriptionPlan || null,
    toPlan: key,
    requestedBy,
    requestedById,
    requestedAt: now,
    effectiveAt: when,
    reason,
    status: "scheduled",
  });

  if (effectiveAt === "immediately") {
    const t = await applyPlanToTenant(tenantId, plan);
    change.status = "applied";
    change.appliedAt = now;
    await change.save();
    return { change: change.toObject(), tenant: t, applied: true };
  }
  return { change: change.toObject(), tenant: null, applied: false };
}

export async function cancelScheduledChange(tenantId) {
  const res = await PlanChange().updateMany({ tenantId, status: "scheduled" }, { $set: { status: "cancelled" } });
  return res.modifiedCount || 0;
}

/**
 * Merchant self-service cancel: only a change the MERCHANT requested may be
 * cancelled from the dashboard. An operator-scheduled change is a platform
 * decision and returns 403 with a clear message.
 */
export async function cancelOwnScheduledChange(tenantId) {
  const pending = await PlanChange().findOne({ tenantId, status: "scheduled" }).lean();
  if (!pending) throw new APIError("No scheduled plan change to cancel", 404);
  if (pending.requestedBy !== "merchant") {
    throw new APIError("This plan change was scheduled by Matjar support; contact support to change it", 403);
  }
  await PlanChange().updateOne({ _id: pending._id, status: "scheduled" }, { $set: { status: "cancelled" } });
  return pending;
}

/**
 * Apply every scheduled change whose effectiveAt has passed. (L1) Each
 * change is claimed atomically (scheduled → applying) so two concurrent
 * runs cannot apply the same change twice; loops until nothing is due.
 * (M8) Every applied change writes a system audit row.
 */
export async function applyDueChanges(now = new Date()) {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const plans = new Map();
  const errors = [];
  let applied = 0;
  // (N3) A claim older than this is considered leaked (process died) and is
  // re-claimed by the next run.
  const stale = new Date(now.getTime() - 15 * 60 * 1000);
  for (let guard = 0; guard < 10000; guard++) {
    const change = await PlanChange().findOneAndUpdate(
      {
        $or: [
          { status: "scheduled", effectiveAt: { $lte: now } },
          { status: "applying", claimedAt: { $lt: stale } },
        ],
      },
      { $set: { status: "applying", claimedAt: now } },
      { new: true, sort: { effectiveAt: 1 } }
    );
    if (!change) break;
    try {
      if (!plans.has(change.toPlan)) plans.set(change.toPlan, await SubscriptionPlan.findOne({ key: change.toPlan }).lean());
      const plan = plans.get(change.toPlan);
      if (!plan) {
        change.status = "cancelled";
        change.reason = `${change.reason || ""} [plan no longer exists]`.trim();
        await change.save();
        continue;
      }
      await applyPlanToTenant(change.tenantId, plan);
      change.status = "applied";
      change.appliedAt = now;
      await change.save();
      applied += 1;
      await recordPlatformAudit(null, {
        action: "plan.change.apply",
        resourceType: "Tenant",
        resourceId: change.tenantId,
        tenantId: change.tenantId,
        reason: change.reason || null,
        before: { plan: change.fromPlan },
        after: { plan: change.toPlan, effectiveAt: change.effectiveAt, requestedBy: change.requestedBy },
      });
    } catch (err) {
      // (N7) Release the claim so the next run retries it, record, continue.
      await PlanChange().updateOne({ _id: change._id, status: "applying" }, { $set: { status: "scheduled" }, $unset: { claimedAt: 1 } }).catch(() => {});
      errors.push({ tenantId: String(change.tenantId), changeId: String(change._id), error: err.message });
    }
  }
  return { applied, errors };
}

/**
 * The plan key a tenant was on at `at` (H2): the earliest applied change
 * that became EFFECTIVE after `at` tells us what the tenant was on before
 * it. Falls back to the current pointer when nothing became effective later.
 * Keyed on effectiveAt (not appliedAt) so a late cron run cannot re-price a
 * closed period.
 */
export async function planKeyAt(tenantId, at, currentKey) {
  const later = await PlanChange()
    .find({ tenantId, status: { $in: ["applied", "applying"] }, effectiveAt: { $gt: at } })
    .sort({ effectiveAt: 1 })
    .limit(1)
    .select("fromPlan")
    .lean();
  return later.length ? later[0].fromPlan : currentKey;
}

export async function listPlanChanges(tenantId, limit = 20) {
  return PlanChange().find({ tenantId }).sort({ requestedAt: -1 }).limit(limit).lean();
}
