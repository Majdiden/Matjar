import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { requireFeature } from "../middlewares/featureGate.js";
import { createMarket, getMarkets, updateMarket, deleteMarket, resolveMarket } from "../controllers/market.js";

const router = Router();

// Public — storefront market resolution
router.get("/resolve", resolveMarket);

// Admin — market management
router.use(authenticate, requirePermission("settings.write"), requireFeature("settings.markets"));
router.post("/", createMarket);
router.get("/", getMarkets);
router.put("/:id", updateMarket);
router.delete("/:id", deleteMarket);

export default router;
