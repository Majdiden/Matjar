import { Router } from "express";
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import { reasonRequiredSchema } from "../../validators/platform.validator.js";
import {
  listStaff,
  listInvites,
  revokeStaff,
  reactivateStaff,
  resendInvite,
  revokeInvite,
} from "../../controllers/platform/tenantUsers.js";

// Merchant staff of one tenant. Mounted at /api/platform/tenants/:tenantId/users
// behind platformAuthenticate; every route needs the tenant.users scope and
// every mutation carries an audited reason.
const router = Router({ mergeParams: true });

router.use(validateObjectId("tenantId"), requireScope(PLATFORM_SCOPES.TENANT_USERS));

router.get("/", listStaff);
router.get("/invites", listInvites);
router.post("/invites/:inviteId/resend", validateObjectId("inviteId"), validate(reasonRequiredSchema), resendInvite);
router.delete("/invites/:inviteId", validateObjectId("inviteId"), validate(reasonRequiredSchema), revokeInvite);
router.post("/:userId/revoke", validateObjectId("userId"), validate(reasonRequiredSchema), revokeStaff);
router.post("/:userId/reactivate", validateObjectId("userId"), validate(reasonRequiredSchema), reactivateStaff);

export default router;
