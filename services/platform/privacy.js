/**
 * Customer privacy operations run by a platform operator on a merchant's
 * behalf (right-to-erasure / access requests).
 *
 * Every operation goes through the tenant's scoped models, refuses closed /
 * archived / deleted tenants, only ever touches CUSTOMER accounts (never
 * staff), and is audited by the caller on BOTH the platform ledger and the
 * tenant's own AuditLog so the merchant can see it happened.
 */
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { APIError } from "../../middlewares/errorHandler.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { anonymizeCustomer } from "../customerPrivacy.js";
import { currentLifecycleState } from "../tenantLifecycle.js";
import { enqueueTenantExport } from "../jobs/index.js";
import { STAFF_ROLES } from "../staff.js";

async function loadTenantForPrivacy(tenantId) {
  const Tenant = mongoose.model("Tenant");
  const t = await Tenant.findById(tenantId)
    .select("_id name slug deletedAt lifecycle subscriptionStatus isActive suspendedAt deletionScheduledAt setupStatus")
    .lean();
  if (!t || t.deletedAt) throw new APIError("Tenant not found", 404);
  const state = currentLifecycleState(t);
  if (state === "closed" || state === "archived") {
    throw new APIError(`Tenant is ${state}; privacy operations are not available`, 409);
  }
  return t;
}

function publicCustomer(u, ordersCount) {
  return {
    id: String(u._id),
    name: u.name || null,
    email: u.email,
    isActive: u.isActive !== false,
    anonymizedAt: u.anonymizedAt || null,
    createdAt: u.createdAt,
    ordersCount,
  };
}

/** Exact lowercase email match; customers only. Returns [] when none. */
export async function lookupCustomer(tenantId, email) {
  await loadTenantForPrivacy(tenantId);
  const models = createScopedModels(mongoose.connection, tenantId);
  const users = await models.User.find({ email: String(email).toLowerCase(), roles: { $nin: STAFF_ROLES } })
    .select("_id name email isActive anonymizedAt createdAt")
    .limit(5)
    .lean();
  const out = [];
  for (const u of users) {
    const ordersCount = await models.Order.countDocuments({ user: u._id });
    out.push(publicCustomer(u, ordersCount));
  }
  return out;
}

async function loadCustomer(models, userId) {
  const u = await models.User.findById(userId).select("_id name email roles isActive anonymizedAt").lean();
  if (!u) throw new APIError("Customer not found", 404);
  if ((u.roles || []).some((r) => STAFF_ROLES.includes(r))) {
    throw new APIError("That account is store staff, not a customer", 409);
  }
  return u;
}

/** Erase a customer's PII (orders kept, identifiers redacted). */
export async function anonymiseCustomer(tenantId, userId) {
  const tenant = await loadTenantForPrivacy(tenantId);
  const models = createScopedModels(mongoose.connection, tenantId);
  const u = await loadCustomer(models, userId);
  if (u.anonymizedAt) throw new APIError("Customer is already anonymised", 409);
  // The platform ledger is append-only, so it must never hold the identifiers
  // being erased; a hash is enough to correlate a later query by email.
  const before = { emailHash: createHash("sha256").update(String(u.email).toLowerCase()).digest("hex"), isActive: u.isActive !== false };
  const result = await anonymizeCustomer(models, u._id);
  return { tenant, models, before, after: { anonymizedAt: result.anonymizedAt }, userId: String(u._id) };
}

/**
 * Queue a customer-scoped export. The file is produced by the export worker
 * and downloaded through the existing audited platform download route —
 * never returned inline.
 */
export async function requestCustomerExport(tenantId, userId, requestedBy) {
  const tenant = await loadTenantForPrivacy(tenantId);
  const models = createScopedModels(mongoose.connection, tenantId);
  const u = await loadCustomer(models, userId);
  const TenantExport = mongoose.model("TenantExport");
  const row = await TenantExport.create({
    tenantId: tenant._id,
    requestedBy,
    scope: "customer",
    subjectUserId: u._id,
    status: "pending",
  });
  await enqueueTenantExport(tenant._id, row._id, { source: "platform-privacy" });
  return {
    tenant,
    models,
    userId: String(u._id),
    exportId: String(row._id),
    status: row.status,
    statusUrl: `/api/platform/tenants/${tenant._id}/exports/${row._id}`,
  };
}
