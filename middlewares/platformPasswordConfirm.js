/**
 * requirePasswordConfirmation — the request body must carry the operator's
 * CURRENT platform password (`password`). Used on irreversible actions
 * (permanently deleting stores) on top of the scope check.
 *
 * Unlike requireRecentReauth (which accepts a TOTP code instead of the
 * password for MFA-enrolled operators), this always asks for the password:
 * the session already proved the second factor at sign-in, and the product
 * rule for these actions is an explicit password re-entry at the moment of
 * the action.
 *
 *   - Rate-limited per operator: it is an authenticated password oracle.
 *   - Failures answer 400 PASSWORD_INCORRECT, never 401, so the console does
 *     not treat a typo as an expired session and sign the operator out.
 *   - Failures are audited and alert the platform security channel.
 *   - The password is removed from req.body once checked so no later audit
 *     or log can capture it.
 */
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { ipKeyGenerator } from "express-rate-limit";
import config from "../config/index.js";
import { comparePassword } from "../utils/misc.js";
import { createRateLimiter } from "./rateLimiters.js";
import { recordPlatformAudit } from "../services/platform/audit.js";
import { notifyPlatform } from "../services/platform/notifications.js";
import logger from "../utils/logger.js";

/** Max wrong passwords per operator per window before the action locks. */
export const PASSWORD_CONFIRM_MAX_FAILURES = 5;
const PASSWORD_CONFIRM_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_MAX_LENGTH = 1024;

// Equalises timing when the operator has no password hash (e.g. SSO-only).
const DUMMY_BCRYPT_HASH = bcrypt.hashSync("platform-password-confirm", config.bcryptSaltRounds || 10);

const passwordConfirmLimiter = createRateLimiter({
  prefix: "platform:password-confirm",
  windowMs: PASSWORD_CONFIRM_WINDOW_MS,
  max: config.isDevelopment ? 100 : PASSWORD_CONFIRM_MAX_FAILURES,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `u:${req.platformUser?.id || ipKeyGenerator(req.ip)}`,
  message: "Too many incorrect passwords. Try again in 15 minutes.",
});

const confirmPasswordHandler = async (req, res, next) => {
  try {
    const user = req.platformUser;
    if (!user) return res.status(401).json({ success: false, message: "Platform auth required." });

    const password = req.body?.password;
    if (req.body) delete req.body.password;
    if (typeof password !== "string" || !password || password.length > PASSWORD_MAX_LENGTH) {
      return res.status(400).json({ success: false, code: "PASSWORD_REQUIRED", message: "Enter your password to confirm." });
    }

    const row = await mongoose
      .model("TenantUser")
      .findOne({ _id: user.id, platformAdmin: true })
      .select("+platformPasswordHash email")
      .lean();
    const ok = await comparePassword(password, row?.platformPasswordHash || DUMMY_BCRYPT_HASH);
    if (!ok || !row?.platformPasswordHash) {
      await recordPlatformAudit(req, {
        action: "auth.password_confirm_failed",
        resourceType: "PlatformUser",
        resourceId: String(user.id),
        outcome: "failure",
        metadata: { route: `${req.method} ${req.baseUrl}${req.path}` },
      });
      void notifyPlatform("security.platform_login_failed", {
        subject: "Platform console password confirmation failed",
        lines: [`Account: ${user.email}`, `IP: ${req.ip}`, "Reason: wrong password while confirming a destructive action"],
        link: "/audit",
      });
      return res.status(400).json({ success: false, code: "PASSWORD_INCORRECT", message: "Incorrect password." });
    }
    next();
  } catch (err) {
    logger.error("requirePasswordConfirmation failed", { error: err.message });
    return res.status(500).json({ success: false, message: "Could not confirm your password." });
  }
};

export const requirePasswordConfirmation = [passwordConfirmLimiter, confirmPasswordHandler];
