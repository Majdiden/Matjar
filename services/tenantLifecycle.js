/**
 * Tenant lifecycle operations.
 *
 * All multi-step state changes on a tenant go through here so:
 *   - audit logging is consistent (one entry per transition);
 *   - suspension/unsuspension flip every flag the rest of the platform
 *     checks (subscriptionStatus + isActive + suspendedAt);
 *   - soft-delete schedules a grace window the purge worker acts on.
 *
 * Hard-delete (`purgeTenant`) wipes tenant-scoped documents across every
 * store-* collection and keeps the Tenant row with `deletedAt` set as
 * a tombstone for audit/compliance.
 */

import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { createScopedModels } from "../utils/scopedModel.js";

const DELETION_GRACE_DAYS = 30;
const MIN_GRACE_DAYS = 1;
const MAX_GRACE_DAYS = 90;

export async function suspendTenant({ tenantId, reason, platformUserEmail }) {
  const Tenant = mongoose.model("Tenant");
  const t = await Tenant.findByIdAndUpdate(
    tenantId,
    {
      $set: {
        subscriptionStatus: "suspended",
        suspendedAt: new Date(),
        suspensionReason: reason || "Suspended by platform admin",
      },
    },
    { new: true }
  );
  if (!t) throw new Error("Tenant not found");
  logger.warn("Tenant suspended", { tenantId: String(t._id), reason, by: platformUserEmail });
  return t;
}

export async function unsuspendTenant({ tenantId, platformUserEmail }) {
  const Tenant = mongoose.model("Tenant");
  const t = await Tenant.findByIdAndUpdate(
    tenantId,
    {
      $set: { subscriptionStatus: "active" },
      $unset: { suspendedAt: "", suspensionReason: "" },
    },
    { new: true }
  );
  if (!t) throw new Error("Tenant not found");
  logger.info("Tenant unsuspended", { tenantId: String(t._id), by: platformUserEmail });
  return t;
}

export async function scheduleTenantDeletion({ tenantId, platformUserEmail, graceDays = DELETION_GRACE_DAYS }) {
  const Tenant = mongoose.model("Tenant");
  // Reject zero/negative/non-numeric explicitly, then clamp into the
  // allowed window. A grace of 0 would purge immediately — never the
  // intent — and >90 days piles up soft-deleted tenants indefinitely.
  const requested = Number(graceDays);
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new Error(`graceDays must be a positive number (1..${MAX_GRACE_DAYS})`);
  }
  const clampedGraceDays = Math.min(Math.max(Math.floor(requested), MIN_GRACE_DAYS), MAX_GRACE_DAYS);
  const scheduledAt = new Date(Date.now() + clampedGraceDays * 24 * 3600 * 1000);
  const t = await Tenant.findByIdAndUpdate(
    tenantId,
    {
      $set: {
        deletionScheduledAt: scheduledAt,
        subscriptionStatus: "cancelled",
        isActive: false,
      },
    },
    { new: true }
  );
  if (!t) throw new Error("Tenant not found");
  logger.warn("Tenant deletion scheduled", {
    tenantId: String(t._id),
    scheduledAt,
    by: platformUserEmail,
  });
  return t;
}

export async function cancelScheduledDeletion({ tenantId }) {
  const Tenant = mongoose.model("Tenant");
  const t = await Tenant.findByIdAndUpdate(
    tenantId,
    {
      $set: { subscriptionStatus: "active", isActive: true },
      $unset: { deletionScheduledAt: "" },
    },
    { new: true }
  );
  if (!t) throw new Error("Tenant not found");
  return t;
}

/**
 * Hard-delete every tenant-scoped document. Keeps the Tenant row itself
 * as a tombstone so cross-references (e.g. in past audit dumps) still
 * resolve to a name/email rather than a dangling ObjectId.
 *
 * SAFETY:
 *   - Only runs if the tenant is explicitly marked `deletionScheduledAt`
 *     in the past OR `force` is passed (admin override).
 *   - Uses the scoped model layer so `applyTenantScope` guarantees only
 *     this tenant's rows are touched in shared collections.
 */
export async function purgeTenant({ tenantId, force = false }) {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  const now = Date.now();
  const scheduled = tenant.deletionScheduledAt?.getTime() || 0;
  if (!force && (!scheduled || scheduled > now)) {
    throw new Error("Tenant is not past its deletion grace window; pass force=true to override");
  }

  const models = createScopedModels(mongoose.connection, tenant._id);
  const collections = [
    "Product", "Category", "Order", "Cart", "User", "Review", "Wishlist",
    "Discount", "Payment", "Fulfillment", "Return", "Inventory",
    "Analytics", "SupportTicket", "CustomerSegment", "CustomField",
    "Company", "AuditLog", "Webhook", "WebhookDelivery",
  ];
  const counts = {};
  for (const name of collections) {
    const Model = models[name];
    if (!Model) continue;
    try {
      const r = await Model.deleteMany({});
      counts[name] = r.deletedCount || 0;
    } catch (err) {
      logger.warn("purgeTenant: collection wipe failed", { tenantId: String(tenantId), name, error: err.message });
    }
  }

  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { deletedAt: new Date(), isActive: false, subscriptionStatus: "cancelled" },
    $unset: { deletionScheduledAt: "" },
  });
  logger.warn("Tenant purged", { tenantId: String(tenantId), counts });
  return { tenantId: String(tenantId), counts };
}

export const LIFECYCLE_CONSTANTS = { DELETION_GRACE_DAYS, MIN_GRACE_DAYS, MAX_GRACE_DAYS };
