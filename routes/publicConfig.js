/**
 * Public platform configuration for merchant-facing pickers: the operator-
 * enabled store base currencies and shipping/market countries (Platform →
 * Global configuration). No auth, no tenant context, cache-friendly, and
 * strictly limited to those two lists — nothing else from the registry is
 * public.
 */
import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { getEffectiveSettings } from "../services/platform/settings.js";

const router = Router();

router.get(
  "/public",
  asyncHandler(async (_req, res) => {
    const s = await getEffectiveSettings();
    res.set("Cache-Control", "public, max-age=60");
    res.json({
      success: true,
      responseObject: {
        currencies: s["commerce.baseCurrencies"],
        countries: s["commerce.countries"],
      },
    });
  })
);

export default router;
