import { Router } from "express";
// Merchant → platform feedback queue. Reads: support.read; status/notes:
// tenant.lifecycle. Mounted at /api/platform/feedback behind platformAuthenticate.
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  platformListFeedbackSchema,
  updateFeedbackStatusSchema,
  addFeedbackNoteSchema,
} from "../../validators/feedback.validator.js";
import { listFeedback, getFeedback, updateFeedbackStatus, addFeedbackNote } from "../../controllers/platform/feedback.js";

const router = Router({ mergeParams: true });

router.get("/", requireScope(PLATFORM_SCOPES.SUPPORT_READ), validate(platformListFeedbackSchema), listFeedback);
router.get("/:id", validateObjectId("id"), requireScope(PLATFORM_SCOPES.SUPPORT_READ), getFeedback);
router.patch(
  "/:id/status",
  validateObjectId("id"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  validate(updateFeedbackStatusSchema),
  updateFeedbackStatus
);
router.post(
  "/:id/notes",
  validateObjectId("id"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  validate(addFeedbackNoteSchema),
  addFeedbackNote
);

export default router;
