/**
 * Platform staff management controllers (scope platform.users unless noted).
 * Every mutation is written to the platform audit ledger.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import * as users from "../../services/platform/users.js";

export const listUsers = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { users: await users.listPlatformUsers(), roles: users.listRoles() } });
});

export const changeRole = asyncHandler(async (req, res) => {
  const { role, reason } = req.body;
  const result = await users.changeRole(req.platformUser, req.params.id, role);
  await recordPlatformAudit(req, {
    action: "platform.user.role_changed",
    resourceType: "PlatformUser",
    resourceId: req.params.id,
    reason,
    before: result.before,
    after: result.after,
    metadata: { email: result.user.email },
  });
  res.json({ success: true, data: result.user });
});

export const suspendUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const result = await users.suspendUser(req.platformUser, req.params.id, reason);
  await recordPlatformAudit(req, {
    action: "platform.user.suspended",
    resourceType: "PlatformUser",
    resourceId: req.params.id,
    reason,
    before: result.before,
    after: result.after,
    metadata: { email: result.user.email },
  });
  res.json({ success: true, data: result.user });
});

export const reactivateUser = asyncHandler(async (req, res) => {
  const result = await users.reactivateUser(req.platformUser, req.params.id);
  await recordPlatformAudit(req, {
    action: "platform.user.reactivated",
    resourceType: "PlatformUser",
    resourceId: req.params.id,
    reason: req.body?.reason,
    before: result.before,
    after: result.after,
    metadata: { email: result.user.email },
  });
  res.json({ success: true, data: result.user });
});

export const revokeSessions = asyncHandler(async (req, res) => {
  const result = await users.revokeSessions(req.platformUser, req.params.id);
  await recordPlatformAudit(req, {
    action: "platform.user.sessions_revoked",
    resourceType: "PlatformUser",
    resourceId: req.params.id,
    reason: req.body?.reason,
    metadata: { email: result.user.email },
  });
  res.json({ success: true, data: result.user });
});

export const forcePasswordReset = asyncHandler(async (req, res) => {
  const result = await users.forcePasswordReset(req.platformUser, req, req.params.id);
  await recordPlatformAudit(req, {
    action: "platform.user.password_reset_forced",
    resourceType: "PlatformUser",
    resourceId: req.params.id,
    reason: req.body?.reason,
    metadata: { email: result.user.email },
  });
  res.json({ success: true, data: result.user });
});

/** Authenticated self-service password change (also clears mustResetPassword). */
export const changeOwnPassword = asyncHandler(async (req, res) => {
  const { currentPassword, password } = req.body;
  await users.changeOwnPassword(req.platformUser, currentPassword, password);
  await recordPlatformAudit(req, {
    action: "platform.user.password_changed",
    resourceType: "PlatformUser",
    resourceId: req.platformUser.id,
  });
  // The token version was bumped — the client must sign in again.
  res.json({ success: true, message: "Password changed. Sign in again with your new password." });
});

// ── Invites ──────────────────────────────────────────────────────────────

export const listInvites = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await users.listInvites() });
});

export const createInvite = asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  const invite = await users.createInvite(req.platformUser, req, { email, role });
  await recordPlatformAudit(req, {
    action: "platform.user.invited",
    resourceType: "PlatformInvite",
    resourceId: invite.id,
    after: { email, role },
  });
  res.status(201).json({ success: true, data: invite });
});

export const resendInvite = asyncHandler(async (req, res) => {
  const invite = await users.resendInvite(req.platformUser, req, req.params.id);
  await recordPlatformAudit(req, {
    action: "platform.user.invite_resent",
    resourceType: "PlatformInvite",
    resourceId: invite.id,
    metadata: { email: invite.email },
  });
  res.json({ success: true, data: invite });
});

export const revokeInvite = asyncHandler(async (req, res) => {
  const invite = await users.revokeInvite(req.platformUser, req.params.id);
  await recordPlatformAudit(req, {
    action: "platform.user.invite_revoked",
    resourceType: "PlatformInvite",
    resourceId: invite.id,
    metadata: { email: invite.email },
  });
  res.json({ success: true, data: invite });
});
