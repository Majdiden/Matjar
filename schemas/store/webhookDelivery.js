import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

/**
 * One row per webhook delivery attempt (tenant-scoped). Written by
 * services/webhook.js → deliverWebhook after every POST so the platform
 * console can inspect and retry deliveries without database access, and the
 * merchant Webhooks page can show a delivery history.
 *
 * Only a bounded, redacted view of the payload is stored (no secrets, no
 * signature); rows expire after 30 days.
 */
const webhookDeliverySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    webhookId: { type: Schema.Types.ObjectId, ref: "Webhook", required: true, index: true },
    event: { type: String, required: true },
    url: { type: String, required: true },
    status: { type: String, enum: ["success", "failed"], required: true },
    responseStatus: { type: Number, default: null },
    error: { type: String, default: null },
    durationMs: { type: Number, default: null },
    // Redacted, size-bounded copy of what was sent (data only — no headers).
    payload: { type: Schema.Types.Mixed, default: null },
    attempt: { type: Number, default: 1 },
    // Set when an operator re-sent this delivery from the platform console.
    retryOf: { type: Schema.Types.ObjectId, ref: "WebhookDelivery", default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

webhookDeliverySchema.index({ tenantId: 1, createdAt: -1 });
webhookDeliverySchema.index({ tenantId: 1, status: 1, createdAt: -1 });
webhookDeliverySchema.index({ status: 1, createdAt: -1 }); // cross-tenant inspector
webhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

applyTenantScope(webhookDeliverySchema);

export default webhookDeliverySchema;
