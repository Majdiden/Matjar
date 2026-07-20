/**
 * Route-level feature gate. Place AFTER authenticate/requirePermission so the
 * chain is: authenticated → authorised → feature-enabled.
 *
 * Returns 403 with a machine-readable `code:"FEATURE_DISABLED"` (not 404) — these
 * are authenticated dashboard APIs, so existence-hiding is pointless, and the
 * dashboard maps the code to a clean "not available" state. Storefront-facing
 * surfaces never use this — they filter data instead.
 */
import { isFeatureEnabled } from "../services/featureFlags.js";

export const requireFeature = (flagKey) => async (req, res, next) => {
  try {
    if (await isFeatureEnabled(flagKey)) return next();
    return res.status(403).json({
      success: false,
      code: "FEATURE_DISABLED",
      feature: flagKey,
      message: "This feature is not available.",
    });
  } catch (err) {
    next(err);
  }
};

export default requireFeature;
