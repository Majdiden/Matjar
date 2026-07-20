/**
 * Platform-admin feature-flag controllers. Thin wrappers over the service; the
 * response carries the full registry so the admin UI renders itself.
 */
import { asyncHandler } from "../middlewares/errorHandler.js";
import { FEATURE_REGISTRY } from "../config/featureFlags.js";
import {
  getEffectiveFlags,
  setFeatureOverrides,
} from "../services/featureFlags.js";
import { getBuiltInThemeSlugs } from "../services/themeManifestRegistry.js";

/** GET /api/platform/features */
export const getPlatformFeatures = asyncHandler(async (req, res) => {
  const flags = await getEffectiveFlags();
  res.json({
    success: true,
    data: {
      registry: FEATURE_REGISTRY,
      flags,
      themeSlugs: getBuiltInThemeSlugs(),
    },
  });
});

/** PUT /api/platform/features  body: { overrides: { key: value, ... } } */
export const updatePlatformFeatures = asyncHandler(async (req, res) => {
  const overrides = req.body?.overrides || {};
  const flags = await setFeatureOverrides(overrides, req.platformUser?.id);
  res.json({ success: true, data: { flags } });
});
