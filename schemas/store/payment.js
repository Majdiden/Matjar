import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const paymentSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
  provider: {
    type: String,
    enum: ["stripe", "paypal", "manual", "giftcard"],
    required: true,
  },
  providerTransactionId: { type: String, sparse: true },
  eventId: { type: String, sparse: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "SDG", trim: true },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded", "partially_refunded"],
    default: "pending",
  },
  paymentMethod: String,
  metadata: Schema.Types.Mixed,
  refundAmount: { type: Number, default: 0, min: 0 },
  refundedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

paymentSchema.index({ tenantId: 1, order: 1 });
paymentSchema.index({ tenantId: 1, status: 1 });
paymentSchema.index({ tenantId: 1, provider: 1, providerTransactionId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ tenantId: 1, eventId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ tenantId: 1, createdAt: -1 });

paymentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(paymentSchema);

export default paymentSchema;
