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

/**
 * PUT /api/platform/features
 * body: { updates: [{ key, value }, ...] }
 *
 * Flag ids ride as VALUES (not object keys) because the global
 * express-mongo-sanitize strips dots from request KEYS, which would otherwise
 * mangle dotted flag ids like "payments.methods". `overrides` (object map) is
 * still accepted for back-compat.
 */
export const updatePlatformFeatures = asyncHandler(async (req, res) => {
  const updates = req.body?.updates ?? req.body?.overrides ?? [];
  const flags = await setFeatureOverrides(updates, req.platformUser?.id);
  res.json({ success: true, data: { flags } });
});
