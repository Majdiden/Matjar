/**
 * Owner-side consent-based impersonation routes (merchant dashboard).
 *
 * Mounted at /api/impersonation. All routes require normal Bearer auth +
 * tenant resolution. The store owner approves/denies pending requests and
 * revokes an active session; both the owner's real session and any
 * impersonating support session read `/state` here to drive the freeze
 * overlay / support banner.
 */

import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getStateController,
  approveController,
  denyController,
  revokeController,
  exitSelfController,
} from "../controllers/impersonation.js";

const router = Router();

router.use(authenticate);

router.get("/state", getStateController);
router.post("/:grantId/approve", approveController);
router.post("/:grantId/deny", denyController);
router.post("/:grantId/revoke", revokeController);
// Called by the impersonating support session itself (Exit impersonation).
router.post("/:grantId/exit-self", exitSelfController);

export default router;
