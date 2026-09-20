import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { createRateLimiter } from "../middlewares/rateLimiters.js";
import { createFeedbackSchema, listOwnFeedbackSchema } from "../validators/feedback.validator.js";
import { submitFeedback, listMyFeedback } from "../controllers/feedback.js";

/**
 * Merchant → platform feedback. Tenant-scoped through `authenticate`; the
 * submit route is rate-limited per IP so a compromised staff account cannot
 * flood the platform queue.
 */
const router = Router();

// Per-user ceiling (runs after authenticate, so tenant + user are known) plus
// a looser per-IP ceiling against a compromised account or many accounts on
// one host.
const submitUserLimiter = createRateLimiter({
  prefix: "feedback:submit:user",
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => `${req.tenantId}:${req.user?.userId}`,
  message: "Too much feedback in a short time. Please try again later.",
});
const submitIpLimiter = createRateLimiter({
  prefix: "feedback:submit:ip",
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: "Too much feedback in a short time. Please try again later.",
});

router.use(authenticate);
// Staff only — storefront customers authenticate through the same middleware
// but must never reach the platform feedback queue.
router.use(requirePermission("dashboard.read"));
router.get("/", validate(listOwnFeedbackSchema), listMyFeedback);
router.post("/", submitIpLimiter, submitUserLimiter, validate(createFeedbackSchema), submitFeedback);

export default router;
