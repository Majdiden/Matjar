import { Router } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { createRateLimiter } from "../../middlewares/rateLimiters.js";
import { validate } from "../../middlewares/validate.js";
import {
  acceptInviteSchema,
  requestResetSchema,
  confirmResetSchema,
} from "../../validators/platform.validator.js";
import {
  acceptInviteController,
  requestResetController,
  confirmResetController,
} from "../../controllers/platform/auth.js";

/**
 * PUBLIC platform auth extras — mounted at /api/platform/auth BEFORE
 * platformAuthenticate. Every route is rate-limited per IP; the reset
 * request is additionally capped per target email.
 */
const router = Router({ mergeParams: true });

const MINUTE = 60 * 1000;
const ipKey = (req) => ipKeyGenerator(req.ip);
const emailKey = (req) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  return email ? `e:${email}` : `ip:${ipKeyGenerator(req.ip)}`;
};

const acceptLimiter = createRateLimiter({
  prefix: "platform:invite-accept",
  windowMs: 15 * MINUTE,
  max: 10,
  keyGenerator: ipKey,
  message: "Too many attempts. Please try again later.",
});
const resetRequestIpLimiter = createRateLimiter({
  prefix: "platform:reset-ip",
  windowMs: 15 * MINUTE,
  max: 10,
  keyGenerator: ipKey,
  message: "Too many reset requests. Please try again later.",
});
const resetRequestEmailLimiter = createRateLimiter({
  prefix: "platform:reset-email",
  windowMs: 60 * MINUTE,
  max: 3,
  keyGenerator: emailKey,
  message: "Too many reset requests for this email. Please try again later.",
});
const resetConfirmLimiter = createRateLimiter({
  prefix: "platform:reset-confirm",
  windowMs: 15 * MINUTE,
  max: 10,
  keyGenerator: ipKey,
  message: "Too many attempts. Please try again later.",
});

router.post("/accept-invite", acceptLimiter, validate(acceptInviteSchema), acceptInviteController);
router.post(
  "/password-reset",
  resetRequestIpLimiter,
  resetRequestEmailLimiter,
  validate(requestResetSchema),
  requestResetController
);
router.post("/password-reset/confirm", resetConfirmLimiter, validate(confirmResetSchema), confirmResetController);

export default router;
