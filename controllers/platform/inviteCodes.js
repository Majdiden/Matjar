/**
 * Signup invitation codes (PBI 10-47). Scope: invite_codes.manage (owners and
 * promoters); the signup mode is owner-only. Writes record a platform audit row.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import * as svc from "../../services/platform/inviteCodes.js";
import { getSignupMode, setSignupMode } from "../../services/signupAccess.js";
import { PLATFORM_ROLES } from "../../config/platformRoles.js";
import { dashboardBaseUrl } from "../../utils/notificationLinks.js";

const actorOf = (req) => ({
  id: req.platformUser.id,
  email: req.platformUser.email,
  name: req.platformUser.name,
  role: req.platformUser.role,
});

export const list = asyncHandler(async (req, res) => {
  const data = await svc.listCodes(actorOf(req), req.query);
  // Where a code is used: the dashboard signup page (code filled in from ?code=).
  data.signupUrl = `${dashboardBaseUrl()}/dashboard/register`;
  // The signup mode is shown to owners, who are the ones who can change it.
  if (req.platformUser.role === PLATFORM_ROLES.OWNER) data.signupMode = await getSignupMode();
  res.json({ success: true, data });
});

export const create = asyncHandler(async (req, res) => {
  const codes = await svc.createCodes(actorOf(req), req.body);
  await recordPlatformAudit(req, {
    action: "invite_codes.create",
    resourceType: "InviteCode",
    resourceId: codes[0]?.id || null,
    after: { count: codes.length, note: req.body.note || null },
  });
  res.status(201).json({ success: true, data: { codes } });
});

export const revoke = asyncHandler(async (req, res) => {
  const code = await svc.revokeCode(actorOf(req), req.params.id);
  await recordPlatformAudit(req, {
    action: "invite_codes.revoke",
    resourceType: "InviteCode",
    resourceId: code.id,
    after: { status: code.status },
  });
  res.json({ success: true, data: code });
});

export const store = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.codeStore(actorOf(req), req.params.tenantId) });
});

export const setMode = asyncHandler(async (req, res) => {
  const before = await getSignupMode();
  const mode = await setSignupMode(req.body.mode, req.platformUser.email);
  await recordPlatformAudit(req, {
    action: "signup_mode.update",
    resourceType: "PlatformConfig",
    resourceId: null,
    before: { mode: before },
    after: { mode },
  });
  res.json({ success: true, data: { signupMode: mode } });
});
