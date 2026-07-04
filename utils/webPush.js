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

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import webpush from "web-push";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAPID_FILE = path.join(__dirname, "..", ".vapid.json");

let publicKey = null;
let privateKey = null;
let subject = null;
let configured = false;

/**
 * Load or (in dev) generate the VAPID keypair and configure the web-push
 * library. Idempotent — safe to call more than once. Call once at boot.
 */
export function initWebPush() {
  if (configured) return { configured, publicKey };

  subject = process.env.VAPID_SUBJECT || "mailto:support@matjar.app";
  publicKey = process.env.VAPID_PUBLIC_KEY || null;
  privateKey = process.env.VAPID_PRIVATE_KEY || null;

  if (publicKey && privateKey) {
    logger.info("web-push: using VAPID keys from environment");
  } else {
    // Dev fallback — persist a stable pair so restarts don't invalidate
    // subscriptions. Production is expected to set the env vars above.
    if (process.env.NODE_ENV === "production") {
      logger.error(
        "web-push: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set in production. " +
          "Background push notifications are DISABLED until they are configured."
      );
      return { configured: false, publicKey: null };
    }
    try {
      if (fs.existsSync(VAPID_FILE)) {
        const saved = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
        publicKey = saved.publicKey || null;
        privateKey = saved.privateKey || null;
        if (publicKey && privateKey) {
          logger.warn(
            "web-push: using persisted dev VAPID keys from .vapid.json. " +
              "Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars in production."
          );
        }
      }
      if (!publicKey || !privateKey) {
        const keys = webpush.generateVAPIDKeys();
        publicKey = keys.publicKey;
        privateKey = keys.privateKey;
        fs.writeFileSync(
          VAPID_FILE,
          JSON.stringify({ publicKey, privateKey }, null, 2),
          "utf8"
        );
        logger.warn(
          "web-push: generated a NEW dev VAPID keypair and saved it to .vapid.json. " +
            "Set these as env vars in production (do NOT commit them):\n" +
            `  VAPID_PUBLIC_KEY=${publicKey}\n` +
            `  VAPID_PRIVATE_KEY=${privateKey}`
        );
      }
    } catch (err) {
      logger.error("web-push: failed to load/generate dev VAPID keys", {
        error: err?.message,
      });
      return { configured: false, publicKey: null };
    }
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
