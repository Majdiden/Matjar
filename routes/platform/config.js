// Per-tenant configuration inspector + feature overrides + limit overrides.
// Mount: router.use("/tenants/:tenantId", tenantConfigRoutes) in routes/platformAdmin.js
// (after platformAuthenticate). mergeParams so :tenantId is visible.
//
//   GET    /config                       support.read   configuration inspector
//   GET    /feature-overrides            support.read
//   POST   /feature-overrides            flags.write
//   POST   /feature-overrides/:overrideId/revoke   flags.write
//   PUT    /limit-overrides              tenant.lifecycle
//   GET    /usage                        support.read
import { Router } from "express";
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  createTenantFeatureOverrideSchema,
  revokeSchema,
  setLimitOverridesSchema,
} from "../../validators/programs.validator.js";
import * as programs from "../../controllers/platform/programs.js";
import * as usage from "../../controllers/platform/usage.js";
import { inspect } from "../../controllers/platform/configInspector.js";

const router = Router({ mergeParams: true });
const read = requireScope(PLATFORM_SCOPES.SUPPORT_READ);
const writeFlags = requireScope(PLATFORM_SCOPES.FLAGS_WRITE);
const writeLimits = requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE);

router.use(validateObjectId("tenantId"));

router.get("/config", read, inspect);
router.get("/feature-overrides", read, programs.listTenantOverrides);
router.post("/feature-overrides", writeFlags, validate(createTenantFeatureOverrideSchema), programs.createTenantOverride);
router.post(
  "/feature-overrides/:overrideId/revoke",
  validateObjectId("overrideId"),
  writeFlags,
  validate(revokeSchema),
  programs.revokeTenantOverride
);
router.get("/usage", read, usage.getTenantUsage);
router.put("/limit-overrides", writeLimits, validate(setLimitOverridesSchema), usage.setLimitOverrides);

export default router;
