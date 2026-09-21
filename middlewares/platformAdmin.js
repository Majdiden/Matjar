/**
 * Platform-admin authentication, authorization, and param validation.
 *
 * Distinct from the per-tenant `authenticate` middleware because
 * platform operators operate across tenants — they have no `tenantId`
 * scope, and their identity lives in the admin DB (TenantUser) rather
 * than any single tenant DB.
 *
 * A platform-admin JWT carries `{ platformUserId, platformAdmin: true }`
 * and nothing else. Never mix this with a tenant JWT.
 */

import mongoose from "mongoose";
import { verifyJWT } from "../utils/misc.js";
import logger from "../utils/logger.js";
import { isSessionActive, touchSession } from "../services/platform/sessions.js";
import { getSecuritySettings } from "../services/platform/security.js";

// The six platform-admin permission scopes. Keep in sync with the
// bootstrap script and the frontend's scope → UI mapping.
// Scope constants live in the leaf module config/platformScopes.js (no imports)
// so config/platformRoles.js and the platform services can import them without
// a circular-evaluation crash. Re-exported here for existing callers.
export { PLATFORM_SCOPES, ALL_PLATFORM_SCOPES } from "../config/platformScopes.js";

export const platformAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Platform auth required." });
    }
    const token = authHeader.slice("Bearer ".length);
    const decoded = verifyJWT(token);
    if (!decoded || !decoded.platformUserId || !decoded.platformAdmin) {
      return res.status(401).json({ success: false, message: "Not a platform token." });
    }
    // Purpose-scoped tokens (MFA step, re-auth) grant NOTHING here.
    if (decoded.purpose) {
      return res.status(401).json({ success: false, message: "Not a platform session token." });
    }
    // Per-session revocation: every session token carries a jti with a
    // PlatformSession row; a revoked or missing row fails closed. Legacy
    // tokens without a jti (issued before this change) are rejected too —
    // the 30 m TTL makes that a non-event.
    if (!decoded.jti || !(await isSessionActive(decoded.jti))) {
      return res.status(401).json({ success: false, message: "Session revoked. Sign in again." });
    }

    const TenantUser = mongoose.model("TenantUser");
    const user = await TenantUser.findById(decoded.platformUserId).select(
      "platformAdmin platformScopes platformRole platformStatus platformTokenVersion platformMustResetPassword platformMfa.enabled name email"
    );
    if (!user || !user.platformAdmin) {
      return res.status(403).json({ success: false, message: "Platform admin revoked." });
    }
    if (user.platformStatus === "suspended") {
      return res.status(403).json({ success: false, message: "Platform account suspended." });
    }
    // Session revocation: the token carries the version it was issued
    // under; any bump (logout-everywhere, suspension, forced reset) makes
    // every older token invalid immediately. Legacy tokens without the
    // claim are treated as version 0.
    const issuedVersion = Number(decoded.tokenVersion || 0);
    if (issuedVersion !== Number(user.platformTokenVersion || 0)) {
      return res.status(401).json({ success: false, message: "Session revoked. Sign in again." });
    }

    // Lazy import avoids a circular dependency (platformRoles imports
    // PLATFORM_SCOPES from this module).
    const { resolveEffectiveScopes } = await import("../config/platformRoles.js");
    req.platformUser = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      platformAdmin: user.platformAdmin,
      role: user.platformRole || null,
      mustResetPassword: !!user.platformMustResetPassword,
      mfaEnabled: !!user.platformMfa?.enabled,
      scopes: resolveEffectiveScopes(user.platformRole, user.platformScopes),
      jti: decoded.jti,
    };
    touchSession(decoded.jti);

    // Forced password reset is enforced HERE, not only in the UI: until the
    // operator sets a new password they may only read their session and
    // change the password.
    if (req.platformUser.mustResetPassword && !isPasswordResetAllowedRoute(req)) {
      return res.status(403).json({
        success: false,
        code: "PASSWORD_RESET_REQUIRED",
        message: "You must set a new password before continuing.",
      });
    }
    // MFA enrolment policy: roles listed in security settings must enrol
    // before using anything but the enrolment routes themselves.
    if (!req.platformUser.mfaEnabled && req.platformUser.role) {
      const { requireMfaForRoles } = await getSecuritySettings();
      if (requireMfaForRoles.includes(req.platformUser.role) && !isMfaEnrollmentAllowedRoute(req)) {
        return res.status(403).json({
          success: false,
          code: "MFA_ENROLLMENT_REQUIRED",
          message: "Your role requires two-factor authentication. Enrol before continuing.",
        });
      }
    }
    next();
  } catch (err) {
    logger.error("platformAuthenticate failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Platform auth failed." });
  }
};

const RESET_ALLOWED = [
  { method: "GET", path: "/me" },
  { method: "POST", path: "/users/me/password" },
];
function isPasswordResetAllowedRoute(req) {
  // req.path is relative to the /api/platform mount.
  const path = String(req.path || "").replace(/\/+$/, "");
  return RESET_ALLOWED.some((r) => r.method === req.method && r.path === path);
}

const MFA_ENROLL_ALLOWED_PREFIXES = ["/auth/mfa/", "/users/me/sessions"];
function isMfaEnrollmentAllowedRoute(req) {
  const path = String(req.path || "").replace(/\/+$/, "");
  if (isPasswordResetAllowedRoute(req)) return true;
  if (req.method === "GET" && path === "/me") return true;
  return MFA_ENROLL_ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

/**
 * requireRecentReauth — the request must carry an `X-Reauth` header holding
 * a short-lived (5 min) JWT minted by POST /auth/reauth after the operator
 * re-entered their password (or a TOTP code when MFA is enabled). Bound to
 * the same user AND the same session jti so a stolen reauth token is useless
 * with another session token. Use on destructive / privilege-changing routes.
 */
export const requireRecentReauth = (req, res, next) => {
  const user = req.platformUser;
  if (!user) return res.status(401).json({ success: false, message: "Platform auth required." });
  const raw = req.headers["x-reauth"];
  const decoded = raw ? verifyJWT(String(raw)) : null;
  if (
    !decoded ||
    decoded.purpose !== "reauth" ||
    String(decoded.platformUserId) !== String(user.id) ||
    decoded.sessionJti !== user.jti
  ) {
    return res.status(403).json({
      success: false,
      code: "REAUTH_REQUIRED",
      message: "Please confirm your identity to perform this action.",
    });
  }
  next();
};

/**
 * requireRole(...roles) — the authenticated platform user must hold one of
 * the named roles (config/platformRoles.js). Use for actions that must stay
 * owner-only even though ADMIN holds every scope (e.g. forced purge).
 */
export const requireRole = (...roles) => (req, res, next) => {
  const user = req.platformUser;
  if (!user) {
    return res.status(401).json({ success: false, message: "Platform auth required." });
  }
  const allowed = roles.map((r) => String(r).toLowerCase());
  if (!allowed.includes(String(user.role || "").toLowerCase())) {
    return res.status(403).json({ success: false, message: "This action requires a platform role of: " + allowed.join(", ") });
  }
  next();
};

/**
 * requireScope(...scopes) — all listed scopes must be present on the
 * authenticated platform user. No implicit full-access fallback: a
 * platform admin with an empty scopes array can log in but cannot
 * perform any gated action. Use the bootstrap script with
 * `--scopes all` to grant full access explicitly.
 */
export const requireScope = (...required) => (req, res, next) => {
  const user = req.platformUser;
  if (!user) {
    return res.status(401).json({ success: false, message: "Platform auth required." });
  }
  const missing = required.filter((s) => !user.scopes.includes(s));
  if (missing.length > 0) {
    return res.status(403).json({
      success: false,
      message: "Insufficient platform scopes.",
      missing,
    });
  }
  next();
};

/**
 * requireAnyScope(...scopes) — at least one of the listed scopes must be
 * present. Used by endpoints whose per-action scope is decided after body
 * validation (bulk tenant ops); the controller still checks the exact one.
 */
export const requireAnyScope = (...allowed) => (req, res, next) => {
  const user = req.platformUser;
  if (!user) {
    return res.status(401).json({ success: false, message: "Platform auth required." });
  }
  if (!allowed.some((s) => user.scopes.includes(s))) {
    return res.status(403).json({ success: false, message: "Insufficient platform scopes.", missing: allowed });
  }
  next();
};

/**
 * validateObjectId(...paramNames) — 400 fast if any listed route param
 * isn't a valid Mongo ObjectId. Prevents wasted DB roundtrips and the
 * CastError log-noise they generate.
 */
export const validateObjectId = (...paramNames) => (req, res, next) => {
  for (const name of paramNames) {
    const val = req.params[name];
    if (val && !mongoose.Types.ObjectId.isValid(val)) {
      return res.status(400).json({ success: false, message: `Invalid ${name}.` });
    }
  }
  next();
};
