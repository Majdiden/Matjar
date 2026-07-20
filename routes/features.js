/**
 * GET /api/features — the effective feature flags for the current merchant
 * dashboard session. Auth-only (flags aren't secrets, and every dashboard user
 * needs them to render the right nav/pages).
 */
import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { getEffectiveFlags } from "../services/featureFlags.js";

const router = Router();

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const flags = await getEffectiveFlags();
    res.json({ success: true, data: { flags } });
  })
);

export default router;
