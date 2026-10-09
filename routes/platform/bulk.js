import { Router } from "express";
import { requireAnyScope, requireRecentReauth, requireScope, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { requirePasswordConfirmation } from "../../middlewares/platformPasswordConfirm.js";
import { validate } from "../../middlewares/validate.js";
import { bulkTenantsSchema, bulkDeleteTenantsSchema } from "../../validators/bulk.validator.js";
import * as c from "../../controllers/platform/bulk.js";
import { deleteTenantsPermanently } from "../../controllers/platform/tenantDeletion.js";

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

// Permanent deletion is NOT a bulk "action": it is irreversible, so it has
// its own scope, a typed "delete N stores" confirmation, a reason, and the
// operator's password (instead of the 5-minute re-auth token).
router.post(
  "/tenants/delete-permanently",
  requireScope(PLATFORM_SCOPES.TENANT_DELETE),
  validate(bulkDeleteTenantsSchema),
  ...requirePasswordConfirmation,
  deleteTenantsPermanently
);

export default router;
