import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const ruleSchema = new Schema(
  {
    field: {
      type: String,
      required: true,
      enum: ["tag", "title", "price", "inventory", "category"],
    },
    operator: {
      type: String,
      required: true,
      enum: ["equals", "not_equals", "greater_than", "less_than", "contains", "starts_with", "ends_with", "in"],
    },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const collectionSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  title: { type: String, required: true, trim: true },
  handle: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, default: "" },
  descriptionHtml: { type: String, default: "" },
  image: {
    url: { type: String },
    alt: { type: String },
  },
  type: { type: String, enum: ["manual", "smart"], default: "manual" },
  productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  rules: [ruleSchema],
  rulesMatch: { type: String, enum: ["all", "any"], default: "all" },
  sortOrder: {
    type: String,
    enum: ["manual", "best-selling", "title-asc", "title-desc", "price-asc", "price-desc", "created-desc", "created-asc"],
    default: "manual",
  },
  isPublished: { type: Boolean, default: true },
  publishedAt: { type: Date },
  // Marks a storefront demo collection auto-seeded when a tenant activates a
  // theme (see services/themeDemoData.js). Demo docs are removed/replaced on
  // the next theme switch and are never created once the store has any real
  // merchant products, so this flag is how we find them again.
  isDemo: { type: Boolean, default: false },
  seo: {
    title: { type: String },
    description: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

collectionSchema.index({ tenantId: 1, handle: 1 }, { unique: true });
collectionSchema.index({ tenantId: 1, isPublished: 1 });

collectionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(collectionSchema);

export default collectionSchema;
