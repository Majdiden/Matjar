import { Router } from "express";
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import { createRateLimiter } from "../../middlewares/rateLimiters.js";
import { uploadSingleImage, handleUploadError, validateUploadedFiles } from "../../middlewares/upload.js";
import { ipKeyGenerator } from "express-rate-limit";
import {
  listDomainsSchema,
  domainActionSchema,
  domainRemoveSchema,
  themeStatusSchema,
  themeDetailsSchema,
  themeStoresSchema,
  listHealthSchema,
} from "../../validators/commerce.validator.js";
import {
  domains,
  domainRetry,
  domainSetPrimary,
  domainRemove,
  themes,
  themeStores,
  themeStatus,
  themeDetails,
  themeCover,
  health,
  tenantHealth,
  runTenantCheck,
} from "../../controllers/platform/storefront.js";

// Mounted at /api/platform/storefront behind platformAuthenticate.
const router = Router({ mergeParams: true });
const read = requireScope(PLATFORM_SCOPES.SUPPORT_READ);

// On-demand probes make outbound requests — cap them per operator.
const healthCheckLimiter = createRateLimiter({
  prefix: "platform:health-check",
  windowMs: 60 * 1000,
  max: 10,
  // Platform routes are always authenticated; the IPv6-safe helper is the
  // fallback so an unauthenticated probe cannot bypass the bucket.
  keyGenerator: (req) => (req.platformUser?.id ? `u:${req.platformUser.id}` : `ip:${ipKeyGenerator(req.ip)}`),
  message: "Too many storefront checks. Try again in a minute.",
});

// Domains: reads on support.read, mutations on tenant.lifecycle.
router.get("/domains", read, validate(listDomainsSchema), domains);
router.post("/domains/:id/retry-verification", validateObjectId("id"), requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE), validate(domainActionSchema), domainRetry);
router.post("/domains/:id/set-primary", validateObjectId("id"), requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE), validate(domainActionSchema), domainSetPrimary);
router.delete("/domains/:id", validateObjectId("id"), requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE), validate(domainRemoveSchema), domainRemove);

// Theme catalog: status changes on flags.write (catalog availability is a
// platform-wide feature decision, like feature flags).
router.get("/themes", read, themes);
router.get("/themes/:slug/stores", read, validate(themeStoresSchema), themeStores);
router.patch("/themes/:id/status", validateObjectId("id"), requireScope(PLATFORM_SCOPES.FLAGS_WRITE), validate(themeStatusSchema), themeStatus);
router.patch("/themes/:id", validateObjectId("id"), requireScope(PLATFORM_SCOPES.FLAGS_WRITE), validate(themeDetailsSchema), themeDetails);
router.post("/themes/:id/cover", validateObjectId("id"), requireScope(PLATFORM_SCOPES.FLAGS_WRITE), uploadSingleImage, handleUploadError, validateUploadedFiles, themeCover);

// Health: on-demand probe is a read-only network check; support.read suffices.
router.get("/health", read, validate(listHealthSchema), health);
router.get("/health/:tenantId", read, validateObjectId("tenantId"), tenantHealth);
router.post("/health/:tenantId/check", read, validateObjectId("tenantId"), healthCheckLimiter, runTenantCheck);

export default router;
