/**
 * Platform-admin authentication controllers: login, session info, and the
 * PUBLIC staff flows (accept invite, password reset). Rate limits are
 * applied in routes/platform/auth.js and routes/platformAdmin.js.
 */
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { signJWT, comparePassword } from "../../utils/misc.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import logger from "../../utils/logger.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import { acceptInvite, issueResetToken, confirmReset, listRoles } from "../../services/platform/users.js";
import { ipKeyGenerator } from "express-rate-limit";
import { createRateLimiter } from "../../middlewares/rateLimiters.js";
import { validate } from "../../middlewares/validate.js";
import { platformLoginSchema } from "../../validators/platform.validator.js";
import config from "../../config/index.js";

// Short TTL on platform tokens because blast radius is cross-tenant.
// Frontend also enforces an idle timeout; this is the hard ceiling.
const PLATFORM_TOKEN_TTL = "30m";
const MINUTE = 60 * 1000;
// Compared against when the email is unknown so an attacker cannot tell
// "no such user" (fast) from "wrong password" (bcrypt-slow) by timing.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync("platform-timing-equaliser", config.bcryptSaltRounds || 10);

// Login brute-force protection: per IP AND per target email (so a
// distributed attacker cannot spray one account from many hosts). Failed
// attempts only — a legitimate typo followed by success is not penalised.
const loginIpLimiter = createRateLimiter({
  prefix: "platform:login-ip",
  windowMs: 15 * MINUTE,
  max: config.isDevelopment ? 100 : 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: "Too many login attempts. Please try again in 15 minutes.",
});
const loginEmailLimiter = createRateLimiter({
  prefix: "platform:login-email",
  windowMs: 15 * MINUTE,
  max: config.isDevelopment ? 100 : 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return email ? `e:${email}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  message: "Too many login attempts for this account. Please try again in 15 minutes.",
});

const loginHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const TenantUser = mongoose.model("TenantUser");
  const user = await TenantUser.findOne({ email: String(email).toLowerCase().trim(), platformAdmin: true }).select(
    "+platformPasswordHash name email platformAdmin platformStatus platformTokenVersion platformRole platformMustResetPassword"
  );
  // Same response for unknown email / wrong password / suspended so the
  // endpoint is not an account-existence oracle.
  const ok = await comparePassword(password, user?.platformPasswordHash || DUMMY_BCRYPT_HASH);
  if (!user || !user.platformPasswordHash || !ok || user.platformStatus === "suspended") {
    logger.warn("Platform login failed", { email: String(email).toLowerCase().trim(), ip: req.ip });
    return res.status(401).json({ success: false, message: "Invalid credentials." });
  }

  user.platformLastLoginAt = new Date();
  await user.save();

  const token = signJWT(
    { platformUserId: String(user._id), platformAdmin: true, tokenVersion: user.platformTokenVersion || 0 },
    PLATFORM_TOKEN_TTL
  );
  logger.info("Platform admin login", { platformUserId: String(user._id) });
  res.json({
    success: true,
    data: {
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.platformRole || null,
        mustResetPassword: !!user.platformMustResetPassword,
      },
    },
  });
});

// Exported as a middleware chain so the (shared) router file needs no change:
// `router.post("/login", platformLogin)` gets limiter → validation → handler.
export const platformLogin = [loginIpLimiter, loginEmailLimiter, validate(platformLoginSchema), loginHandler];

/**
 * Returns the authenticated platform user plus their EFFECTIVE scopes (role
 * ∪ explicit grants), so the frontend can gate UI affordances client-side
 * (server still enforces).
 */
export const platformMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.platformUser.id,
      name: req.platformUser.name,
      email: req.platformUser.email,
      platformAdmin: req.platformUser.platformAdmin,
      role: req.platformUser.role,
      mustResetPassword: req.platformUser.mustResetPassword,
      scopes: req.platformUser.scopes,
      // Include the canonical lists so the frontend doesn't have to
      // hardcode scope/role names or 404 when new ones ship.
      availableScopes: Object.values(PLATFORM_SCOPES),
      roles: listRoles(),
    },
  });
});

// ── Public flows ────────────────────────────────────────────────────────

/** POST /api/platform/auth/accept-invite { token, name, password } */
export const acceptInviteController = asyncHandler(async (req, res) => {
  const { token, name, password } = req.body;
  const result = await acceptInvite({ token, name, password });
  await recordPlatformAudit(null, {
    action: "platform.user.invite_accepted",
    resourceType: "PlatformUser",
    resourceId: result.user.id,
    metadata: { email: result.user.email, role: result.user.role, inviteId: result.inviteId, ip: req.ip },
  });
  res.status(201).json({ success: true, message: "Invitation accepted. You can now sign in." });
});

/** POST /api/platform/auth/password-reset { email } — always generic 200. */
export const requestResetController = asyncHandler(async (req, res) => {
  try {
    await issueResetToken(req, req.body.email);
  } catch (err) {
    // Never leak provider failures either — same envelope as the no-op path.
    logger.warn("Platform password reset request failed", { error: err.message });
  }
  res.json({ success: true, message: "If that email belongs to a platform user, a reset link has been sent." });
});

/** POST /api/platform/auth/password-reset/confirm { token, password } */
export const confirmResetController = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const result = await confirmReset({ token, password });
  await recordPlatformAudit(null, {
    action: "platform.user.password_reset",
    resourceType: "PlatformUser",
    resourceId: result.user.id,
    metadata: { email: result.user.email, ip: req.ip },
  });
  res.json({ success: true, message: "Password updated. Sign in with your new password." });
});
