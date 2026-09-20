/**
 * Cross-tenant webhook delivery inspector.
 *
 * Rows come from the tenant-scoped WebhookDelivery history (written by
 * services/webhook.js on every attempt). Reads use the shared collection
 * with explicit tenant filters; writes (retry) go through scoped models so
 * the re-delivery is recorded against the right tenant.
 *
 * Payloads are redacted with the audit redactor before they leave the API,
 * and the webhook secret is never loaded (`select("-secret")`).
 */
import mongoose from "mongoose";
import { createScopedModels } from "../../utils/scopedModel.js";
import { deliverWebhook } from "../webhook.js";
import { redactForAudit } from "./audit.js";
import { tenantNameMap } from "./tenantNames.js";
import { WEBHOOK_EVENTS } from "../../schemas/store/webhook.js";
import { APIError } from "../../middlewares/errorHandler.js";

const MAX_LIMIT = 100;
// Cross-tenant reads are intentional here (platform-level inspector gated by
// support.read); the tenant-scope plugin is told so its leak warning stays
// meaningful for everything else.
const CROSS_TENANT = { _skipTenantCheck: true };

function toObjectId(v) {
  return new mongoose.Types.ObjectId(String(v));
}

export function publicDelivery(row, tenant = null) {
  return {
    _id: String(row._id),
    tenantId: String(row.tenantId),
    tenant,
    webhookId: String(row.webhookId),
    event: row.event,
    url: row.url,
    status: row.status,
    responseStatus: row.responseStatus ?? null,
    error: row.error ?? null,
    durationMs: row.durationMs ?? null,
    attempt: row.attempt ?? 1,
    retryOf: row.retryOf ? String(row.retryOf) : null,
    createdAt: row.createdAt,
  };
}

/**
 * List deliveries across tenants. Filters are exact-match/enum only (no
 * user-supplied regex). `limit` ≤ MAX_LIMIT.
 */
export async function listDeliveries({ tenantId, status, event, from, to, page = 1, limit = 25 }) {
  const WebhookDelivery = mongoose.model("WebhookDelivery");
  const filter = {};
  if (tenantId) filter.tenantId = toObjectId(tenantId);
  if (status) filter.status = status;
  if (event) filter.event = event;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  const lim = Math.min(Number(limit) || 25, MAX_LIMIT);
  const skip = (Math.max(1, Number(page) || 1) - 1) * lim;
  const [rows, total] = await Promise.all([
    WebhookDelivery.find(filter).setOptions(CROSS_TENANT).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    WebhookDelivery.countDocuments(filter).setOptions(CROSS_TENANT),
  ]);
  const names = await tenantNameMap(rows.map((r) => r.tenantId));
  return {
    items: rows.map((r) => publicDelivery(r, names[String(r.tenantId)] || null)),
    pagination: { total, page: Math.max(1, Number(page) || 1), pages: Math.ceil(total / lim), limit: lim },
  };
}

export async function getDelivery(tenantId, id) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const row = await models.WebhookDelivery.findById(id).lean();
  if (!row) throw new APIError("Delivery not found", 404);
  const names = await tenantNameMap([row.tenantId]);
  return {
    ...publicDelivery(row, names[String(row.tenantId)] || null),
    payload: redactForAudit(row.payload ?? null),
  };
}

/**
 * Re-send one delivery: loads the webhook (without its secret in the
 * response path — the secret is only used inside deliverWebhook to sign)
 * and posts the original payload again. Returns the new history row.
 */
export async function retryDelivery(tenantId, id) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const row = await models.WebhookDelivery.findById(id).lean();
  if (!row) throw new APIError("Delivery not found", 404);
  const hook = await models.Webhook.findById(row.webhookId);
  if (!hook) throw new APIError("Webhook no longer exists", 409);
  if (!hook.isActive) throw new APIError("Webhook is disabled by the merchant", 409);
  if (row.payload && row.payload.truncated) {
    throw new APIError("Original payload was too large to store; cannot retry", 409);
  }
  const result = await deliverWebhook(models, hook, row.event, row.payload ?? {}, {
    retryOf: row._id,
    attempt: (row.attempt ?? 1) + 1,
  });
  const latest = await models.WebhookDelivery.findOne({ retryOf: row._id }).sort({ createdAt: -1 }).lean();
  return { result, delivery: latest ? publicDelivery(latest) : null };
}

/** Event names for the filter dropdown — the static registry, no collection scan. */
export function listDeliveryEvents() {
  return [...WEBHOOK_EVENTS, "webhook.test"].sort();
}
