import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const productI18nSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  language: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  seoTitle: String,
  seoDescription: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// One translation per product per language per tenant
productI18nSchema.index(
  { tenantId: 1, product: 1, language: 1 },
  { unique: true }
);

productI18nSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(productI18nSchema);

export default productI18nSchema;
