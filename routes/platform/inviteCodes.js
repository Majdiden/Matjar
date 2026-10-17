import { Router } from "express";
import { requireScope, requireRole, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import * as c from "../../controllers/platform/inviteCodes.js";
import {
  listInviteCodesSchema,
  createInviteCodesSchema,
  inviteCodeIdSchema,
  codeStoreSchema,
  signupModeSchema,
} from "../../validators/inviteCodes.validator.js";

// Signup invitation codes. Mounted at /api/platform/invite-codes behind
// platformAuthenticate. Owners and promoters; a promoter only ever reaches
// their own codes and the stores registered with them (service layer).
const router = Router();
const codes = requireScope(PLATFORM_SCOPES.INVITE_CODES);

router.get("/", codes, validate(listInviteCodesSchema), c.list);
router.post("/", codes, validate(createInviteCodesSchema), c.create);
router.post("/:id/revoke", codes, validateObjectId("id"), validate(inviteCodeIdSchema), c.revoke);
router.get("/stores/:tenantId", codes, validateObjectId("tenantId"), validate(codeStoreSchema), c.store);
router.put("/signup-mode", requireRole("owner"), validate(signupModeSchema), c.setMode);

export default router;
