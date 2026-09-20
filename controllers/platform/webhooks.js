import mongoose from "mongoose";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { clampInt } from "../../utils/misc.js";
import { WEBHOOK_EVENTS } from "../../schemas/store/webhook.js";
import { listDeliveries, getDelivery, retryDelivery, listDeliveryEvents } from "../../services/platform/webhooks.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import logger from "../../utils/logger.js";

const KNOWN_EVENTS = new Set([...WEBHOOK_EVENTS, "webhook.test"]);

function parseDate(v) {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** GET /api/platform/webhooks/deliveries?tenantId=&status=&event=&from=&to=&page=&limit= */
export const listWebhookDeliveries = asyncHandler(async (req, res) => {
  const q = req.query;
  if (q.tenantId && !mongoose.Types.ObjectId.isValid(String(q.tenantId))) {
    return res.status(400).json({ success: false, message: "Invalid tenantId." });
  }
  if (q.status && !["success", "failed"].includes(String(q.status))) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }
  if (q.event && !KNOWN_EVENTS.has(String(q.event))) {
    return res.status(400).json({ success: false, message: "Unknown event." });
  }
  const from = parseDate(q.from);
  const to = parseDate(q.to);
  if (from === undefined || to === undefined) {
    return res.status(400).json({ success: false, message: "Invalid date range." });
  }
  const data = await listDeliveries({
    tenantId: q.tenantId ? String(q.tenantId) : null,
    status: q.status ? String(q.status) : null,
    event: q.event ? String(q.event) : null,
    from,
    to,
    page: clampInt(q.page, 1, 1, 100000),
    limit: clampInt(q.limit, 25, 1, 100),
  });
  res.json({ success: true, data });
});

/** GET /api/platform/webhooks/events */
export const listWebhookEvents = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: listDeliveryEvents() });
});

/** GET /api/platform/webhooks/deliveries/:tenantId/:id */
export const getWebhookDelivery = asyncHandler(async (req, res) => {
  const data = await getDelivery(req.params.tenantId, req.params.id);
  res.json({ success: true, data });
});

/** POST /api/platform/webhooks/deliveries/:tenantId/:id/retry — queue.retry */
export const retryWebhookDelivery = asyncHandler(async (req, res) => {
  const { tenantId, id } = req.params;
  let out;
  try {
    out = await retryDelivery(tenantId, id);
  } catch (err) {
    await recordPlatformAudit(req, {
      action: "webhook.delivery.retry",
      resourceType: "WebhookDelivery",
      resourceId: id,
      tenantId,
      outcome: "failure",
      metadata: { error: err.message },
    });
    throw err;
  }
  logger.warn("Platform: webhook delivery retried", { tenantId, deliveryId: id, by: req.platformUser.email, ok: out.result.success });
  await recordPlatformAudit(req, {
    action: "webhook.delivery.retry",
    resourceType: "WebhookDelivery",
    resourceId: id,
    tenantId,
    after: { success: out.result.success, status: out.result.status, newDeliveryId: out.delivery?._id || null },
  });
  res.json({ success: true, data: out });
});
