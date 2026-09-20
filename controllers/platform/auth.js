/**
 * Platform-admin authentication controllers: login, session info, and the
 * PUBLIC staff flows (accept invite, password reset). Rate limits are
 * applied in routes/platform/auth.js and routes/platformAdmin.js.
 */
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { signJWT, verifyJWT, comparePassword } from "../../utils/misc.js";
import { asyncHandler, APIError } from "../../middlewares/errorHandler.js";
import { PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import logger from "../../utils/logger.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import { acceptInvite, issueResetToken, confirmReset, listRoles } from "../../services/platform/users.js";
import { ipKeyGenerator } from "express-rate-limit";
import { createRateLimiter, ipKey } from "../../middlewares/rateLimiters.js";
import { validate } from "../../middlewares/validate.js";
import { platformLoginSchema, mfaVerifySchema, reauthSchema } from "../../validators/platform.validator.js";
import config from "../../config/index.js";
import { newJti, createSession } from "../../services/platform/sessions.js";
import * as mfa from "../../services/platform/mfa.js";

// Short TTL on platform tokens because blast radius is cross-tenant.
// Frontend also enforces an idle timeout; this is the hard ceiling.
const PLATFORM_TOKEN_TTL = "30m";
const PLATFORM_TOKEN_TTL_MS = 30 * 60 * 1000;
// Step-2 (MFA) and re-auth tokens are purpose-scoped and short-lived; the
// auth middleware rejects them as session tokens.
const MFA_TOKEN_TTL = "5m";
const REAUTH_TOKEN_TTL = "5m";
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
  keyGenerator: ipKey,
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
  const user = await TenantUser.findOne({ email: String(email).toLowerCase().trim(), platformAdmin: true }).select(LOGIN_SELECT);
  // Same response for unknown email / wrong password / suspended so the
  // endpoint is not an account-existence oracle.
  const ok = await comparePassword(password, user?.platformPasswordHash || DUMMY_BCRYPT_HASH);
  if (!user || !user.platformPasswordHash || !ok || user.platformStatus === "suspended") {
    logger.warn("Platform login failed", { email: String(email).toLowerCase().trim(), ip: req.ip });
    return res.status(401).json({ success: false, message: "Invalid credentials." });
  }

  // Two-step login when MFA is enrolled: hand back a purpose-scoped token
  // that can ONLY be exchanged at /auth/mfa/verify. No session exists yet.
  if (user.platformMfa?.enabled) {
    const mfaToken = signJWT(
      {
        platformUserId: String(user._id),
        purpose: "mfa",
        tokenVersion: user.platformTokenVersion || 0,
        jti: crypto.randomBytes(16).toString("hex"),
      },
      MFA_TOKEN_TTL
    );
    return res.json({ success: true, data: { mfaRequired: true, mfaToken } });
  }

  const session = await issueSession(user, req, { mfaVerified: false });
  logger.info("Platform admin login", { platformUserId: String(user._id) });
  res.json({ success: true, data: session });
});

/** Mint a session token + PlatformSession row. Shared by login, MFA verify. */
async function issueSession(user, req, { mfaVerified }) {
  const jti = newJti();
  const expiresAt = new Date(Date.now() + PLATFORM_TOKEN_TTL_MS);
  user.platformLastLoginAt = new Date();
  await user.save();
  await createSession({ userId: user._id, jti, req, expiresAt, mfaVerified });
  const token = signJWT(
    { platformUserId: String(user._id), platformAdmin: true, tokenVersion: user.platformTokenVersion || 0, jti },
    PLATFORM_TOKEN_TTL
  );
  return {
    token,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.platformRole || null,
      mustResetPassword: !!user.platformMustResetPassword,
      mfaEnabled: !!user.platformMfa?.enabled,
    },
  };
}

const LOGIN_SELECT =
  "+platformPasswordHash name email platformAdmin platformStatus platformTokenVersion platformRole platformMustResetPassword platformMfa.enabled";

// MFA step-2 brute force: 6-digit codes must be throttled hard, per IP and
// per user (the user id is inside the mfaToken).
const mfaIpLimiter = createRateLimiter({
  prefix: "platform:mfa-ip",
  windowMs: 15 * MINUTE,
  max: config.isDevelopment ? 100 : 20,
  skipSuccessfulRequests: true,
  keyGenerator: ipKey,
  message: "Too many verification attempts. Please try again in 15 minutes.",
});
const mfaUserLimiter = createRateLimiter({
  prefix: "platform:mfa-user",
  windowMs: 15 * MINUTE,
  max: config.isDevelopment ? 100 : 8,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const d = req.body?.mfaToken ? verifyJWT(String(req.body.mfaToken)) : null;
    return d?.platformUserId ? `u:${d.platformUserId}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  message: "Too many verification attempts for this account. Please try again in 15 minutes.",
});

async function auditMfaFailure(req, userId, endpoint) {
  logger.warn("Platform MFA check failed", { platformUserId: String(userId), endpoint, ip: req.ip });
  await recordPlatformAudit(req?.platformUser ? req : null, {
    action: "mfa.verify_failed",
    resourceType: "PlatformUser",
    resourceId: String(userId),
    outcome: "failure",
    metadata: { endpoint, ip: req.ip },
  });
}

/**
 * Failure limiters for authenticated MFA-guarded endpoints: per user (the
 * session tells us who) and per IP. Successful requests are not counted.
 */
function mfaGuardLimiters(prefix) {
  return [
    createRateLimiter({
      prefix: `platform:${prefix}-ip`,
      windowMs: 15 * MINUTE,
      max: config.isDevelopment ? 100 : 8,
      skipSuccessfulRequests: true,
      keyGenerator: ipKey,
      message: "Too many attempts. Please try again in 15 minutes.",
    }),
    createRateLimiter({
      prefix: `platform:${prefix}-user`,
      windowMs: 15 * MINUTE,
      max: config.isDevelopment ? 100 : 5,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => `u:${req.platformUser?.id || ipKeyGenerator(req.ip)}`,
      message: "Too many attempts for this account. Please try again in 15 minutes.",
    }),
  ];
}

/** POST /api/platform/auth/mfa/verify { mfaToken, code } → real session. */
const mfaVerifyHandler = asyncHandler(async (req, res) => {
  const { mfaToken, code } = req.body;
  const decoded = verifyJWT(String(mfaToken));
  if (!decoded || decoded.purpose !== "mfa" || !decoded.platformUserId) {
    return res.status(401).json({ success: false, message: "Sign in again." });
  }
  const TenantUser = mongoose.model("TenantUser");
  const user = await TenantUser.findOne({ _id: decoded.platformUserId, platformAdmin: true }).select(LOGIN_SELECT);
  if (
    !user ||
    user.platformStatus === "suspended" ||
    !user.platformMfa?.enabled ||
    Number(decoded.tokenVersion || 0) !== Number(user.platformTokenVersion || 0) ||
    !decoded.jti
  ) {
    return res.status(401).json({ success: false, message: "Sign in again." });
  }
  let result;
  try {
    result = await mfa.verifyCode(user._id, code);
  } catch (err) {
    if (!(err instanceof APIError)) throw err;
    await auditMfaFailure(req, user._id, "auth/mfa/verify");
    return res.status(401).json({ success: false, message: "Invalid code." });
  }
  // Single use: the mfaToken can be exchanged exactly once, even within its TTL.
  const consumed = await mfa.consumeMfaTokenJti(decoded.jti, new Date((decoded.exp || 0) * 1000 || Date.now() + 5 * MINUTE));
  if (!consumed) return res.status(401).json({ success: false, message: "Sign in again." });
  const session = await issueSession(user, req, { mfaVerified: true });
  if (result.method === "recovery") {
    await recordPlatformAudit(null, {
      action: "mfa.recovery_used",
      resourceType: "PlatformUser",
      resourceId: String(user._id),
      metadata: { email: user.email, remaining: result.remaining, ip: req.ip },
    });
  }
  logger.info("Platform admin login (MFA)", { platformUserId: String(user._id), method: result.method });
  res.json({ success: true, data: { ...session, mfaMethod: result.method, recoveryCodesRemaining: result.remaining } });
});
export const mfaVerify = [mfaIpLimiter, mfaUserLimiter, validate(mfaVerifySchema), mfaVerifyHandler];

/**
 * POST /api/platform/auth/reauth { password?, code? } (authenticated).
 * Re-confirms identity for destructive actions: password when MFA is off,
 * a TOTP/recovery code when MFA is on. Returns a 5-minute token bound to the
 * current session; the client sends it as `X-Reauth` on the protected call.
 */
const reauthLimiters = mfaGuardLimiters("reauth");
const reauthHandler = asyncHandler(async (req, res) => {
  const { password, code } = req.body;
  const TenantUser = mongoose.model("TenantUser");
  const user = await TenantUser.findOne({ _id: req.platformUser.id, platformAdmin: true }).select(LOGIN_SELECT);
  if (!user) return res.status(401).json({ success: false, message: "Not authenticated." });
  let method;
  if (user.platformMfa?.enabled) {
    if (!code) return res.status(400).json({ success: false, message: "Enter your authenticator code." });
    try {
      method = (await mfa.verifyCode(user._id, code)).method;
    } catch (err) {
      if (!(err instanceof APIError)) throw err;
      await auditMfaFailure(req, user._id, "auth/reauth");
      // 400, never 401: the console treats 401 as session expiry and would
      // sign the operator out over a single typo.
      return res.status(400).json({ success: false, code: "REAUTH_FAILED", message: "Invalid code." });
    }
  } else {
    if (!password) return res.status(400).json({ success: false, message: "Enter your password." });
    const ok = await comparePassword(password, user.platformPasswordHash || DUMMY_BCRYPT_HASH);
    if (!ok) {
      await recordPlatformAudit(req, {
        action: "auth.reauth_failed",
        resourceType: "PlatformUser",
        resourceId: String(user._id),
        outcome: "failure",
        metadata: { method: "password" },
      });
      return res.status(400).json({ success: false, code: "REAUTH_FAILED", message: "Incorrect password." });
    }
    method = "password";
  }
  const reauthToken = signJWT(
    { platformUserId: String(user._id), sessionJti: req.platformUser.jti, purpose: "reauth" },
    REAUTH_TOKEN_TTL
  );
  await recordPlatformAudit(req, { action: "auth.reauth", resourceType: "PlatformUser", resourceId: String(user._id), metadata: { method } });
  res.json({ success: true, data: { reauthToken, expiresInSeconds: 300, method } });
});
export const reauth = [...reauthLimiters, validate(reauthSchema), reauthHandler];

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
      mfaEnabled: req.platformUser.mfaEnabled,
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

// ── MFA enrollment (authenticated; own account) ──────────────────────────

/** POST /auth/mfa/enroll { currentPassword } → { otpauth, secret } (shown once). */
// Defined below (function declarations hoist); the password check here is an
// authenticated oracle, so it gets the same per-user/per-IP failure limiters
// as the code-verifying endpoints.
export const mfaBeginEnroll = [
  ...mfaGuardLimiters("mfa-enroll"),
  guarded("auth/mfa/enroll", async (req, res) => {
    const data = await mfa.beginEnrollment(req.platformUser.id, req.body.currentPassword);
    res.json({ success: true, data });
  }),
];

/** Wrap an MFA-guarded handler: audit + 4xx on APIError, rethrow anything else. */
function guarded(endpoint, fn) {
  return asyncHandler(async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (!(err instanceof APIError)) throw err;
      await auditMfaFailure(req, req.platformUser.id, endpoint);
      res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
  });
}

/** POST /auth/mfa/enroll/confirm { code } → { recoveryCodes } (shown once). */
export const mfaConfirmEnroll = [
  ...mfaGuardLimiters("mfa-confirm"),
  guarded("auth/mfa/enroll/confirm", async (req, res) => {
    const data = await mfa.confirmEnrollment(req.platformUser.id, req.body.code);
    await recordPlatformAudit(req, { action: "mfa.enroll", resourceType: "PlatformUser", resourceId: req.platformUser.id });
    res.json({ success: true, data });
  }),
];

/** POST /auth/mfa/disable { currentPassword, code } */
export const mfaDisable = [
  ...mfaGuardLimiters("mfa-disable"),
  guarded("auth/mfa/disable", async (req, res) => {
    const status = await mfa.disable(req.platformUser.id, req.body.currentPassword, req.body.code);
    await recordPlatformAudit(req, { action: "mfa.disable", resourceType: "PlatformUser", resourceId: req.platformUser.id });
    res.json({ success: true, data: status });
  }),
];

/** POST /auth/mfa/recovery-codes { code } → fresh codes (shown once). */
export const mfaRegenerateRecovery = [
  ...mfaGuardLimiters("mfa-recovery"),
  guarded("auth/mfa/recovery-codes", async (req, res) => {
    const data = await mfa.regenerateRecoveryCodes(req.platformUser.id, req.body.code);
    await recordPlatformAudit(req, { action: "mfa.recovery_regenerated", resourceType: "PlatformUser", resourceId: req.platformUser.id });
    res.json({ success: true, data });
  }),
];

/** GET /auth/mfa/status */
export const mfaStatusController = asyncHandler(async (req, res) => {
  const TenantUser = mongoose.model("TenantUser");
  const u = await TenantUser.findById(req.platformUser.id).select("platformMfa.enabled platformMfa.enrolledAt platformMfa.recoveryCodesRemaining").lean();
  res.json({ success: true, data: mfa.mfaStatus(u) });
});
