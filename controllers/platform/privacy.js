/**
 * Privacy operation controllers (platform side). Routes enforce
 * tenant.export + requireRecentReauth for the mutations; every mutation is
 * recorded on the platform ledger AND the tenant's AuditLog.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import { logAudit } from "../../utils/audit.js";
import * as svc from "../../services/platform/privacy.js";

function tenantAudit(models, req, action, resourceId, metadata) {
  logAudit(models, {
    action,
    resource: "User",
    resourceId,
    actorName: `platform:${req.platformUser.email}`,
    metadata: { ...metadata, platformUserId: req.platformUser.id },
    req,
  });
}

export const lookup = asyncHandler(async (req, res) => {
  const customers = await svc.lookupCustomer(req.params.tenantId, req.query.email);
  // PII read: audited without the queried email (only whether it matched).
  await recordPlatformAudit(req, {
    action: "privacy.customer.lookup",
    resourceType: "Tenant",
    resourceId: req.params.tenantId,
    tenantId: req.params.tenantId,
    metadata: { matches: customers.length },
  });
  res.json({ success: true, data: { customers } });
});

export const anonymise = asyncHandler(async (req, res) => {
  const r = await svc.anonymiseCustomer(req.params.tenantId, req.params.userId);
  await recordPlatformAudit(req, {
    action: "privacy.customer.anonymise",
    resourceType: "User",
    resourceId: r.userId,
    tenantId: r.tenant._id,
    reason: req.body.reason,
    before: r.before,
    after: r.after,
  });
  tenantAudit(r.models, req, "privacy.customer_anonymised", r.userId, { reason: req.body.reason });
  res.json({ success: true, data: { userId: r.userId, anonymizedAt: r.after.anonymizedAt } });
});

export const requestExport = asyncHandler(async (req, res) => {
  const r = await svc.requestCustomerExport(req.params.tenantId, req.params.userId, req.platformUser.email);
  await recordPlatformAudit(req, {
    action: "privacy.customer.export_request",
    resourceType: "TenantExport",
    resourceId: r.exportId,
    tenantId: r.tenant._id,
    reason: req.body.reason,
    metadata: { subjectUserId: r.userId },
  });
  tenantAudit(r.models, req, "privacy.customer_export_requested", r.userId, {
    reason: req.body.reason,
    exportId: r.exportId,
  });
  res.status(202).json({ success: true, data: { exportId: r.exportId, status: r.status, statusUrl: r.statusUrl } });
});
