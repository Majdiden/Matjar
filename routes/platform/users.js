import { Router } from "express";
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  createInviteSchema,
  changeRoleSchema,
  suspendUserSchema,
  reasonOptionalSchema,
  changeOwnPasswordSchema,
} from "../../validators/platform.validator.js";
import * as c from "../../controllers/platform/users.js";

/**
 * Platform staff management — mounted at /api/platform/users behind
 * platformAuthenticate. Scope platform.users for everything except the
 * self-service password change (any authenticated platform user).
 */
const router = Router({ mergeParams: true });
const manage = requireScope(PLATFORM_SCOPES.PLATFORM_USERS);

router.post("/me/password", validate(changeOwnPasswordSchema), c.changeOwnPassword);

router.get("/", manage, c.listUsers);
router.get("/invites", manage, c.listInvites);
router.post("/invites", manage, validate(createInviteSchema), c.createInvite);
router.post("/invites/:id/resend", manage, validateObjectId("id"), c.resendInvite);
router.delete("/invites/:id", manage, validateObjectId("id"), c.revokeInvite);

router.patch("/:id/role", manage, validateObjectId("id"), validate(changeRoleSchema), c.changeRole);
router.post("/:id/suspend", manage, validateObjectId("id"), validate(suspendUserSchema), c.suspendUser);
router.post("/:id/reactivate", manage, validateObjectId("id"), validate(reasonOptionalSchema), c.reactivateUser);
router.post("/:id/revoke-sessions", manage, validateObjectId("id"), validate(reasonOptionalSchema), c.revokeSessions);
router.post("/:id/force-password-reset", manage, validateObjectId("id"), validate(reasonOptionalSchema), c.forcePasswordReset);

export default router;
