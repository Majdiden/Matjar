import crypto from "node:crypto";
import {
  listWebhooksRepo,
  getWebhookRepo,
  createWebhookRepo,
  updateWebhookRepo,
  deleteWebhookRepo,
  activeWebhooksForEventRepo,
  recordDeliveryRepo,
} from "../repositories/webhook.js";
import { WEBHOOK_EVENTS } from "../schemas/store/webhook.js";
import { APIError } from "../middlewares/errorHandler.js";
import logger from "../utils/logger.js";

const generateSecret = () => `whsec_${crypto.randomBytes(24).toString("hex")}`;

export const listWebhooks = async (models) => {
  const rows = await listWebhooksRepo(models);
  return rows.map((r) => ({
    ...r,
    enabled: r.isActive,
  }));
};

export const getWebhook = async (models, id) => {
  const row = await getWebhookRepo(models, id);
  if (!row) throw new APIError("Webhook not found", 404);
  return { ...row, enabled: row.isActive };
};

export const createWebhook = async (models, tenantId, { url, description, events, enabled = true }) => {
  if (!url || typeof url !== "string") throw new APIError("url is required", 400);
  if (!Array.isArray(events) || events.length === 0) throw new APIError("events is required", 400);
  const invalid = events.filter((e) => !WEBHOOK_EVENTS.includes(e));
  if (invalid.length) throw new APIError(`Unsupported events: ${invalid.join(", ")}`, 400);
  try {
    new URL(url);
  } catch {
    throw new APIError("url must be a valid URL", 400);
  }
  const doc = await createWebhookRepo(models, {
    tenantId,
    url: url.trim(),
    description: (description || "").trim(),
    events,
    secret: generateSecret(),
    isActive: enabled,
  });
  const row = doc.toObject();
  return { ...row, enabled: row.isActive };
};

export const updateWebhook = async (models, id, patch) => {
  const allowed = {};
  if (typeof patch.url === "string") {
    try { new URL(patch.url); } catch { throw new APIError("url must be a valid URL", 400); }
    allowed.url = patch.url.trim();
  }
  if (typeof patch.description === "string") allowed.description = patch.description.trim();
  if (Array.isArray(patch.events)) {
    const invalid = patch.events.filter((e) => !WEBHOOK_EVENTS.includes(e));
    if (invalid.length) throw new APIError(`Unsupported events: ${invalid.join(", ")}`, 400);
    allowed.events = patch.events;
  }
  if (typeof patch.enabled === "boolean") allowed.isActive = patch.enabled;
  const row = await updateWebhookRepo(models, id, allowed);
  if (!row) throw new APIError("Webhook not found", 404);
  return { ...row, enabled: row.isActive };
};

export const deleteWebhook = async (models, id) => {
  const row = await deleteWebhookRepo(models, id);
  if (!row) throw new APIError("Webhook not found", 404);
  return { id };
};

export function signPayload(body, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = `${timestamp}.${body}`;
  const sig = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  return { timestamp, signature: `t=${timestamp},v1=${sig}` };
}

/**
 * Deliver a single event to a single webhook with bounded timeout.
 * No retry here — the dispatcher handles retries via failureCount tracking
 * and the caller (BullMQ processor in production) can re-enqueue on failure.
 */
/**
 * Size-bounded copy of the event data kept in the delivery history (≤ 8 KB).
 * Oversized payloads are NOT previewed (a sliced JSON string could expose a
 * secret-named key mid-redaction); the row is marked truncated and the
 * inspector refuses to retry it.
 */
function boundedPayload(data) {
  try {
    const s = JSON.stringify(data ?? null);
    if (s.length <= 8192) return data ?? null;
    return { truncated: true, bytes: s.length };
  } catch {
    return null;
  }
}

export async function deliverWebhook(models, webhook, event, data, { retryOf = null, attempt = 1 } = {}) {
  const body = JSON.stringify({ event, tenantId: String(webhook.tenantId), data, timestamp: new Date().toISOString() });
  const { signature, timestamp } = signPayload(body, webhook.secret);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const startedAt = Date.now();
  // Best-effort delivery history row (platform inspector + merchant history).
  // Never throws — a history write failure must not affect delivery.
  const record = async (status, responseStatus, error) => {
    if (!models.WebhookDelivery) return;
    try {
      await models.WebhookDelivery.create({
        webhookId: webhook._id,
        event,
        url: webhook.url,
        status,
        responseStatus,
        error: error ? String(error).slice(0, 500) : null,
        durationMs: Date.now() - startedAt,
        payload: boundedPayload(data),
        retryOf,
        attempt,
      });
    } catch (e) {
      logger.warn("Webhook delivery history write failed", { error: e.message });
    }
  };
  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": String(timestamp),
      },
      body,
      signal: controller.signal,
    });
    await recordDeliveryRepo(models, webhook._id, { success: res.ok, status: res.status });
    await record(res.ok ? "success" : "failed", res.status, res.ok ? null : `HTTP ${res.status}`);
    return { success: res.ok, status: res.status };
  } catch (err) {
    await recordDeliveryRepo(models, webhook._id, { success: false, status: 0, error: err.message });
    await record("failed", null, err.message);
    logger.warn("Webhook delivery failed", { url: webhook.url, event, error: err.message });
    return { success: false, status: 0, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

export const dispatchEvent = async (models, event, data) => {
  const hooks = await activeWebhooksForEventRepo(models, event);
  return Promise.all(hooks.map((h) => deliverWebhook(models, h, event, data)));
};

export const testWebhook = async (models, id) => {
  const hook = await getWebhookRepo(models, id);
  if (!hook) throw new APIError("Webhook not found", 404);
  return deliverWebhook(models, hook, "webhook.test", { ping: true });
};
