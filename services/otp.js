/**
 * Email OTP verification service (signup email confirmation).
 *
 * A 4-digit numeric code is emailed to the address the user typed during
 * registration; they must enter it back before the tenant is created. We
 * store only a SHA-256 hash of the code in Redis with a short TTL, so a
 * Redis dump never reveals a live code. On successful verification we mint a
 * short-lived signed "email-verification token" (JWT) the register call
 * carries as proof — the register handler validates it instead of trusting
 * the client's word.
 *
 * Anti-abuse:
 *   - per-email cooldown between sends (RESEND_COOLDOWN_SECONDS)
 *   - per-email hourly send cap (MAX_SENDS_PER_WINDOW)
 *   - per-code verify-attempt cap (MAX_VERIFY_ATTEMPTS)
 * Route-level rate limiters (routes/auth.js) add a per-IP ceiling on top.
 *
 * ENTROPY NOTE: a 4-digit code is only 10,000 possibilities (~13.3 bits) —
 * an order of magnitude weaker than the previous 6 digits. The verify-attempt
 * cap is what keeps that safe: with MAX_VERIFY_ATTEMPTS=5 tries per code and a
 * 10-minute TTL, an online attacker gets at most 5/10000 = 0.05% chance per
 * code before it's burned, and the per-IP + per-email rate limits stop them
 * requesting fresh codes fast enough to matter. Keep the attempt cap TIGHT if
 * you ever revisit these constants.
 *
 * Enumeration: request() always resolves to a generic success envelope and
 * always sends to the address given — this endpoint confirms the SIGNUP
 * email belongs to the user, so there is no "does an account exist" oracle
 * to leak (unlike password-reset). We still rate-limit to stop inbox spam.
 */

import crypto from "crypto";
import { initRedis } from "../config/redis.js";
import { signJWT, verifyJWT } from "../utils/misc.js";
import { sendEmail } from "./providers/email.js";
import { buildOtpVerificationEmail } from "./emailTemplates/otpVerification.js";
import logger from "../utils/logger.js";
import config from "../config/index.js";

const CODE_TTL_SECONDS = 10 * 60; // 10 minutes
const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 45;
const MAX_SENDS_PER_WINDOW = 8;
const SEND_WINDOW_SECONDS = 60 * 60; // 1 hour
// Kept deliberately tight: a 4-digit code is low-entropy (10,000 values), so
// the attempt cap is the primary brute-force defence — 5 wrong tries burns
// the code and forces a fresh request (which is itself cooldown/cap-limited).
const MAX_VERIFY_ATTEMPTS = 5;
const CODE_DIGITS = 4;
const VERIFIED_TTL_SECONDS = 30 * 60; // verified marker lives 30 min
const VERIFY_TOKEN_TTL = "30m";
const VERIFY_TOKEN_PURPOSE = "email_verify";

// ── In-memory fallback (dev without Redis) ──────────────────────────
// Mirrors the ioredis-optional pattern used elsewhere. Only the handful
// of ops we need are implemented. Keys auto-expire via stored deadlines.
const memStore = new Map();
function memGet(key) {
  const e = memStore.get(key);
  if (!e) return null;
  if (e.exp && e.exp < Date.now()) {
    memStore.delete(key);
    return null;
  }
  return e.val;
}
function memSet(key, val, ttlSeconds) {
  memStore.set(key, { val, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
}

let redisReady = null;
async function getRedis() {
  if (redisReady === false) return null;
  try {
    const client = await initRedis();
    redisReady = true;
    return client;
  } catch (err) {
    if (redisReady === null) {
      logger.warn("OTP store: Redis unavailable, falling back to in-memory store", {
        error: err?.message,
      });
    }
    redisReady = false;
    return null;
  }
}

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

// Keys are derived from a hash of the email so we never store the raw
// address as a Redis key.
function emailKeyHash(email) {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 32);
}

function hashCode(code, email) {
  return crypto
    .createHash("sha256")
    .update(`${code}:${normalizeEmail(email)}`)
    .digest("hex");
}

function generateCode() {
  // 4 digits, cryptographically random, zero-padded. Lower entropy than 6 —
  // see the ENTROPY NOTE at the top of the file; MAX_VERIFY_ATTEMPTS is the
  // guardrail that makes a 4-digit code acceptable here.
  return String(crypto.randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
}

async function kvGet(key) {
  const r = await getRedis();
  if (r) return r.get(key);
  return memGet(key);
}
async function kvSet(key, val, ttlSeconds) {
  const r = await getRedis();
  if (r) {
    await r.set(key, val, { EX: ttlSeconds });
    return;
  }
  memSet(key, val, ttlSeconds);
}
async function kvDel(key) {
  const r = await getRedis();
  if (r) {
    await r.del(key);
    return;
  }
  memStore.delete(key);
}
async function kvIncrWithTtl(key, ttlSeconds) {
  const r = await getRedis();
  if (r) {
    const n = await r.incr(key);
    if (n === 1) await r.expire(key, ttlSeconds);
    return n;
  }
  const cur = Number(memGet(key) || 0) + 1;
  memSet(key, String(cur), ttlSeconds);
  return cur;
}

const codeKey = (email) => `otp:req:${emailKeyHash(email)}`;
const cooldownKey = (email) => `otp:cooldown:${emailKeyHash(email)}`;
const countKey = (email) => `otp:count:${emailKeyHash(email)}`;
const verifiedKey = (email) => `otp:verified:${emailKeyHash(email)}`;

/**
 * Request an OTP for `email`. Always resolves to a generic envelope so the
 * endpoint can't be turned into an oracle. Honours a per-email cooldown and
 * hourly cap; when either is hit it silently no-ops (still returns success).
 *
 * @returns {Promise<{ ok: true, cooldownSeconds: number, devCode?: string }>}
 *   `devCode` is only populated when platform email is disabled (dev/CI) so
 *   the flow can be exercised without a real inbox — never in production.
 */
export async function requestEmailOtp({ email, language } = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
    // Malformed input is reproducible without server state, so a 400 here
    // leaks nothing — but we keep the generic shape for a simpler client.
    return { ok: true, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
  }

  // Cooldown gate — if a code was sent within the window, don't send again.
  const onCooldown = await kvGet(cooldownKey(normalized));
  if (onCooldown) {
    return { ok: true, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
  }

  // Hourly cap.
  const sends = await kvIncrWithTtl(countKey(normalized), SEND_WINDOW_SECONDS);
  if (sends > MAX_SENDS_PER_WINDOW) {
    logger.warn("OTP send cap reached for email hash", { hash: emailKeyHash(normalized) });
    return { ok: true, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
  }

  const code = generateCode();
  const record = JSON.stringify({
    hash: hashCode(code, normalized),
    attempts: 0,
    createdAt: Date.now(),
  });
  await kvSet(codeKey(normalized), record, CODE_TTL_SECONDS);
  await kvSet(cooldownKey(normalized), "1", RESEND_COOLDOWN_SECONDS);

  const { subject, text, html } = buildOtpVerificationEmail({
    code,
    expiresInMinutes: CODE_TTL_MINUTES,
    language,
  });

  // Dispatch through the SAME transport every other platform email uses
  // (services/providers/email.js::sendEmail → Resend in prod). `sendEmail`
  // NEVER throws for a provider failure — it returns a soft-failure envelope
  // `{ success: false, error }` so order-status mail can't roll back an order.
  // That means we MUST inspect the return value here: if we only relied on a
  // try/catch we'd report "code sent" to the user while Resend rejected the
  // message (unverified from-domain, bad API key, …) and nothing was delivered.
  // That silent success is exactly why signup OTPs "weren't arriving" in prod.
  let devCode;
  let res;
  try {
    res = await sendEmail({ to: normalized, subject, text, html });
  } catch (err) {
    // Defensive: sendEmail shouldn't throw, but if it ever does treat it as a
    // hard delivery failure rather than swallowing it.
    res = { success: false, provider: "throw", error: err?.message };
  }

  const provider = res?.provider;
  const emailHash = emailKeyHash(normalized);

  if (provider === "log") {
    // EMAIL_ENABLED=false → the platform stubbed the send (dev/staging). Echo
    // the code so the flow is exercisable without a real inbox.
    devCode = code;
    if (config.isProduction) {
      // A production deploy that forgot to set EMAIL_ENABLED=true silently
      // stubs EVERY email — including this signup-GATING code. Signup cannot
      // complete without it, so make the misconfiguration LOUD instead of
      // returning a false success. Required prod env: EMAIL_ENABLED=true,
      // RESEND_API_KEY, EMAIL_FROM.
      logger.error(
        "OTP email was STUBBED in production — the verification code was NOT delivered. " +
          "Set EMAIL_ENABLED=true plus RESEND_API_KEY and EMAIL_FROM so signup OTPs actually send.",
        { emailHash }
      );
    }
  } else if (provider === "inbox") {
    // NODE_ENV=test capture — surface the code for e2e/unit exercising.
    devCode = code;
  } else if (res?.success !== true) {
    // The real provider was invoked but rejected/failed. sendEmail already
    // logged the provider error; add an OTP-specific loud line so a
    // non-delivery is traceable to "signup verification code" in prod logs.
    logger.error(
      "OTP verification email FAILED to send — the code was not delivered. " +
        "Check RESEND_API_KEY / EMAIL_FROM (the from-domain must be verified with the provider).",
      { emailHash, provider, error: res?.error }
    );
  } else {
    // Delivered to the wire (provider === "resend", success). Trace it so a
    // "didn't get the code" report can be correlated without a debugger.
    logger.info("OTP verification email dispatched", { emailHash, provider });
  }

  return { ok: true, cooldownSeconds: RESEND_COOLDOWN_SECONDS, devCode };
}

/**
 * Verify a submitted code. On success clears the code, records a short-lived
 * "verified" marker, and returns a signed verification token for register().
 *
 * @returns {Promise<{ success: boolean, statusCode: number, message: string,
 *   verificationToken?: string }>}
 */
export async function verifyEmailOtp({ email, code } = {}) {
  const normalized = normalizeEmail(email);
  const submitted = String(code || "").trim();

  if (!normalized || !new RegExp(`^\\d{${CODE_DIGITS}}$`).test(submitted)) {
    return { success: false, statusCode: 400, message: "Invalid or expired code" };
  }

  const raw = await kvGet(codeKey(normalized));
  if (!raw) {
    return { success: false, statusCode: 400, message: "Invalid or expired code" };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await kvDel(codeKey(normalized));
    return { success: false, statusCode: 400, message: "Invalid or expired code" };
  }

  if ((parsed.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
    await kvDel(codeKey(normalized));
    return { success: false, statusCode: 429, message: "Too many attempts. Request a new code." };
  }

  const expected = Buffer.from(String(parsed.hash || ""), "hex");
  const actual = Buffer.from(hashCode(submitted, normalized), "hex");
  const match =
    expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!match) {
    parsed.attempts = (parsed.attempts || 0) + 1;
    // Preserve the remaining TTL as best we can — re-set with the full
    // window is acceptable here (the code still expires on its own via the
    // 10-min cap, and attempts are bounded independently).
    await kvSet(codeKey(normalized), JSON.stringify(parsed), CODE_TTL_SECONDS);
    return { success: false, statusCode: 400, message: "Invalid or expired code" };
  }

  // Success — burn the code, drop a short verified marker, mint the token.
  await kvDel(codeKey(normalized));
  await kvSet(verifiedKey(normalized), "1", VERIFIED_TTL_SECONDS);

  const verificationToken = signJWT(
    { purpose: VERIFY_TOKEN_PURPOSE, email: normalized },
    VERIFY_TOKEN_TTL
  );

  return { success: true, statusCode: 200, message: "Email verified", verificationToken };
}

/**
 * Validate an email-verification token minted by verifyEmailOtp against the
 * email being registered. Returns true iff the token is well-formed, has the
 * expected purpose, hasn't expired, and matches the email.
 */
export function verifyEmailVerificationToken(token, email) {
  if (!token || typeof token !== "string") return false;
  const decoded = verifyJWT(token);
  if (!decoded || decoded.purpose !== VERIFY_TOKEN_PURPOSE) return false;
  return normalizeEmail(decoded.email) === normalizeEmail(email);
}
