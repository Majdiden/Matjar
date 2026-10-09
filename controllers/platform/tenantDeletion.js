/**
 * Permanent store deletion — single and bulk.
 *
 * Route guards (see routes/platformAdmin.js, routes/platform/bulk.js):
 * scope `tenant.delete` (owner by default, grantable by an owner) → body
 * validation → requirePasswordConfirmation. Here: the typed confirmation
 * must match, then services/tenantDeletion.js does the work.
 *
 * Every store gets its own `tenant.delete_permanently` audit row (success or
 * failure) and owners are emailed. Bulk runs stores sequentially; one store
 * failing never stops the others.
 */
import mongoose from "mongoose";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import { notifyPlatform } from "../../services/platform/notifications.js";
import { hardDeleteTenant, RETAINED_PLATFORM_RECORDS, RETAINED_STORE_COLLECTIONS } from "../../services/tenantDeletion.js";
import logger from "../../utils/logger.js";

const AUDIT_ACTION = "tenant.delete_permanently";

const loadTenantBrief = (tenantId) =>
  mongoose
    .model("Tenant")
    .findById(tenantId)
    .select("name slug domain settings.storeName lifecycle.state isActive deletedAt")
    .lean();

const brief = (t) => ({
  name: t.settings?.storeName || t.name,
  slug: t.slug,
  domain: t.domain,
  lifecycle: t.lifecycle?.state || null,
});

/**
 * Delete one already-loaded store and write its audit row.
 * @returns per-store outcome for the response.
 */
async function deleteOne(req, tenant, { reason, batchId }) {
  const before = brief(tenant);
  const bulk = !!batchId;
  try {
    const result = await hardDeleteTenant(tenant._id);
    await recordPlatformAudit(req, {
      action: AUDIT_ACTION,
      resourceType: "Tenant",
      resourceId: tenant._id,
      tenantId: tenant._id,
      reason,
      before,
      after: result.completed ? null : { deletedAt: new Date(), incomplete: true },
      outcome: result.completed ? "success" : "failure",
      metadata: {
        bulk,
        ...(batchId ? { batchId } : {}),
        counts: result.counts,
        files: result.files,
        ...(result.failed.length ? { failedSteps: result.failed } : {}),
        retained: [...RETAINED_STORE_COLLECTIONS, ...RETAINED_PLATFORM_RECORDS],
      },
    });
    return { tenantId: String(tenant._id), ...before, ok: result.completed, files: result.files, failed: result.failed };
  } catch (err) {
    logger.error("Permanent store deletion failed", { tenantId: String(tenant._id), error: err.message });
    await recordPlatformAudit(req, {
      action: AUDIT_ACTION,
      resourceType: "Tenant",
      resourceId: tenant._id,
      tenantId: tenant._id,
      reason,
      before,
      outcome: "failure",
      metadata: { bulk, ...(batchId ? { batchId } : {}), error: err.message },
    });
    return { tenantId: String(tenant._id), ...before, ok: false, error: "Deletion failed. Run it again to finish." };
  }
}

function alertOwners(req, deleted, reason) {
  if (!deleted.length) return;
  void notifyPlatform("tenant.deleted_permanently", {
    subject: deleted.length === 1
      ? `Store permanently deleted: ${deleted[0].name}`
      : `${deleted.length} stores permanently deleted`,
    lines: [
      `By: ${req.platformUser.email}`,
      `Reason: ${reason}`,
      ...deleted.map((d) => `• ${d.name} (${d.domain || d.slug})`),
    ],
    link: "/audit",
  });
}

/** POST /api/platform/tenants/:tenantId/delete-permanently */
export const deleteTenantPermanently = asyncHandler(async (req, res) => {
  const { confirmSlug, reason } = req.body;
  const tenant = await loadTenantBrief(req.params.tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: "Store not found." });
  if (confirmSlug !== tenant.slug) {
    return res.status(400).json({
      success: false,
      code: "CONFIRMATION_MISMATCH",
      message: "The store name you typed doesn't match.",
    });
  }

  const outcome = await deleteOne(req, tenant, { reason });
  if (outcome.ok) alertOwners(req, [outcome], reason);
  res.status(outcome.ok ? 200 : 500).json({
    success: outcome.ok,
    ...(outcome.ok ? {} : { message: outcome.error || "Some data could not be deleted. Run it again to finish." }),
    data: outcome,
  });
});

/** POST /api/platform/bulk/tenants/delete-permanently */
export const deleteTenantsPermanently = asyncHandler(async (req, res) => {
  const { tenantIds, reason } = req.body;
  const batchId = `bulk-delete-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const results = [];
  for (const tenantId of tenantIds) {
    const tenant = await loadTenantBrief(tenantId);
    if (!tenant) {
      results.push({ tenantId, ok: false, error: "Store not found.", code: 404 });
      continue;
    }
    results.push(await deleteOne(req, tenant, { reason, batchId }));
  }

  const ok = results.filter((r) => r.ok);
  const summary = { total: results.length, ok: ok.length, failed: results.length - ok.length };
  await recordPlatformAudit(req, {
    action: "bulk.tenants",
    resourceType: "BulkAction",
    resourceId: batchId,
    reason,
    outcome: summary.failed ? "failure" : "success",
    metadata: { action: "delete_permanently", ...summary },
  });
  alertOwners(req, ok, reason);
  res.json({ success: true, data: { batchId, results, summary } });
});
