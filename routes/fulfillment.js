import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { createFulfillment, getFulfillments, updateFulfillment } from "../controllers/fulfillment.js";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("fulfillments.read", "fulfillments.write"), getFulfillments);
router.post("/", requirePermission("fulfillments.write"), createFulfillment);
router.put("/:id", requirePermission("fulfillments.write"), updateFulfillment);
router.patch("/:id/status", requirePermission("fulfillments.write"), updateFulfillment);

export default router;
