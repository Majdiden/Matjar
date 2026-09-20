import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import {
  loadTenant,
  assertTenantWritable,
  listTenantStaff,
  listTenantInvites,
  revokeTenantStaff,
  reactivateTenantStaff,
  resendTenantInvite,
  revokeTenantInvite,
} from "../../services/platform/tenantUsers.js";

// `reason` is validated by reasonRequiredSchema at the route (4–500 chars).

export const listStaff = asyncHandler(async (req, res) => {
  await loadTenant(req.params.tenantId);
  res.json({ success: true, data: await listTenantStaff(req.params.tenantId) });
});

export const listInvites = asyncHandler(async (req, res) => {
  await loadTenant(req.params.tenantId);
  res.json({ success: true, data: await listTenantInvites(req.params.tenantId) });
});

export const revokeStaff = asyncHandler(async (req, res) => {
  const { tenantId, userId } = req.params;
  assertTenantWritable(await loadTenant(tenantId));
  const diff = await revokeTenantStaff(tenantId, userId);
  await recordPlatformAudit(req, {
    action: "tenant.staff.revoke",
    resourceType: "User",
    resourceId: userId,
    tenantId,
    reason: req.body.reason,
    ...diff,
  });
  res.json({ success: true, data: { userId, isActive: false } });
});

export const reactivateStaff = asyncHandler(async (req, res) => {
  const { tenantId, userId } = req.params;
  assertTenantWritable(await loadTenant(tenantId));
  const diff = await reactivateTenantStaff(tenantId, userId);
  await recordPlatformAudit(req, {
    action: "tenant.staff.reactivate",
    resourceType: "User",
    resourceId: userId,
    tenantId,
    reason: req.body.reason,
    ...diff,
  });
  res.json({ success: true, data: { userId, isActive: true } });
});

export const resendInvite = asyncHandler(async (req, res) => {
  const { tenantId, inviteId } = req.params;
  const tenant = await loadTenant(tenantId);
  assertTenantWritable(tenant);
  const diff = await resendTenantInvite(tenant, inviteId);
  await recordPlatformAudit(req, {
    action: "tenant.staff.invite.resend",
    resourceType: "StaffInvite",
    resourceId: inviteId,
    tenantId,
    reason: req.body.reason,
    ...diff,
  });
  res.json({ success: true, data: diff.after });
});

export const revokeInvite = asyncHandler(async (req, res) => {
  const { tenantId, inviteId } = req.params;
  const tenant = await loadTenant(tenantId);
  assertTenantWritable(tenant);
  const diff = await revokeTenantInvite(tenant, inviteId);
  await recordPlatformAudit(req, {
    action: "tenant.staff.invite.revoke",
    resourceType: "StaffInvite",
    resourceId: inviteId,
    tenantId,
    reason: req.body.reason,
    ...diff,
  });
  res.json({ success: true, data: { inviteId, revoked: true } });
});
