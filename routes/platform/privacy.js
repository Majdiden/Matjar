import { Router } from "express";
import {
  requireScope,
  requireRecentReauth,
  validateObjectId,
  PLATFORM_SCOPES,
} from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import * as c from "../../controllers/platform/privacy.js";
import { privacyLookupSchema, privacyActionSchema } from "../../validators/privacy.validator.js";

// Customer privacy operations for one tenant. Mounted at
// /api/platform/tenants/:tenantId/privacy (mergeParams) behind
// platformAuthenticate. Lookup needs tenant.export; the two mutations
// additionally require a fresh re-authentication.
const router = Router({ mergeParams: true });
router.use(validateObjectId("tenantId"), requireScope(PLATFORM_SCOPES.TENANT_EXPORT));

router.get("/customers", validate(privacyLookupSchema), c.lookup);
router.post(
  "/customers/:userId/anonymise",
  validateObjectId("userId"),
  requireRecentReauth,
  validate(privacyActionSchema),
  c.anonymise
);
router.post(
  "/customers/:userId/export",
  validateObjectId("userId"),
  requireRecentReauth,
  validate(privacyActionSchema),
  c.requestExport
);

export default router;
