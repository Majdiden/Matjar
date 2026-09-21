import { Router } from "express";
import { requireScope, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  platformAnalyticsSchema,
  commerceAnalyticsSchema,
  revenueAnalyticsSchema,
  usageAnalyticsSchema,
} from "../../validators/analytics.validator.js";
import * as c from "../../controllers/platform/analytics.js";

// Platform analytics — read-only aggregates. Mounted behind platformAuthenticate
// at /api/platform/analytics. Revenue is the only group that needs billing.read;
// the others are visible to any support.read operator.
const router = Router({ mergeParams: true });

router.get("/platform", requireScope(PLATFORM_SCOPES.SUPPORT_READ), validate(platformAnalyticsSchema), c.platform);
router.get("/commerce", requireScope(PLATFORM_SCOPES.SUPPORT_READ), validate(commerceAnalyticsSchema), c.commerce);
router.get("/revenue", requireScope(PLATFORM_SCOPES.BILLING_READ), validate(revenueAnalyticsSchema), c.revenue);
router.get("/usage", requireScope(PLATFORM_SCOPES.SUPPORT_READ), validate(usageAnalyticsSchema), c.usage);

export default router;
