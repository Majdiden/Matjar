/**
 * Platform staff management controllers (scope platform.users unless noted).
 * Every mutation is written to the platform audit ledger.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import * as users from "../../services/platform/users.js";
import * as sessions from "../../services/platform/sessions.js";
import { adminResetMfa } from "../../services/platform/mfa.js";
import { canActOnRole } from "../../config/platformRoles.js";
import { APIError } from "../../middlewares/errorHandler.js";

export const listUsers = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: { users: await users.listPlatformUsers(), roles: users.listRoles(), notificationEvents: users.listNotificationEvents() },
  });
});

export const setNotifications = asyncHandler(async (req, res) => {
  const { events, reason } = req.body;
  const result = await users.setNotifications(req.platformUser, req.params.id, events);
  await recordPlatformAudit(req, {
    action: "platform.user.notifications_changed",
    resourceType: "PlatformUser",
    resourceId: req.params.id,
    reason,
    before: result.before,
    after: result.after,
    metadata: { email: result.user.email },
  });
  res.json({ success: true, data: result.user });
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
  const result = await users.revokeSessions(req.platformUser, req.params.id, { reason: req.body?.reason });
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

// ── Sessions ─────────────────────────────────────────────────────────────

/** GET /users/me/sessions — the caller's own active sessions. */
export const listMySessions = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await sessions.listSessions(req.platformUser.id, { currentJti: req.platformUser.jti }) });
});

/** DELETE /users/me/sessions/:sessionId — revoke one of my sessions. */
export const revokeMySession = asyncHandler(async (req, res) => {
  const s = await sessions.revokeSession({ userId: req.platformUser.id, sessionId: req.params.sessionId, reason: "revoked by user" });
  await recordPlatformAudit(req, { action: "session.revoke", resourceType: "PlatformSession", resourceId: s.id, metadata: { own: true } });
  res.json({ success: true, data: s });
});

/** DELETE /users/me/sessions — revoke all my OTHER sessions (keeps the current one). */
export const revokeMyOtherSessions = asyncHandler(async (req, res) => {
  const count = await sessions.revokeAllSessions(req.platformUser.id, "revoked by user", { exceptJti: req.platformUser.jti });
  await recordPlatformAudit(req, { action: "session.revoke_others", resourceType: "PlatformUser", resourceId: req.platformUser.id, metadata: { count } });
  res.json({ success: true, data: { revoked: count } });
});

async function assertMayManage(actor, targetId) {
  const target = await users.findPlatformUserBrief(targetId);
  if (String(actor.id) !== target.id && !canActOnRole(actor.role, target.role)) {
    throw new APIError("You cannot manage this user's sessions", 403);
  }
  return target;
}

/** GET /users/:id/sessions (platform.users) */
export const listUserSessions = asyncHandler(async (req, res) => {
  await assertMayManage(req.platformUser, req.params.id);
  res.json({ success: true, data: await sessions.listSessions(req.params.id, { includeRevoked: true }) });
});

/** DELETE /users/:id/sessions/:sessionId (platform.users) */
export const revokeUserSession = asyncHandler(async (req, res) => {
  const target = await assertMayManage(req.platformUser, req.params.id);
  const s = await sessions.revokeSession({ userId: req.params.id, sessionId: req.params.sessionId, reason: req.body?.reason || "revoked by operator" });
  await recordPlatformAudit(req, {
    action: "session.revoke",
    resourceType: "PlatformSession",
    resourceId: s.id,
    reason: req.body?.reason,
    metadata: { email: target.email, userId: target.id },
  });
  res.json({ success: true, data: s });
});

/** POST /users/:id/reset-mfa (platform.users, re-auth) — account recovery when an operator lost their device. */
export const resetUserMfa = asyncHandler(async (req, res) => {
  const target = await assertMayManage(req.platformUser, req.params.id);
  if (target.id === String(req.platformUser.id)) throw new APIError("Disable your own MFA from My security", 400);
  const result = await adminResetMfa(req.params.id);
  // Their sessions may have been established with MFA; force a fresh login.
  await users.revokeSessions(req.platformUser, req.params.id, { reason: "MFA reset by operator" });
  await recordPlatformAudit(req, {
    action: "mfa.admin_reset",
    resourceType: "PlatformUser",
    resourceId: req.params.id,
    reason: req.body?.reason,
    before: result.before,
    after: result.after,
    metadata: { email: result.email },
  });
  res.json({ success: true, data: result.after });
});
