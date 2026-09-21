import { Router } from "express";
import { requireScope, requireRecentReauth, requireRole, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  createInviteSchema,
  changeRoleSchema,
  suspendUserSchema,
  reasonOptionalSchema,
  changeOwnPasswordSchema,
  reasonRequiredSchema,
  setNotificationsSchema,
} from "../../validators/platform.validator.js";
import * as c from "../../controllers/platform/users.js";
import { findPlatformUserBrief } from "../../services/platform/users.js";
import { createRateLimiter } from "../../middlewares/rateLimiters.js";
import config from "../../config/index.js";
import { ipKeyGenerator } from "express-rate-limit";

// The current-password check on own-password change is an authenticated
// password oracle — bound failures per operator (falls back to IP).
const ownPasswordLimiter = createRateLimiter({
  prefix: "platform:own-password",
  windowMs: 15 * 60 * 1000,
  // Relaxed in development like the other platform limiters; 5 in production.
  max: config.isDevelopment ? 100 : 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `u:${req.platformUser?.id || ipKeyGenerator(req.ip)}`,
  message: "Too many failed attempts. Try again in 15 minutes.",
});

/**
 * Platform staff management — mounted at /api/platform/users behind
 * platformAuthenticate. Scope platform.users for everything except the
 * self-service password change (any authenticated platform user).
 */
const router = Router({ mergeParams: true });
const manage = requireScope(PLATFORM_SCOPES.PLATFORM_USERS);

// Promoting to / demoting from OWNER is the highest-privilege change in the
// console; require a fresh re-auth. Other role changes pass through.
async function reauthForOwnerRole(req, res, next) {
  const toOwner = String(req.body?.role || "").toLowerCase() === "owner";
  if (toOwner) return requireRecentReauth(req, res, next);
  try {
    const target = await findPlatformUserBrief(req.params.id);
    if (target.role === "owner") return requireRecentReauth(req, res, next);
  } catch {
    return requireRecentReauth(req, res, next);
  }
  next();
}

router.post("/me/password", ownPasswordLimiter, validate(changeOwnPasswordSchema), c.changeOwnPassword);
router.get("/me/sessions", c.listMySessions);
router.delete("/me/sessions", c.revokeMyOtherSessions);
router.delete("/me/sessions/:sessionId", validateObjectId("sessionId"), c.revokeMySession);

router.get("/", manage, c.listUsers);
router.get("/invites", manage, c.listInvites);
router.post("/invites", manage, validate(createInviteSchema), c.createInvite);
router.post("/invites/:id/resend", manage, validateObjectId("id"), c.resendInvite);
router.delete("/invites/:id", manage, validateObjectId("id"), c.revokeInvite);

// Role changes that grant or remove OWNER require recent re-authentication.
router.patch("/:id/role", manage, validateObjectId("id"), validate(changeRoleSchema), reauthForOwnerRole, c.changeRole);
// Email alerts are the owner's call (self-subscription allowed).
router.patch("/:id/notifications", manage, requireRole("owner"), validateObjectId("id"), validate(setNotificationsSchema), c.setNotifications);
router.post("/:id/suspend", manage, validateObjectId("id"), validate(suspendUserSchema), c.suspendUser);
router.post("/:id/reactivate", manage, validateObjectId("id"), validate(reasonOptionalSchema), c.reactivateUser);
router.post("/:id/revoke-sessions", manage, validateObjectId("id"), validate(reasonOptionalSchema), c.revokeSessions);
router.post("/:id/force-password-reset", manage, validateObjectId("id"), validate(reasonOptionalSchema), c.forcePasswordReset);
router.get("/:id/sessions", manage, validateObjectId("id"), c.listUserSessions);
router.delete("/:id/sessions/:sessionId", manage, validateObjectId("id", "sessionId"), validate(reasonOptionalSchema), c.revokeUserSession);
router.post("/:id/reset-mfa", manage, validateObjectId("id"), validate(reasonRequiredSchema), requireRecentReauth, c.resetUserMfa);

export default router;
