/**
 * Authenticated encryption for small secrets at rest (MFA seeds) —
 * AES-256-GCM with a random 96-bit IV per value. Output format:
 *   v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 *
 * Key source: `PLATFORM_MFA_KEY` (32 bytes as 64 hex chars or base64).
 * Production FAILS CLOSED without it; in development a key is derived from
 * JWT_SECRET with a boot warning so local work needs no extra setup.
 */
import crypto from "crypto";
import config from "../config/index.js";
import logger from "../utils/logger.js";

let cachedKey = null;
let warned = false;

function loadKey() {
  if (cachedKey) return cachedKey;
  const raw = config.platformMfaKey;
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("PLATFORM_MFA_KEY must decode to exactly 32 bytes");
    cachedKey = buf;
    return cachedKey;
  }
  // Fail closed for every environment that is not explicitly development or
  // test (staging, "prod", "Production"…): a derived key there would silently
  // tie every enrolled seed to JWT_SECRET.
  if (!config.isDevelopment && !config.isTest) {
    throw new Error("PLATFORM_MFA_KEY is required outside development/test (32-byte hex or base64)");
  }
  if (!warned) {
    warned = true;
    logger.warn("PLATFORM_MFA_KEY not set — deriving a development MFA key from JWT_SECRET. Set it before production.");
  }
  cachedKey = crypto.createHash("sha256").update(`platform-mfa:${config.jwtSecret || "dev"}`).digest();
  return cachedKey;
}

const b64u = (buf) => buf.toString("base64url");
const unb64u = (s) => Buffer.from(s, "base64url");

export function seal(plaintext) {
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${b64u(iv)}.${b64u(tag)}.${b64u(ct)}`;
}

/** Returns the plaintext, or throws on tampering / wrong key / bad format. */
export function open(sealed) {
  const parts = String(sealed || "").split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("secretBox: malformed value");
  const key = loadKey();
  const iv = unb64u(parts[1]);
  const tag = unb64u(parts[2]);
  if (iv.length !== 12 || tag.length !== 16) throw new Error("secretBox: malformed iv/tag");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(unb64u(parts[3])), decipher.final()]).toString("utf8");
}

/**
 * Boot-time check: in production the key must be present and valid so the
 * process fails FAST with a clear message instead of at the first MFA call.
 * Called from index.js; a no-op in development/test.
 */
export function assertMfaKeyAtBoot() {
  if (config.isDevelopment || config.isTest) return;
  try {
    loadKey();
  } catch (err) {
    logger.error(`FATAL: ${err.message}`);
    throw err;
  }
}

/** Test hook: clear the cached key (e.g. after changing env). */
export function __resetKeyCache() {
  cachedKey = null;
  warned = false;
}
