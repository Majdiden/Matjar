/**
 * Usage & limits (platform admin, Phase B — read + on-demand refresh only,
 * no enforcement). Limit overrides are lifecycle-scoped and audited.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import * as svc from "../../services/platform/usage.js";

export const getTenantUsage = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.getTenantUsage(req.params.tenantId) });
});

export const refreshTenant = asyncHandler(async (req, res) => {
  // Throttle: a snapshot is a full count over the tenant's collections. If an
  // operator already took one in the last minute, serve that instead.
  const recent = await svc.recentOperatorSnapshot(req.params.tenantId);
  if (recent) {
    return res.json({ success: true, data: await svc.getTenantUsage(req.params.tenantId), skipped: "recent-snapshot" });
  }
  const snap = await svc.snapshotTenant(req.params.tenantId, "operator");
  await recordPlatformAudit(req, {
    action: "usage.refresh",
    resourceType: "TenantUsageSnapshot",
    resourceId: snap._id,
    tenantId: req.params.tenantId,
    after: { products: snap.products, staff: snap.staff, ordersThisMonth: snap.ordersThisMonth, storageMB: snap.storageMB },
  });
  res.json({ success: true, data: await svc.getTenantUsage(req.params.tenantId) });
});

export const setLimitOverrides = asyncHandler(async (req, res) => {
  const { before, after } = await svc.setTenantLimitOverrides(req.params.tenantId, req.body.limitOverrides, req.body.reason);
  await recordPlatformAudit(req, {
    action: "tenant.limits.override",
    resourceType: "Tenant",
    resourceId: req.params.tenantId,
    tenantId: req.params.tenantId,
    reason: req.body.reason,
    before,
    after,
  });
  res.json({ success: true, data: await svc.getTenantUsage(req.params.tenantId) });
});
