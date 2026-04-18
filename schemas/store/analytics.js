import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const analyticsSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      "page_view",
      "product_view",
      "add_to_cart",
      "remove_from_cart",
      "checkout_start",
      "checkout_complete",
      "search",
      "signup",
      "login",
    ],
  },
  eventData: Schema.Types.Mixed,
  user: { type: Schema.Types.ObjectId, ref: "User" },
  sessionId: String,
  ipAddress: String,
  userAgent: String,
  referrer: String,
  createdAt: { type: Date, default: Date.now },
});

analyticsSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
analyticsSchema.index({ tenantId: 1, createdAt: -1 });
analyticsSchema.index({ tenantId: 1, user: 1, createdAt: -1 });
// TTL: auto-delete analytics older than 1 year
analyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

applyTenantScope(analyticsSchema);

export default analyticsSchema;
