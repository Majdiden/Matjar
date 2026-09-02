import mongoose from "mongoose";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { localizePrice, detectCountry } from "../services/geoPricing.js";
import { isFeatureEnabled } from "../services/featureFlags.js";

/**
 * @route   GET /api/plans
 * @desc    Public subscription-plan catalog for the marketing/landing page.
 *          Each plan carries its stored base price AND an approximate price
 *          in the visitor's local currency (geo-detected from edge headers),
 *          so the landing can show a familiar figure instead of raw SDG.
 * @access  Public
 */
export const listPublicPlans = asyncHandler(async (req, res) => {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const plans = await SubscriptionPlan.find({ isActive: true })
    .sort({ sortOrder: 1, key: 1 })
    .lean();

  // Geo-localized display pricing is a platform-operator toggle. When OFF,
  // every plan shows its base currency as-is (no conversion, no geo lookup).
  const geoEnabled = await isFeatureEnabled("billing.geoPricing");

  const data = plans.map((p) => {
    const baseCurrency = String(p.currency || "SDG").toUpperCase();
    const local = geoEnabled
      ? localizePrice(req, p.price, baseCurrency)
      : {
          displayPrice: Math.round(Number(p.price) || 0),
          displayCurrency: baseCurrency,
          converted: false,
        };
    return {
      key: p.key,
      name: p.name,
      description: p.description || "",
      interval: p.interval || "month",
      features: p.features || [],
      limits: p.limits || {},
      // Source of truth (what a tenant is actually billed in).
      basePrice: Math.round(Number(p.price) || 0),
      baseCurrency,
      // Approximate, geo-localized figure for display only.
      displayPrice: local.displayPrice,
      displayCurrency: local.displayCurrency,
      priceConverted: local.converted,
    };
  });

  res.json({
    success: true,
    // Surface the detected country so the client can label the price as
    // approximate / offer a manual currency switch if it wants to.
    data: { plans: data, country: geoEnabled ? detectCountry(req) : null },
  });
});
