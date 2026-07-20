import express from "express";
import * as SettingsController from "../controllers/settings.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { requireFeature } from "../middlewares/featureGate.js";

const router = express.Router();

const canRead = requirePermission("settings.read", "settings.write");
const canWrite = requirePermission("settings.write");

router.use(authenticate);
router.put("/", canWrite, SettingsController.updateSettings);

// Shipping zones — granular CRUD so the dashboard can edit one zone at a
// time without re-sending the entire settings blob.
router.get("/shipping/zones", canRead, SettingsController.listShippingZones);
router.post("/shipping/zones", canWrite, SettingsController.createShippingZone);
router.put("/shipping/zones/:zoneId", canWrite, SettingsController.updateShippingZone);
router.delete("/shipping/zones/:zoneId", canWrite, SettingsController.deleteShippingZone);

// Tax rates — granular CRUD. The bulk PUT still works for one-shot
// imports; these endpoints exist for the dashboard's per-row UX.
const taxEnabled = requireFeature("settings.tax");
router.get("/tax/rates", canRead, taxEnabled, SettingsController.listTaxRates);
router.post("/tax/rates", canWrite, taxEnabled, SettingsController.createTaxRate);
router.put("/tax/rates/:rateId", canWrite, taxEnabled, SettingsController.updateTaxRate);
router.delete("/tax/rates/:rateId", canWrite, taxEnabled, SettingsController.deleteTaxRate);

// Markets — Shopify-style geographic groupings (countries → currency,
// language, price adjustment). The bulk PUT still works for one-shot
// imports; per-row endpoints exist for the dashboard's UX.
const marketsEnabled = requireFeature("settings.markets");
router.get("/markets", canRead, marketsEnabled, SettingsController.listMarkets);
router.post("/markets", canWrite, marketsEnabled, SettingsController.createMarket);
router.put("/markets/:marketId", canWrite, marketsEnabled, SettingsController.updateMarket);
router.delete("/markets/:marketId", canWrite, marketsEnabled, SettingsController.deleteMarket);

// Currencies — base currency + FX rates table. PUT replaces the rates map
// wholesale (no partial-merge surprises).
router.put("/currencies", canWrite, requireFeature("settings.currencies"), SettingsController.updateCurrencies);

// Order status notifications — per-status email template config. PUT
// merges per-status (so the merchant can edit one template without
// re-sending the others).
router.get("/notifications", canRead, SettingsController.getNotifications);
router.put("/notifications", canWrite, SettingsController.updateNotifications);

export default router;
