import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const shippingSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  description: String,
  baseRate: { type: Number, required: true, min: 0 },
  ratePerKg: { type: Number, default: 0, min: 0 },
  estimatedDays: { type: Number, required: true, min: 0 },
  zones: [{ type: String, trim: true }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

shippingSchema.index({ tenantId: 1, isActive: 1 });
shippingSchema.index({ tenantId: 1, zones: 1 });

shippingSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(shippingSchema);

export default shippingSchema;
