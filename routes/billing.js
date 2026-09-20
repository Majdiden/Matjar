import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { merchantPlanChangeSchema } from "../validators/billing.validator.js";
import { getBillingSummary, requestPlanChange, cancelPlanChangeRequest } from "../controllers/billing.js";

/**
 * Merchant billing — the store's own plan, effective pricing, current-period
 * accruals and statements. Tenant-scoped by `authenticate`; the controllers
 * only ever read `req.tenant`. Reads need settings.read; a plan change is a
 * store-wide configuration change and needs settings.write.
 */
const billingRoutes = Router();
billingRoutes.use(authenticate);

billingRoutes.get("/summary", requirePermission("settings.read", "settings.write"), getBillingSummary);
billingRoutes.post("/plan-change", requirePermission("settings.write"), validate(merchantPlanChangeSchema), requestPlanChange);
billingRoutes.post("/plan-change/cancel", requirePermission("settings.write"), cancelPlanChangeRequest);

export default billingRoutes;
