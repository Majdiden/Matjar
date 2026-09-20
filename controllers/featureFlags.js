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
import { recordPlatformAudit } from "../services/platform/audit.js";
import { flagOverrideCounts } from "../services/platform/programs.js";

/**
 * GET /api/platform/features
 * `overrides` (Phase B): per flag, which non-closed programs switch it on/off
 * and how many tenants carry a live tenant override — the "where is this on?"
 * view. Fails soft to {} so the global panel still renders.
 */
export const getPlatformFeatures = asyncHandler(async (req, res) => {
  const flags = await getEffectiveFlags();
  const overrides = await flagOverrideCounts().catch(() => ({}));
  res.json({
    success: true,
    data: {
      registry: FEATURE_REGISTRY,
      flags,
      themeSlugs: getBuiltInThemeSlugs(),
      overrides,
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
  const before = await getEffectiveFlags();
  const flags = await setFeatureOverrides(updates, req.platformUser?.id);
  // Audit only the keys that actually changed (before/after per key).
  const changed = {};
  for (const k of Object.keys(flags)) {
    if (JSON.stringify(before[k]) !== JSON.stringify(flags[k])) changed[k] = { from: before[k], to: flags[k] };
  }
  await recordPlatformAudit(req, {
    action: "flags.update",
    resourceType: "PlatformConfig",
    resourceId: "features",
    before: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.from])),
    after: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.to])),
    metadata: { keys: Object.keys(changed) },
  });
  res.json({ success: true, data: { flags } });
});
