/**
 * GET /api/features — the effective feature flags for the current merchant
 * dashboard session. Auth-only (flags aren't secrets, and every dashboard user
 * needs them to render the right nav/pages).
 *
 * Phase B: resolved PER TENANT (global → plan entitlement → access program →
 * tenant override). Only the tenant's own effective values are returned —
 * booleans plus the global stringList flags — never the layer breakdown, other
 * tenants, or override reasons (those are platform-admin only).
 */
import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { getEffectiveFlags, resolveTenantFeatures } from "../services/featureFlags.js";

const router = Router();

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const tenant = req.tenant;
    if (!tenant?._id) {
      const flags = await getEffectiveFlags();
      return res.json({ success: true, data: { flags } });
    }
    const { flags } = await resolveTenantFeatures({
      _id: tenant._id,
      subscriptionPlan: tenant.subscriptionPlan,
      accessPrograms: tenant.accessPrograms,
    });
    res.json({ success: true, data: { flags } });
  })
);

export default router;
