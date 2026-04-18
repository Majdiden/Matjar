import express from "express";
import * as DiscountController from "../controllers/discount.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";

const router = express.Router();

// Public route for validation (used in checkout)
router.post("/validate", DiscountController.validateDiscount);

// Protected routes for management (dashboard). Gated on the named
// permissions defined in ROLE_PERMISSIONS so the role-capability matrix
// is the single source of truth — managers have `discounts.write`, so
// they can manage discounts alongside other merchandising tasks.
router.use(authenticate);
router.post("/", requirePermission("discounts.write"), DiscountController.createDiscount);
router.get("/", requirePermission("discounts.read"), DiscountController.getDiscounts);
router.put("/:id", requirePermission("discounts.write"), DiscountController.updateDiscount);
router.delete("/:id", requirePermission("discounts.write"), DiscountController.deleteDiscount);

export default router;
