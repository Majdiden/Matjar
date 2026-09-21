import { Router } from "express";
import { requireAnyScope, requireRecentReauth } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import { bulkTenantsSchema } from "../../validators/bulk.validator.js";
import * as c from "../../controllers/platform/bulk.js";

// Bulk tenant operations. Mounted at /api/platform/bulk behind
// platformAuthenticate. Only reversible actions, ≤50 tenants, reason +
// fresh re-authentication required. Per-action scope is enforced in the
// controller (BULK_ACTION_SCOPE) once the body has been validated.
const router = Router();

router.post(
  "/tenants",
  requireAnyScope(...c.BULK_SCOPES),
  requireRecentReauth,
  validate(bulkTenantsSchema),
  c.runTenants
);

export default router;
