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

// The six platform-admin permission scopes. Keep in sync with the
// bootstrap script and the frontend's scope → UI mapping.
export const PLATFORM_SCOPES = Object.freeze({
  SUPPORT_READ: "support.read",
  SUPPORT_IMPERSONATE: "support.impersonate",
  TENANT_LIFECYCLE: "tenant.lifecycle",
  TENANT_EXPORT: "tenant.export",
  QUEUE_RETRY: "queue.retry",
  BILLING_READ: "billing.read",
  // Phase A (platform operating system) additions — see docs/plans/platform-admin-operating-system.md
  BILLING_WRITE: "billing.write", // plans, commission policies, overrides, statements, record payments
  AUDIT_READ: "audit.read", // platform audit ledger + tenant activity
  PLATFORM_USERS: "platform.users", // invite/suspend/role-change platform staff, revoke sessions
  TENANT_USERS: "tenant.users", // view/revoke merchant staff access from the console
  FLAGS_WRITE: "flags.write", // feature flags, access programs, overrides (was tenant.lifecycle)
});
export const ALL_PLATFORM_SCOPES = Object.freeze(Object.values(PLATFORM_SCOPES));

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

    const TenantUser = mongoose.model("TenantUser");
    const user = await TenantUser.findById(decoded.platformUserId).select(
      "platformAdmin platformScopes platformRole platformStatus platformTokenVersion platformMustResetPassword name email"
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
      scopes: resolveEffectiveScopes(user.platformRole, user.platformScopes),
    };

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
