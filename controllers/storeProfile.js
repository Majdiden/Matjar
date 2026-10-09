import * as StoreProfileService from "../services/storeProfile.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { logAudit } from "../utils/audit.js";

/**
 * Store profile controllers (PBI 10 — brand kit). Dashboard-facing; the
 * storefront reads the same data through GET /storefront/store-info.
 */

export const getStoreProfile = asyncHandler(async (req, res) => {
  const profile = await StoreProfileService.getStoreProfileService(req.tenantId);
  res.json({ success: true, data: profile });
});

export const updateStoreProfile = asyncHandler(async (req, res) => {
  const { profile, changes } = await StoreProfileService.updateStoreProfileService(
    req.tenantId,
    req.body || {}
  );
  logAudit(req.models, {
    action: "settings.profile.updated",
    resource: "Settings",
    resourceId: req.tenantId,
    changes,
    req,
  });
  res.json({ success: true, data: profile });
});
