// Usage refresh. Mount: router.use("/usage", usageRoutes) in routes/platformAdmin.js.
//   POST /usage/refresh/:tenantId   tenant.lifecycle (it writes a snapshot row)
//   Rate-limited to 10/min per operator (a snapshot counts every collection).
import { Router } from "express";
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { ipKeyGenerator } from "express-rate-limit";
import { createRateLimiter } from "../../middlewares/rateLimiters.js";
import * as usage from "../../controllers/platform/usage.js";

const MINUTE = 60 * 1000;
const refreshLimiter = createRateLimiter({
  prefix: "platform:usage-refresh",
  windowMs: MINUTE,
  max: 10,
  keyGenerator: (req) => `u:${req.platformUser?.id || ipKeyGenerator(req.ip)}`,
  message: "Too many usage refreshes. Try again in a minute.",
});

const router = Router();
router.post(
  "/refresh/:tenantId",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  refreshLimiter,
  usage.refreshTenant
);

export default router;
