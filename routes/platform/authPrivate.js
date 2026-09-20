import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import {
  mfaEnrollSchema,
  mfaConfirmSchema,
  mfaDisableSchema,
  mfaCodeSchema,
} from "../../validators/platform.validator.js";
import {
  reauth,
  mfaBeginEnroll,
  mfaConfirmEnroll,
  mfaDisable,
  mfaRegenerateRecovery,
  mfaStatusController,
} from "../../controllers/platform/auth.js";

/**
 * AUTHENTICATED platform auth routes — mounted at /api/platform/auth AFTER
 * platformAuthenticate (the public /auth router is mounted before it, so
 * unauthenticated paths resolve there first). Own-account MFA enrolment and
 * re-authentication; no scope beyond a valid session.
 */
const router = Router({ mergeParams: true });

router.post("/reauth", reauth);
router.get("/mfa/status", mfaStatusController);
router.post("/mfa/enroll", validate(mfaEnrollSchema), mfaBeginEnroll);
router.post("/mfa/enroll/confirm", validate(mfaConfirmSchema), mfaConfirmEnroll);
router.post("/mfa/disable", validate(mfaDisableSchema), mfaDisable);
router.post("/mfa/recovery-codes", validate(mfaCodeSchema), mfaRegenerateRecovery);

export default router;
