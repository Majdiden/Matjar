/**
 * Web Push (VAPID) bootstrap + low-level send helper.
 *
 * VAPID key resolution (in priority order):
 *   1. VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars — REQUIRED in production.
 *   2. A dev-only keypair persisted to `<repo>/.vapid.json`. If the file is
 *      missing we generate ONE pair, write it, and log it once so the same
 *      keys survive `node index.js` restarts. We NEVER regenerate on every
 *      boot — a rotated key would silently invalidate every subscription a
 *      merchant already stored (the browser signs against a fixed key).
 *
 * `VAPID_SUBJECT` is the contact URL/mailto the push service can reach the
 * app operator at (spec requirement); defaults to a mailto in dev.
 */

import mongoose from "mongoose";
import webpush from "web-push";
import logger from "./logger.js";
import { encryptSecret, decryptSecret, isEncrypted } from "./secretCrypto.js";

let publicKey = null;
let privateKey = null;
let subject = null;
let configured = false;

// Singleton doc holding the auto-generated VAPID keypair, in the admin DB.
// The keypair must be STABLE across restarts and redeploys — a rotated key
// silently invalidates every subscription a browser already stored — so we
// persist it in the database (not a local file, which an ephemeral container
// filesystem loses on redeploy). The PRIVATE key is encrypted at rest with
// AES-256-GCM (utils/secretCrypto.js); the public key is not secret.
const VAPID_CONFIG_ID = "vapid";
function platformConfigCollection() {
  return mongoose.connection?.db?.collection("platformconfigs") || null;
}

/**
 * Configure the web-push library with a VAPID keypair. Idempotent; call once
 * at boot AFTER the DB is connected.
 *
 * Resolution order:
 *   1. VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars (operator-managed).
 *   2. A keypair persisted in the admin DB (`platformconfigs._id="vapid"`).
 *   3. Generate a fresh pair, store it in the DB, and use it.
 *
 * This means background push works out of the box in production without any
 * env configuration, while operators can still pin keys via env vars.
 */
/**
 * VAPID keys are a P-256 (prime256v1) keypair encoded as base64url in a very
 * specific shape (public = the 65-byte uncompressed EC point ≈ 87 chars,
 * private = the 32-byte scalar ≈ 43 chars). `openssl` PEM output is NOT this
 * format. `setVapidDetails` validates and throws on anything malformed, so we
 * use it as the validator: apply the pair, and on success capture it.
 */
function applyKeys(pub, priv, subj) {
  try {
    webpush.setVapidDetails(subj, pub, priv);
    publicKey = pub;
    privateKey = priv;
    subject = subj;
    configured = true;
    return true;
  } catch (err) {
    logger.warn("web-push: a VAPID keypair was rejected", { error: err?.message });
    return false;
  }
}

export async function initWebPush() {
  if (configured) return { configured, publicKey };

  subject = process.env.VAPID_SUBJECT || "mailto:support@matjar.app";
  const envPub = process.env.VAPID_PUBLIC_KEY || null;
  const envPriv = process.env.VAPID_PRIVATE_KEY || null;

  // 1. Env-provided keys — but only if they're actually valid VAPID keys.
  if (envPub && envPriv) {
    if (applyKeys(envPub, envPriv, subject)) {
      logger.info("web-push: using VAPID keys from environment");
      return { configured, publicKey };
    }
    logger.error(
      "web-push: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are set but INVALID — they " +
        "must be a P-256 base64url keypair from `npx web-push generate-vapid-keys` " +
        "(NOT `openssl` PEM output). Ignoring them and using a database-managed keypair."
    );
  }

  // 2. Database-managed keypair — load a valid stored pair, else generate +
  //    persist a correct one. This makes background push work out of the box.
  try {
    const col = platformConfigCollection();
    if (!col) {
      logger.error(
        "web-push: no DB connection when initialising VAPID keys — background " +
          "push DISABLED. Call initWebPush() after connectDb()."
      );
      return { configured: false, publicKey: null };
    }
    const doc = await col.findOne({ _id: VAPID_CONFIG_ID });
    if (doc?.publicKey && doc?.privateKey) {
      // The private key is stored encrypted at rest; decryptSecret transparently
      // passes through legacy plaintext keys written before encryption existed.
      let storedPriv;
      try {
        storedPriv = decryptSecret(doc.privateKey);
      } catch (err) {
        logger.error(
          "web-push: stored VAPID private key could not be decrypted (wrong " +
            "SECRET_ENCRYPTION_KEY/JWT_SECRET, or tampering) — regenerating.",
          { error: err?.message }
        );
        storedPriv = null;
      }
      if (storedPriv && applyKeys(doc.publicKey, storedPriv, doc.subject || subject)) {
        logger.info("web-push: loaded VAPID keys from the database");
        // Opportunistically migrate a legacy plaintext key to encrypted at rest.
        if (!isEncrypted(doc.privateKey)) {
          try {
            await col.updateOne(
              { _id: VAPID_CONFIG_ID },
              { $set: { privateKey: encryptSecret(storedPriv), encryptedAt: new Date() } }
            );
            logger.info("web-push: migrated stored VAPID private key to encrypted-at-rest");
          } catch (err) {
            logger.warn("web-push: failed to migrate VAPID private key to encrypted-at-rest", {
              error: err?.message,
            });
          }
        }
        return { configured, publicKey };
      }
    }
    const keys = webpush.generateVAPIDKeys();
    if (applyKeys(keys.publicKey, keys.privateKey, subject)) {
      await col.updateOne(
        { _id: VAPID_CONFIG_ID },
        { $set: { publicKey: keys.publicKey, privateKey: encryptSecret(keys.privateKey), subject, createdAt: new Date() } },
        { upsert: true }
      );
      logger.warn(
        "web-push: generated and stored a new VAPID keypair in the database. " +
          "To manage keys yourself set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY " +
          "(from `npx web-push generate-vapid-keys`) instead."
      );
      return { configured, publicKey };
    }
  } catch (err) {
    logger.error("web-push: failed to load/generate VAPID keys from the DB", {
      error: err?.message,
    });
  }

  return { configured: false, publicKey: null };
}

/** The public (application server) key browsers subscribe against. */
export function getVapidPublicKey() {
  return publicKey;
}

/** True once a valid keypair has been configured. */
export function isWebPushConfigured() {
  return configured;
}

/**
 * Send a single push message.
 *
 * @param {{endpoint:string, keys:{p256dh:string, auth:string}}} subscription
 * @param {object} payload  JSON-serialisable payload (title/body/url/…).
 * @returns {Promise<{ok:true}|{ok:false, statusCode?:number, gone?:boolean, error?:string}>}
 *          `gone` is true for 404/410 — the caller should prune the record.
 */
export async function sendPush(subscription, payload) {
  if (!configured) return { ok: false, error: "web-push-not-configured" };
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys?.p256dh,
          auth: subscription.keys?.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 } // keep for a day if the device is offline
    );
    return { ok: true };
  } catch (err) {
    const statusCode = err?.statusCode;
    const gone = statusCode === 404 || statusCode === 410;
    return { ok: false, statusCode, gone, error: err?.message };
  }
}

export { webpush };
