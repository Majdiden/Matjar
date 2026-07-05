import express from "express";
import * as AnalyticsController from "../controllers/analytics.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";

const router = express.Router();

const canRead = requirePermission("analytics.read");

router.use(authenticate);
router.get("/stats", canRead, AnalyticsController.getStats);
router.get("/sales-over-time", canRead, AnalyticsController.getSalesOverTime);
router.get("/counts-over-time", canRead, AnalyticsController.getCountsOverTime);
router.get("/top-products", canRead, AnalyticsController.getTopProducts);

export default router;
