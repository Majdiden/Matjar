/**
 * Global configuration registry controllers (platform admin).
 * GET returns the registry with effective values; PUT applies operator
 * overrides (flags.write + recent re-auth) and audits before/after.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { describeSettings, setSettings } from "../../services/platform/settings.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";

export const getPlatformSettings = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { settings: await describeSettings() } });
});

export const updatePlatformSettings = asyncHandler(async (req, res) => {
  const { updates, reason } = req.body;
  const { before, after } = await setSettings(updates, req.platformUser?.id);
  await recordPlatformAudit(req, {
    action: "settings.update",
    resourceType: "PlatformSettings",
    resourceId: "settings",
    reason,
    before,
    after,
  });
  res.json({ success: true, data: { settings: await describeSettings() } });
});
