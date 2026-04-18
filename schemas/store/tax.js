import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const taxSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  region: { type: String, required: true, trim: true },
  rate: { type: Number, required: true, min: 0, max: 100 },
  applicableCategories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

taxSchema.index({ tenantId: 1, region: 1 });
taxSchema.index({ tenantId: 1, isActive: 1 });

taxSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(taxSchema);

export default taxSchema;
