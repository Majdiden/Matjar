/**
 * Platform security settings controllers (owner-only writes, re-auth gated
 * in routes/platform/security.js).
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import { getSecuritySettings, setSecuritySettings } from "../../services/platform/security.js";
import { listRoles } from "../../services/platform/users.js";

export const getSecurity = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { settings: await getSecuritySettings(), roles: listRoles() } });
});

export const updateSecurity = asyncHandler(async (req, res) => {
  const { before, after } = await setSecuritySettings({ requireMfaForRoles: req.body.requireMfaForRoles }, req.platformUser.id);
  await recordPlatformAudit(req, {
    action: "security.settings.update",
    resourceType: "PlatformConfig",
    resourceId: "security",
    before,
    after,
  });
  res.json({ success: true, data: { settings: after } });
});
