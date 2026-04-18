import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const categorySchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  description: String,
  parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  status: {
    type: String,
    enum: ["active", "draft", "archived"],
    default: "active",
  },
  icon: String,
  image: String,
  productCount: { type: Number, default: 0 },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

categorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });
categorySchema.index({ tenantId: 1, status: 1 });
categorySchema.index({ tenantId: 1, parent: 1 });
categorySchema.index({ tenantId: 1, sortOrder: 1 });

categorySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(categorySchema);

export default categorySchema;
