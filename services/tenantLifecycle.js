/**
 * Tenant lifecycle operations.
 *
 * All multi-step state changes on a tenant go through here so:
 *   - the explicit `tenant.lifecycle` state (source of truth for operators)
 *     and the legacy flags every other check reads (subscriptionStatus +
 *     isActive + suspendedAt + deletionScheduledAt) move together in ONE
 *     write;
 *   - each transition is validated against LIFECYCLE_TRANSITIONS and applied
 *     with a compare-and-set on the current state (no TOCTOU: a concurrent
 *     transition makes the second one fail with 409);
 *   - every transition appends to a bounded history;
 *   - soft-delete schedules a grace window the purge worker acts on.
 *
 * Controllers write the operator-attributed platform audit row (they know
 * the request). System-initiated transitions (setup completion, the purge
 * sweep) write their own `actorType: "system"` row here.
 *
 * Hard-delete (`purgeTenant`) wipes tenant-scoped documents across every
 * store-* collection and keeps the Tenant row with `deletedAt` set as
 * a tombstone for audit/compliance.
 */

import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { recordPlatformAudit } from "./platform/audit.js";

const DELETION_GRACE_DAYS = 30;
const MIN_GRACE_DAYS = 1;
const MAX_GRACE_DAYS = 90;
const LIFECYCLE_HISTORY_CAP = 50;

export const LIFECYCLE_STATES = Object.freeze({
  PENDING: "pending",
  ONBOARDING: "onboarding",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  CLOSED: "closed",
  ARCHIVED: "archived",
});

/** Allowed transitions: from → [to]. Pure data so it can be unit-tested. */
export const LIFECYCLE_TRANSITIONS = Object.freeze({
  pending: ["onboarding", "active", "closed"],
  onboarding: ["active", "suspended", "closed"],
  active: ["suspended", "closed"],
  suspended: ["active", "closed"],
  closed: ["active", "archived"], // "active" = deletion cancelled
  archived: [],
});

/** Same-state is NOT a transition: suspending an already-suspended store is rejected. */
export function canTransition(from, to) {
  const f = from || LIFECYCLE_STATES.PENDING;
  return (LIFECYCLE_TRANSITIONS[f] || []).includes(to);
}

/**
 * Derive the lifecycle state a tenant SHOULD be in from its legacy flags.
 * Used for rows created before the lifecycle block existed (and by the
 * backfill migration, which mirrors this logic inline).
 */
export function deriveLifecycleState(t) {
  if (t.deletedAt) return LIFECYCLE_STATES.ARCHIVED;
  if (t.deletionScheduledAt) return LIFECYCLE_STATES.CLOSED;
  if (t.subscriptionStatus === "suspended" || t.suspendedAt) return LIFECYCLE_STATES.SUSPENDED;
  if (t.subscriptionStatus === "cancelled" || t.isActive === false) return LIFECYCLE_STATES.CLOSED;
  const setup = t.setupStatus?.status;
  if (setup && setup !== "completed") return LIFECYCLE_STATES.ONBOARDING;
  return LIFECYCLE_STATES.ACTIVE;
}

/** Current state of a loaded tenant doc: explicit block, else derived. */
export function currentLifecycleState(t) {
  return t?.lifecycle?.state || deriveLifecycleState(t || {});
}

/**
 * Build the `$set`/`$push` fragment that moves a tenant to `state`.
 * Callers merge it into their own update so the legacy flags and the
 * lifecycle change land in ONE write.
 */
export function lifecycleUpdate(state, { reason = null, changedBy = "system" } = {}) {
  const now = new Date();
  return {
    $set: {
      "lifecycle.state": state,
      "lifecycle.reason": reason,
      "lifecycle.changedAt": now,
      "lifecycle.changedBy": changedBy,
    },
    $push: {
      "lifecycle.history": {
        $each: [{ state, reason, changedAt: now, changedBy }],
        $slice: -LIFECYCLE_HISTORY_CAP,
      },
    },
  };
}

/**
 * Legacy-flag side effects that every transition to a given state implies.
 * Pure — unit-tested. Returned as { $set, $unset } fragments.
 */
export function legacyFlagsFor(state, extras = {}) {
  switch (state) {
    case LIFECYCLE_STATES.ACTIVE:
      return {
        $set: { subscriptionStatus: "active", isActive: true },
        $unset: { suspendedAt: "", suspensionReason: "", deletionScheduledAt: "" },
      };
    case LIFECYCLE_STATES.SUSPENDED:
      return {
        $set: { subscriptionStatus: "suspended", suspendedAt: new Date(), suspensionReason: extras.reason || "Suspended by platform admin" },
        $unset: {},
      };
    case LIFECYCLE_STATES.CLOSED:
      return {
        $set: { subscriptionStatus: "cancelled", isActive: false, ...(extras.deletionScheduledAt ? { deletionScheduledAt: extras.deletionScheduledAt } : {}) },
        // A closed store is no longer "suspended" — clear so a later
        // cancel-deletion returns it to a clean active state.
        $unset: { suspendedAt: "", suspensionReason: "" },
      };
    case LIFECYCLE_STATES.ARCHIVED:
      return {
        $set: { deletedAt: new Date(), isActive: false, subscriptionStatus: "cancelled" },
        $unset: { deletionScheduledAt: "" },
      };
    default:
      return { $set: {}, $unset: {} };
  }
}

function conflict(msg) {
  const err = new Error(msg);
  err.statusCode = 409;
  return err;
}

async function loadForTransition(tenantId) {
  const Tenant = mongoose.model("Tenant");
  const t = await Tenant.findById(tenantId)
    .select("lifecycle subscriptionStatus isActive suspendedAt deletionScheduledAt deletedAt setupStatus.status")
    .lean();
  if (!t) throw new Error("Tenant not found");
  return t;
}

/**
 * Compare-and-set transition. Verifies the table, then applies the update
 * only if the stored state is still `from` (or still absent for a legacy
 * row). A null result means someone else moved the tenant first → 409.
 *
 * @param {object}   t        tenant loaded via loadForTransition
 * @param {string}   to       target state
 * @param {object}   opts     { reason, changedBy, extras, guard(t) }
 */
async function transition(t, to, { reason = null, changedBy = "system", extras = {}, guard } = {}) {
  const from = currentLifecycleState(t);
  // Origin guard first so the operator sees "not suspended" rather than a
  // generic same-state message.
  if (guard) guard(from, t);
  if (!canTransition(from, to)) throw conflict(`Cannot move tenant from "${from}" to "${to}"`);

  const flags = legacyFlagsFor(to, { reason, ...extras });
  const lc = lifecycleUpdate(to, { reason, changedBy });
  const update = {
    $set: { ...flags.$set, ...lc.$set },
    $push: lc.$push,
  };
  if (Object.keys(flags.$unset).length) update.$unset = flags.$unset;

  const Tenant = mongoose.model("Tenant");
  const match = t.lifecycle?.state
    ? { _id: t._id, "lifecycle.state": from }
    : { _id: t._id, "lifecycle.state": null }; // matches missing AND null
  const updated = await Tenant.findOneAndUpdate(match, update, { new: true });
  if (!updated) throw conflict(`Tenant state changed concurrently (expected "${from}")`);
  return updated;
}

/**
 * Generic transition used by system paths (setup completion, merchant
 * close). Writes a system-actor audit row.
 */
export async function setLifecycleState(tenantId, state, { reason = null, changedBy = "system" } = {}) {
  const t = await loadForTransition(tenantId);
  const from = currentLifecycleState(t);
  if (from === state) return t;
  const updated = await transition(t, state, { reason, changedBy });
  await recordPlatformAudit(null, {
    action: `tenant.lifecycle.${state}`,
    resourceType: "Tenant",
    resourceId: updated._id,
    tenantId: updated._id,
    reason,
    before: { lifecycle: from },
    after: { lifecycle: state },
    metadata: { changedBy },
  });
  return updated;
}

export async function suspendTenant({ tenantId, reason, platformUserEmail }) {
  const t = await loadForTransition(tenantId);
  const why = reason || "Suspended by platform admin";
  const updated = await transition(t, LIFECYCLE_STATES.SUSPENDED, { reason: why, changedBy: platformUserEmail });
  logger.warn("Tenant suspended", { tenantId: String(updated._id), reason, by: platformUserEmail });
  return updated;
}

export async function unsuspendTenant({ tenantId, platformUserEmail, reason }) {
  const t = await loadForTransition(tenantId);
  const updated = await transition(t, LIFECYCLE_STATES.ACTIVE, {
    reason: reason || "Unsuspended by platform admin",
    changedBy: platformUserEmail,
    guard: (from) => {
      if (from !== LIFECYCLE_STATES.SUSPENDED) throw conflict(`Tenant is "${from}", not suspended`);
    },
  });
  logger.info("Tenant unsuspended", { tenantId: String(updated._id), by: platformUserEmail });
  return updated;
}

export async function scheduleTenantDeletion({ tenantId, platformUserEmail, graceDays = DELETION_GRACE_DAYS, reason }) {
  // Reject zero/negative/non-numeric explicitly, then clamp into the
  // allowed window. A grace of 0 would purge immediately — never the
  // intent — and >90 days piles up soft-deleted tenants indefinitely.
  const requested = Number(graceDays);
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new Error(`graceDays must be a positive number (1..${MAX_GRACE_DAYS})`);
  }
  const clampedGraceDays = Math.min(Math.max(Math.floor(requested), MIN_GRACE_DAYS), MAX_GRACE_DAYS);
  const scheduledAt = new Date(Date.now() + clampedGraceDays * 24 * 3600 * 1000);
  const t = await loadForTransition(tenantId);
  const updated = await transition(t, LIFECYCLE_STATES.CLOSED, {
    reason: reason || `Deletion scheduled (${clampedGraceDays}-day grace)`,
    changedBy: platformUserEmail,
    extras: { deletionScheduledAt: scheduledAt },
  });
  logger.warn("Tenant deletion scheduled", { tenantId: String(updated._id), scheduledAt, by: platformUserEmail });
  return updated;
}

export async function cancelScheduledDeletion({ tenantId, platformUserEmail }) {
  const t = await loadForTransition(tenantId);
  const updated = await transition(t, LIFECYCLE_STATES.ACTIVE, {
    reason: "Deletion cancelled",
    changedBy: platformUserEmail || "system",
    guard: (from, doc) => {
      if (from !== LIFECYCLE_STATES.CLOSED) throw conflict(`Tenant is "${from}", not closed`);
      if (!doc.deletionScheduledAt) throw conflict("Tenant has no scheduled deletion to cancel");
    },
  });
  return updated;
}

/**
 * Hard-delete every tenant-scoped document. Keeps the Tenant row itself
 * as a tombstone so cross-references (e.g. in past audit dumps) still
 * resolve to a name/email rather than a dangling ObjectId.
 *
 * SAFETY:
 *   - The tenant must be `closed` (transition table); `force` only bypasses
 *     the grace-window TIMING, never the closed prerequisite.
 *   - Uses the scoped model layer so `applyTenantScope` guarantees only
 *     this tenant's rows are touched in shared collections.
 *   - Writes a system-actor audit row for the sweep; the console path
 *     writes its own operator row in the controller (via="console" skips
 *     the system row so there is exactly one).
 */
export async function purgeTenant({ tenantId, force = false, platformUserEmail, via = "sweep" }) {
  const Tenant = mongoose.model("Tenant");
  const tenant = await loadForTransition(tenantId);
  const from = currentLifecycleState(tenant);
  if (!canTransition(from, LIFECYCLE_STATES.ARCHIVED)) {
    throw conflict(`Cannot purge a tenant that is "${from}" — schedule deletion (close) first`);
  }

  const now = Date.now();
  const scheduled = tenant.deletionScheduledAt ? new Date(tenant.deletionScheduledAt).getTime() : 0;
  if (!force && (!scheduled || scheduled > now)) {
    const err = new Error("Tenant is not past its deletion grace window; pass force=true to override");
    err.code = "GRACE_WINDOW";
    err.statusCode = 409;
    throw err;
  }

  // Tombstone FIRST (compare-and-set closed → archived). A raced
  // cancel-deletion therefore fails with 409 instead of leaving an active
  // tenant whose data was wiped; and if the wipe below partially fails the
  // tombstone remains so a re-run (or the sweep) can finish it.
  await transition(tenant, LIFECYCLE_STATES.ARCHIVED, {
    reason: force ? "Purged (forced)" : "Purged after grace period",
    changedBy: platformUserEmail || "system",
  });

  const models = createScopedModels(mongoose.connection, tenant._id);
  const collections = [
    "Product", "Category", "Order", "Cart", "User", "Review", "Wishlist",
    "Discount", "Payment", "Fulfillment", "Return", "Inventory",
    "Analytics", "SupportTicket", "CustomerSegment", "CustomField",
    "Company", "AuditLog", "Webhook", "WebhookDelivery",
  ];
  const counts = {};
  const failed = [];
  for (const name of collections) {
    const Model = models[name];
    if (!Model) continue;
    try {
      const r = await Model.deleteMany({});
      counts[name] = r.deletedCount || 0;
    } catch (err) {
      failed.push(name);
      logger.warn("purgeTenant: collection wipe failed", { tenantId: String(tenantId), name, error: err.message });
    }
  }
  logger.warn("Tenant purged", { tenantId: String(tenantId), counts, failed, via });
  if (via !== "console") {
    await recordPlatformAudit(null, {
      action: "tenant.purge",
      resourceType: "Tenant",
      resourceId: tenant._id,
      tenantId: tenant._id,
      before: { lifecycle: from },
      after: { lifecycle: LIFECYCLE_STATES.ARCHIVED },
      metadata: { via, force, counts, ...(failed.length ? { failedCollections: failed } : {}) },
      outcome: failed.length ? "failure" : "success",
    });
  }
  return { tenantId: String(tenantId), counts, failedCollections: failed };
}

export const LIFECYCLE_CONSTANTS = { DELETION_GRACE_DAYS, MIN_GRACE_DAYS, MAX_GRACE_DAYS, LIFECYCLE_HISTORY_CAP };
