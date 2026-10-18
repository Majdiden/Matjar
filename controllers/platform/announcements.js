/**
 * Platform announcements (PBI 10-46). Scope: announcements.send (routes).
 * Sending records a platform audit row; delivery runs in the background.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import * as svc from "../../services/platform/announcements.js";
import logger from "../../utils/logger.js";

export const list = asyncHandler(async (_req, res) => {
  const items = await svc.listAnnouncements();
  res.json({ success: true, data: { announcements: items.map(svc.publicAnnouncement) } });
});

export const audience = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.measureAudience(req.query) });
});

export const send = asyncHandler(async (req, res) => {
  const { doc, delivery } = await svc.sendAnnouncement(req.body, {
    id: req.platformUser.id,
    email: req.platformUser.email,
  });
  delivery.catch((err) => logger.error("announcement delivery threw", { error: err?.message }));
  await recordPlatformAudit(req, {
    action: "announcement.send",
    resourceType: "Announcement",
    resourceId: doc._id,
    after: { target: doc.target, tenantId: doc.tenantId, stores: doc.tenantIds?.length, channels: doc.channels, title: doc.title },
  });
  res.status(202).json({ success: true, data: svc.publicAnnouncement(doc.toObject()) });
});
