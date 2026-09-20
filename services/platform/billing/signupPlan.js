/**
 * Which plan a brand-new tenant lands on.
 *
 * The client may request a plan key, but only an ACTIVE plan that allows
 * self-service selection is honoured; anything else falls back to the
 * platform default plan (billing settings `defaultPlanKey`, "trial" when
 * unset) with a warning. If even the default is missing from the catalog the
 * key is still assigned (legacy behaviour) so signup never fails on catalog
 * hygiene — the plans page shows the dangling key via tenantCount.
 *
 * Also returns the trial stamp for the tenant document (N5): a new tenant
 * has never had a trial, so a trial plan grants one immediately.
 */
import mongoose from "mongoose";
import logger from "../../../utils/logger.js";
import { getBillingSettings } from "./settings.js";

export async function resolveSignupPlan(requestedKey) {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const settings = await getBillingSettings();
  const defaultKey = settings.defaultPlanKey || "trial";
  const wanted = String(requestedKey || "").toLowerCase().trim();

  let plan = null;
  if (wanted) {
    const candidate = await SubscriptionPlan.findOne({ key: wanted }).lean();
    if (candidate && candidate.isActive && candidate.switching?.allowSelfService !== false) {
      plan = candidate;
    } else {
      logger.warn("signup: requested plan not selectable; using platform default", {
        requested: wanted,
        reason: !candidate ? "unknown" : !candidate.isActive ? "inactive" : "not-self-service",
        defaultKey,
      });
    }
  }
  if (!plan) plan = (await SubscriptionPlan.findOne({ key: defaultKey }).lean()) || { key: defaultKey, pricing: {}, family: "subscription" };

  const now = new Date();
  const trialDays = plan.family === "commission" ? 0 : Number(plan.pricing?.trialDays) || 0;
  const trial = trialDays > 0 ? { trialUsedAt: now, trialEndsAt: new Date(now.getTime() + trialDays * 86400000) } : null;
  return { plan, trial, requested: wanted || null, fellBack: !!wanted && plan.key !== wanted };
}
