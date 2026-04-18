import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

export const WEBHOOK_EVENTS = [
  "order.created",
  "order.updated",
  "order.cancelled",
  "order.fulfilled",
  "order.refunded",
  "product.created",
  "product.updated",
  "product.deleted",
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "customer.created",
  "customer.updated",
  "inventory.low_stock",
  "inventory.updated",
  "theme.published",
  "theme.installed",
];

const webhookSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  url: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
  events: [{ type: String, enum: WEBHOOK_EVENTS }],
  secret: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastTriggered: Date,
  lastDelivery: {
    success: Boolean,
    status: Number,
    timestamp: Date,
    error: String,
  },
  failureCount: { type: Number, default: 0, min: 0 },
  maxRetries: { type: Number, default: 3 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

webhookSchema.index({ tenantId: 1, isActive: 1 });
webhookSchema.index({ tenantId: 1, events: 1 });

webhookSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(webhookSchema);

export default webhookSchema;
