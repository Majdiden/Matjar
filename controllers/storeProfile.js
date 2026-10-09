import * as StoreProfileService from "../services/storeProfile.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { logAudit } from "../utils/audit.js";
import { refreshGeneratedAboutService } from "../services/storePages.js";
import logger from "../utils/logger.js";

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
  // The generated About page names the store: rewrite it with the new name
  // (unless the merchant rewrote it by hand). Best effort — the profile is saved.
  if ("settings.storeName" in (changes.$set || {}) || "settings.storeName" in (changes.$unset || {})) {
    await refreshGeneratedAboutService(req.models, req.tenantId).catch((err) =>
      logger.warn("store profile: About page not refreshed after rename", { tenantId: String(req.tenantId), error: err?.message })
    );
  }
  res.json({ success: true, data: profile });
});
