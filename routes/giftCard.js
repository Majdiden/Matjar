import { Router } from "express";
import * as GiftCardController from "../controllers/giftCard.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validateObjectId } from "../middlewares/platformAdmin.js";

const router = Router();

// All gift card routes require authentication
router.use(authenticate);

const vid = validateObjectId("id");

// Public-ish lookup: any authenticated user can check a code (storefront / checkout use)
router.post("/lookup", requirePermission("discounts.read"), GiftCardController.lookup);

// Redemption: internal use during checkout
router.post("/redeem", requirePermission("discounts.write"), GiftCardController.redeem);

// Admin / staff management
router.get("/", requirePermission("discounts.read"), GiftCardController.list);
router.get("/:id", vid, requirePermission("discounts.read"), GiftCardController.get);
router.post("/", requirePermission("discounts.write"), GiftCardController.issue);
router.post("/:id/adjust", vid, requirePermission("discounts.write"), GiftCardController.adjust);
router.post("/:id/disable", vid, requirePermission("discounts.write"), GiftCardController.disable);
router.post("/:id/enable", vid, requirePermission("discounts.write"), GiftCardController.enable);

export default router;
