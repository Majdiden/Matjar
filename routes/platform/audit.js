import { Router } from "express";
// Platform audit ledger + tenant activity. Read-only (the ledger is append-only);
// every route requires the audit.read scope. Mounted at /api/platform/audit
// behind platformAuthenticate.
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { listAudit, listAuditActions, tenantActivity } from "../../controllers/platform/audit.js";

const router = Router({ mergeParams: true });

router.use(requireScope(PLATFORM_SCOPES.AUDIT_READ));

router.get("/", listAudit);
router.get("/actions", listAuditActions);
router.get("/tenants/:tenantId/activity", validateObjectId("tenantId"), tenantActivity);

export default router;
