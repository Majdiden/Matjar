/**
 * Guided onboarding state (PBI 10-17 — "first sale" checklist).
 *
 * Most checklist steps are inferred from existing data (products, payment
 * methods). Two are not: the merchant shared their store link, and the
 * merchant looked at how customers pay. The dashboard reports those with a
 * one-word event; we stamp the FIRST time each happened on
 * `tenant.onboarding` and never move or clear it, so the timestamps double
 * as the "time to share" metric for the merchant validation rounds (10-18).
 */
import { getATenantRepo, updateATenantRepo } from "../repositories/tenant.js";
import { APIError } from "../middlewares/errorHandler.js";

/** Checklist event → the tenant field it stamps. */
export const ONBOARDING_EVENTS = Object.freeze({
  shared: "sharedAt",
  payments_reviewed: "paymentsReviewedAt",
});

export const ONBOARDING_EVENT_NAMES = Object.freeze(Object.keys(ONBOARDING_EVENTS));

const toIso = (d) => (d ? new Date(d).toISOString() : null);

/** The onboarding state the dashboard reads; every key always present. */
export function toOnboardingState(tenant) {
  const o = tenant?.onboarding || {};
  return {
    flow: o.flow || null,
    sharedAt: toIso(o.sharedAt),
    paymentsReviewedAt: toIso(o.paymentsReviewedAt),
  };
}

export async function getOnboardingStateService(tenantId) {
  const tenant = await getATenantRepo({ onboarding: 1 }, { _id: tenantId });
  if (!tenant) throw new APIError("Tenant not found", 404);
  return toOnboardingState(tenant);
}

/**
 * Record a checklist event. Idempotent: only the first occurrence is stored
 * (the filter matches only while the field is unset), so repeated taps and
 * retries on a weak connection are harmless.
 */
export async function recordOnboardingEventService(tenantId, event, at = new Date()) {
  const field = ONBOARDING_EVENTS[event];
  if (!field) throw new APIError(`Unknown onboarding event: ${event}`, 400);
  const path = `onboarding.${field}`;
  await updateATenantRepo({ _id: tenantId, [path]: { $exists: false } }, { $set: { [path]: at } });
  return getOnboardingStateService(tenantId);
}
