/**
 * Symmetric encryption for secrets we must store at rest (e.g. the
 * auto-generated VAPID private key in `platformconfigs`).
 *
 * AES-256-GCM (authenticated encryption). The 32-byte key is derived with
 * scrypt from `SECRET_ENCRYPTION_KEY` — or, so this works out of the box
 * without extra env config, from `JWT_SECRET` (which is already required in
 * production). Set a dedicated `SECRET_ENCRYPTION_KEY` if you want to rotate
 * the app's signing secret without invalidating encrypted-at-rest values.
 *
 * Encrypted values are self-describing strings:
 *
 *     enc:v1:<iv_b64url>:<authTag_b64url>:<ciphertext_b64url>
 *
 * so `decryptSecret` can transparently pass through legacy PLAINTEXT values
 * that predate encryption (anything not matching the prefix is returned
 * unchanged). This makes adopting encryption a no-downtime migration.
 */

import crypto from "crypto";

const PREFIX = "enc:v1:";
// Fixed, non-secret salt — the secret is the passphrase, and a constant salt
// keeps key derivation deterministic across processes (so any dyno can decrypt
// what another wrote). Rotating the passphrase is the supported rotation path.
const KDF_SALT = Buffer.from("matjar.secret-crypto.v1", "utf8");

let cachedKey = null;
let cachedPassphrase = null;

function passphrase() {
  const p = process.env.SECRET_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
  if (!p) {
    throw new Error(
      "secretCrypto: neither SECRET_ENCRYPTION_KEY nor JWT_SECRET is set — " +
        "cannot derive an encryption key."
    );
  }
  return p;
}

function derivedKey() {
  const p = passphrase();
  if (cachedKey && cachedPassphrase === p) return cachedKey;
  cachedKey = crypto.scryptSync(p, KDF_SALT, 32);
  cachedPassphrase = p;
  return cachedKey;
}

const b64url = (buf) => buf.toString("base64url");

/** True if `value` is an encrypted string produced by `encryptSecret`. */
export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypt a UTF-8 secret. Returns the self-describing `enc:v1:…` string.
 * Passing an already-encrypted value returns it unchanged (idempotent).
 */
export function encryptSecret(plaintext) {
  if (plaintext == null) return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  const iv = crypto.randomBytes(12); // 96-bit nonce, the GCM standard
  const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${b64url(iv)}:${b64url(tag)}:${b64url(enc)}`;
}

/**
 * Decrypt a value produced by `encryptSecret`. A value that is NOT in the
 * `enc:v1:` format is assumed to be legacy plaintext and returned as-is, so
 * callers can decrypt-on-read during a rolling migration. Throws only when an
 * `enc:v1:` value is malformed or fails authentication (tampering / wrong key).
 */
export function decryptSecret(value) {
  if (!isEncrypted(value)) return value; // legacy plaintext passthrough
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("secretCrypto: malformed ciphertext");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}
