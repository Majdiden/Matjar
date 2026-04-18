import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const promotionSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  description: String,
  discountType: { type: String, enum: ["percentage", "fixed"], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  applicableProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  applicableCategories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
  minOrderAmount: { type: Number, default: 0, min: 0 },
  maxUsage: { type: Number, default: null },
  usedCount: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

promotionSchema.index({ tenantId: 1, isActive: 1, startDate: 1, endDate: 1 });
promotionSchema.index({ tenantId: 1, name: 1 });

promotionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(promotionSchema);

export default promotionSchema;
