/**
 * Signed tokens for announcement email tracking (PBI 10-54).
 *
 * Each email carries its own token naming the message, the store and the
 * person: `<payload>.<signature>`, both base64url. The tracking image
 * (/e/o/<token>) records an open and the button link (/e/c/<token>) a click
 * before redirecting into the dashboard. The redirect target comes from the
 * stored message, never from the token, so the link cannot be turned into an
 * open redirect; a forged or altered token is ignored.
 */
import crypto from "node:crypto";
import config from "../config/index.js";

const SIG_BYTES = 16;
const OBJECT_ID = /^[a-f0-9]{24}$/;

const key = () =>
  crypto.createHash("sha256").update(`announcement-tracking:${config.jwtSecret || ""}`).digest();

const sign = (payload) =>
  crypto.createHmac("sha256", key()).update(payload).digest().subarray(0, SIG_BYTES).toString("base64url");

/** Token for one email: which message, store and person. */
export function trackingToken({ announcementId, tenantId, userId }) {
  const payload = Buffer.from(`${announcementId}.${tenantId}.${userId}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The ids in a token, or null when it is malformed or not ours. */
export function readTrackingToken(token) {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  const [announcementId, tenantId, userId] = Buffer.from(payload, "base64url").toString().split(".");
  if (![announcementId, tenantId, userId].every((id) => OBJECT_ID.test(id || ""))) return null;
  return { announcementId, tenantId, userId };
}

/** Absolute URLs of the tracking image and the tracked button for one email. */
export function trackingUrls(ids) {
  const token = trackingToken(ids);
  const base = config.publicDashboardUrl;
  return { pixelUrl: `${base}/e/o/${token}`, clickUrl: `${base}/e/c/${token}` };
}
