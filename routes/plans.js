import { Router } from "express";
import { listPublicPlans } from "../controllers/plans.js";

/**
 * Public subscription-plan catalog for the marketing/landing page.
 * No auth, no tenant context — reads the platform plan catalog (admin DB)
 * and returns geo-localized display prices when the operator has enabled
 * the `billing.geoPricing` platform flag.
 */
const plansRoutes = Router();

plansRoutes.get("/", listPublicPlans);

export default plansRoutes;
