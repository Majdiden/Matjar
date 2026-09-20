/**
 * Platform-staff MFA (TOTP, RFC 6238) + recovery codes.
 *
 *   beginEnrollment  → generates a seed, seals it as PENDING, returns the
 *                      otpauth URI + manual key ONCE (requires the password)
 *   confirmEnrollment→ proves possession with a valid code, promotes the
 *                      pending seed, issues 8 single-use recovery codes ONCE
 *   verifyCode       → login step 2 / re-auth; TOTP (single-use per step)
 *                      or a recovery code (consumed)
 *   disable          → requires password + a current code
 *   regenerateRecoveryCodes → requires a current code
 *
 * Seeds are AES-256-GCM sealed (utils/secretBox.js) and never leave the
 * service after enrollment. Recovery codes are stored as SHA-256 hashes.
 */
import crypto from "crypto";
import mongoose from "mongoose";
import logger from "../../utils/logger.js";
import { APIError } from "../../middlewares/errorHandler.js";
import { comparePassword } from "../../utils/misc.js";
import { seal, open } from "../../utils/secretBox.js";
import { sendEmail } from "../providers/email.js";

/**
 * Text-only security notification. Never includes codes or secrets; a send
 * failure is logged, never surfaced (the security change already happened).
 */
async function notifyMfaChange(email, what) {
  if (!email) return;
  const copy = {
    enrolled: "Two-factor authentication was just ENABLED on your Matjar platform console account.",
    disabled: "Two-factor authentication was just DISABLED on your Matjar platform console account.",
    reset: "Two-factor authentication on your Matjar platform console account was reset by a platform owner. Sign in and enrol again from My security.",
  }[what];
  try {
    await sendEmail({
      to: email,
      subject: "Two-factor authentication changed on your Matjar console account",
      text: `${copy} If this was not you, contact a platform owner immediately so your account can be suspended.`,
    });
  } catch (err) {
    logger.warn("mfa change email failed", { what, error: err.message });
  }
}
import { generateSecret, verifyTotp, otpauthUri } from "../../utils/totp.js";

const ISSUER = "Matjar Platform";
const PENDING_TTL_MS = 15 * 60 * 1000;
const RECOVERY_COUNT = 8;
const MFA_SELECT =
  "+platformPasswordHash +platformMfa.secretSealed +platformMfa.pendingSecretSealed +platformMfa.pendingCreatedAt +platformMfa.lastUsedStep +platformMfa.recoveryCodeHashes name email platformAdmin platformMfa.enabled platformMfa.enrolledAt platformMfa.recoveryCodesRemaining";

const TenantUser = () => mongoose.model("TenantUser");
const hashCode = (c) => crypto.createHash("sha256").update(String(c).toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");

async function loadUser(userId) {
  const u = await TenantUser().findOne({ _id: userId, platformAdmin: true }).select(MFA_SELECT);
  if (!u) throw new APIError("Not authenticated", 401);
  return u;
}

function newRecoveryCodes() {
  // 10 alphanumeric chars shown as XXXXX-XXXXX; ~50 bits each.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: RECOVERY_COUNT }, () => {
    const bytes = crypto.randomBytes(10);
    let s = "";
    for (const b of bytes) s += alphabet[b % alphabet.length];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export function mfaStatus(u) {
  return {
    enabled: !!u?.platformMfa?.enabled,
    enrolledAt: u?.platformMfa?.enrolledAt || null,
    recoveryCodesRemaining: u?.platformMfa?.recoveryCodesRemaining || 0,
  };
}

export async function beginEnrollment(userId, currentPassword) {
  const u = await loadUser(userId);
  if (!u.platformPasswordHash || !(await comparePassword(currentPassword, u.platformPasswordHash))) {
    throw new APIError("Current password is incorrect", 400);
  }
  if (u.platformMfa?.enabled) throw new APIError("MFA is already enabled. Disable it first to re-enrol.", 409);
  const secret = generateSecret();
  u.platformMfa = u.platformMfa || {};
  u.platformMfa.pendingSecretSealed = seal(secret);
  u.platformMfa.pendingCreatedAt = new Date();
  await u.save();
  return { secret, otpauth: otpauthUri({ secret, label: u.email, issuer: ISSUER }), issuer: ISSUER, account: u.email };
}

export async function confirmEnrollment(userId, code) {
  const u = await loadUser(userId);
  const sealed = u.platformMfa?.pendingSecretSealed;
  const at = u.platformMfa?.pendingCreatedAt;
  if (!sealed || !at || Date.now() - at.getTime() > PENDING_TTL_MS) {
    throw new APIError("No enrollment in progress (or it expired). Start again.", 400);
  }
  const secret = open(sealed);
  const step = verifyTotp(secret, code);
  if (step === null) throw new APIError("Invalid code. Check the time on your device and try again.", 400);
  const codes = newRecoveryCodes();
  u.platformMfa.secretSealed = sealed;
  u.platformMfa.pendingSecretSealed = null;
  u.platformMfa.pendingCreatedAt = null;
  u.platformMfa.enabled = true;
  u.platformMfa.enrolledAt = new Date();
  u.platformMfa.lastUsedStep = step;
  u.platformMfa.recoveryCodeHashes = codes.map(hashCode);
  u.platformMfa.recoveryCodesRemaining = codes.length;
  await u.save();
  await notifyMfaChange(u.email, "enrolled");
  return { recoveryCodes: codes, status: mfaStatus(u) };
}

/**
 * Verify a TOTP code or a recovery code for an enrolled user.
 * Returns { method: "totp" | "recovery" }. Throws 400 on failure.
 * TOTP codes are single-use within their 30 s step (replay-safe).
 */
export async function verifyCode(userId, code) {
  const u = await loadUser(userId);
  if (!u.platformMfa?.enabled || !u.platformMfa.secretSealed) throw new APIError("MFA is not enabled", 400);
  const raw = String(code || "").trim();
  if (/^\d{6}$/.test(raw.replace(/\s+/g, ""))) {
    const step = verifyTotp(open(u.platformMfa.secretSealed), raw);
    if (step !== null) {
      // Atomic single-use: only the first request for a given step wins.
      const r = await TenantUser().updateOne(
        {
          _id: u._id,
          $or: [{ "platformMfa.lastUsedStep": null }, { "platformMfa.lastUsedStep": { $lt: step } }],
        },
        { $set: { "platformMfa.lastUsedStep": step } }
      );
      if (r.modifiedCount !== 1) throw new APIError("This code was already used. Wait for the next one.", 400);
      return { method: "totp" };
    }
  }
  // Recovery code: constant-time compare against each stored hash, then an
  // atomic pull so a concurrent replay of the same code cannot both succeed.
  const h = hashCode(raw);
  const hashes = u.platformMfa.recoveryCodeHashes || [];
  let matched = null;
  for (const stored of hashes) {
    if (crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(h)) && matched === null) matched = stored;
  }
  if (matched === null) throw new APIError("Invalid code", 400);
  const r = await TenantUser().updateOne(
    { _id: u._id, "platformMfa.recoveryCodeHashes": matched },
    { $pull: { "platformMfa.recoveryCodeHashes": matched }, $inc: { "platformMfa.recoveryCodesRemaining": -1 } }
  );
  if (r.modifiedCount !== 1) throw new APIError("Invalid code", 400);
  return { method: "recovery", remaining: Math.max(0, hashes.length - 1) };
}

/**
 * Single-use MFA step tokens: a consumed jti is remembered until the token
 * would have expired anyway. Stored on PlatformSession rows with a sentinel
 * userId? No — a tiny dedicated TTL collection keeps the session model clean.
 */
export async function consumeMfaTokenJti(jti, expiresAt) {
  const col = mongoose.connection.db.collection("platform_consumed_mfa_tokens");
  try {
    await col.insertOne({ _id: jti, expiresAt });
    return true;
  } catch (err) {
    if (err?.code === 11000) return false; // already consumed
    throw err;
  }
}
export async function ensureConsumedMfaTokenIndex() {
  try {
    await mongoose.connection.db
      .collection("platform_consumed_mfa_tokens")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  } catch (err) {
    // An options conflict here would let the collection grow forever — make it visible.
    logger.warn("platform_consumed_mfa_tokens TTL index not ensured", { error: err?.message });
  }
}

export async function disable(userId, currentPassword, code) {
  const u = await loadUser(userId);
  if (!u.platformMfa?.enabled) throw new APIError("MFA is not enabled", 400);
  if (!u.platformPasswordHash || !(await comparePassword(currentPassword, u.platformPasswordHash))) {
    throw new APIError("Current password is incorrect", 400);
  }
  await verifyCode(userId, code); // throws on a bad code
  const fresh = await loadUser(userId);
  fresh.platformMfa = {
    enabled: false,
    secretSealed: null,
    pendingSecretSealed: null,
    pendingCreatedAt: null,
    enrolledAt: null,
    lastUsedStep: null,
    recoveryCodeHashes: [],
    recoveryCodesRemaining: 0,
  };
  await fresh.save();
  await notifyMfaChange(fresh.email, "disabled");
  return mfaStatus(fresh);
}

export async function regenerateRecoveryCodes(userId, code) {
  await verifyCode(userId, code);
  const u = await loadUser(userId);
  const codes = newRecoveryCodes();
  u.platformMfa.recoveryCodeHashes = codes.map(hashCode);
  u.platformMfa.recoveryCodesRemaining = codes.length;
  await u.save();
  return { recoveryCodes: codes, status: mfaStatus(u) };
}

/** Operator-side: strip MFA from another user (account recovery). Caller audits. */
export async function adminResetMfa(userId) {
  const u = await loadUser(userId);
  const before = mfaStatus(u);
  u.platformMfa = {
    enabled: false,
    secretSealed: null,
    pendingSecretSealed: null,
    pendingCreatedAt: null,
    enrolledAt: null,
    lastUsedStep: null,
    recoveryCodeHashes: [],
    recoveryCodesRemaining: 0,
  };
  await u.save();
  if (before.enabled) await notifyMfaChange(u.email, "reset");
  return { before, after: mfaStatus(u), email: u.email };
}
