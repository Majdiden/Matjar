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

let publicKey = null;
let privateKey = null;
let subject = null;
let configured = false;

// Singleton doc holding the auto-generated VAPID keypair, in the admin DB.
// The keypair must be STABLE across restarts and redeploys — a rotated key
// silently invalidates every subscription a browser already stored — so we
// persist it in the database (not a local file, which an ephemeral container
// filesystem loses on redeploy).
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
export async function initWebPush() {
  if (configured) return { configured, publicKey };

  subject = process.env.VAPID_SUBJECT || "mailto:support@matjar.app";
  publicKey = process.env.VAPID_PUBLIC_KEY || null;
  privateKey = process.env.VAPID_PRIVATE_KEY || null;

  if (publicKey && privateKey) {
    logger.info("web-push: using VAPID keys from environment");
  } else {
    try {
      const col = platformConfigCollection();
      if (col) {
        const doc = await col.findOne({ _id: VAPID_CONFIG_ID });
        if (doc?.publicKey && doc?.privateKey) {
          publicKey = doc.publicKey;
          privateKey = doc.privateKey;
          if (doc.subject) subject = doc.subject;
          logger.info("web-push: loaded VAPID keys from the database");
        } else {
          const keys = webpush.generateVAPIDKeys();
          publicKey = keys.publicKey;
          privateKey = keys.privateKey;
          await col.updateOne(
            { _id: VAPID_CONFIG_ID },
            { $set: { publicKey, privateKey, subject, createdAt: new Date() } },
            { upsert: true }
          );
          logger.warn(
            "web-push: generated and stored a new VAPID keypair in the database. " +
              "To manage keys yourself (rotation, multi-cluster), set " +
              "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars instead."
          );
        }
      } else {
        logger.error(
          "web-push: no DB connection when initialising VAPID keys — " +
            "background push DISABLED. Call initWebPush() after connectDb()."
        );
      }
    } catch (err) {
      logger.error("web-push: failed to load/generate VAPID keys from the DB", {
        error: err?.message,
      });
    }
  }

  if (!publicKey || !privateKey) {
    return { configured: false, publicKey: null };
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (err) {
    logger.error("web-push: setVapidDetails failed", { error: err?.message });
    configured = false;
    return { configured: false, publicKey: null };
  }

  return { configured, publicKey };
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
