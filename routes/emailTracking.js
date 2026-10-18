/**
 * Announcement email tracking (PBI 10-54), public and token-signed:
 *   GET /e/o/:token  1×1 image that records the open;
 *   GET /e/c/:token  records the click, then redirects into the dashboard
 *                    page the message links to (taken from the stored
 *                    message, never from the URL).
 * A bad token still gets the image / a redirect to the dashboard, so a mail
 * client never shows a broken image and a reader is never stranded.
 */
import { Router } from "express";
import config from "../config/index.js";
import logger from "../utils/logger.js";
import { readTrackingToken } from "../utils/announcementTracking.js";
import { recordEmailEvent } from "../services/platform/announcements.js";

const router = Router();

// The smallest transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

router.get("/o/:token", async (req, res) => {
  const ids = readTrackingToken(req.params.token);
  if (ids) await recordEmailEvent(ids, "email_open").catch((err) => logger.warn("email open not recorded", { error: err?.message }));
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0", "Content-Length": PIXEL.length });
  res.end(PIXEL);
});

router.get("/c/:token", async (req, res) => {
  const ids = readTrackingToken(req.params.token);
  let link = null;
  if (ids) {
    const doc = await recordEmailEvent(ids, "email_click").catch((err) => {
      logger.warn("email click not recorded", { error: err?.message });
      return null;
    });
    link = doc?.link || null;
  }
  // Only dashboard paths are stored (validators/announcements.validator.js).
  const path = link && /^\/dashboard(\/|$|\?)/.test(link) ? link : "/dashboard";
  res.redirect(302, `${config.publicDashboardUrl}${path}`);
});

export default router;
