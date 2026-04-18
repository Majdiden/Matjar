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
      "platformAdmin platformScopes name email"
    );
    if (!user || !user.platformAdmin) {
      return res.status(403).json({ success: false, message: "Platform admin revoked." });
    }

    req.platformUser = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      platformAdmin: user.platformAdmin,
      scopes: Array.isArray(user.platformScopes) ? user.platformScopes : [],
    };
    next();
  } catch (err) {
    logger.error("platformAuthenticate failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Platform auth failed." });
  }
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
