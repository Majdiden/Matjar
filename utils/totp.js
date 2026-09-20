/**
 * RFC 6238 TOTP (HMAC-SHA1, 30-second step, 6 digits) built on Node crypto
 * — no third-party dependency. Used for platform-staff MFA.
 *
 * Verification accepts a ±1 step window (90 s total) to tolerate clock
 * drift, and the comparison is constant-time.
 */
import crypto from "crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 (no padding) — authenticator apps expect this format. */
export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const ch of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 20 random bytes (160 bits), the RFC-recommended SHA-1 secret length. */
export function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

/** HOTP (RFC 4226) for a raw secret buffer and 64-bit counter. */
export function hotp(secretBuf, counter, digits = DIGITS) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", secretBuf).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    ((mac[offset] & 0x7f) << 24) | ((mac[offset + 1] & 0xff) << 16) | ((mac[offset + 2] & 0xff) << 8) | (mac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

export function totp(secretBase32, { now = Date.now(), step = STEP_SECONDS, digits = DIGITS } = {}) {
  const counter = Math.floor(now / 1000 / step);
  return hotp(base32Decode(secretBase32), counter, digits);
}

/**
 * Constant-time verification within ±`window` steps. Returns the matched
 * step (a number) so callers can reject replay of the same step, or null.
 */
export function verifyTotp(secretBase32, code, { now = Date.now(), window = 1, step = STEP_SECONDS, digits = DIGITS } = {}) {
  const input = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(input)) return null;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(now / 1000 / step);
  let matched = null;
  for (let i = -window; i <= window; i++) {
    const expected = hotp(secret, counter + i, digits);
    // Evaluate every candidate so timing does not reveal which step matched.
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input)) && matched === null) matched = counter + i;
  }
  return matched;
}

/** otpauth:// provisioning URI for authenticator apps. */
export function otpauthUri({ secret, label, issuer }) {
  const enc = encodeURIComponent;
  return `otpauth://totp/${enc(issuer)}:${enc(label)}?secret=${secret}&issuer=${enc(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
