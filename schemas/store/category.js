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
  // Optional per-language display overrides. `name` is the default/fallback;
  // the storefront shows `translations[lang].name` when the merchant has filled
  // it in (Dashboard → Categories). Keeps a bilingual (en/ar) storefront without
  // duplicating categories. Extend with more fields (e.g. description) as needed.
  translations: {
    en: { name: { type: String, trim: true, default: "" } },
    ar: { name: { type: String, trim: true, default: "" } },
  },
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
  // Marks a demo category auto-seeded on theme activation (see
  // services/themeDemoData.js). Used to find & remove demo content on switch.
  isDemo: { type: Boolean, default: false },
  // Set on categories the platform creates for the merchant (e.g. "quick-add",
  // the home of products added with the quick product form) so they can be
  // found again without relying on a name or slug the merchant may change.
  systemKey: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

categorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });
categorySchema.index({ tenantId: 1, status: 1 });
categorySchema.index({ tenantId: 1, parent: 1 });
categorySchema.index({ tenantId: 1, sortOrder: 1 });
// One system category per key per store; the partial filter leaves ordinary
// categories (no systemKey) out of the index.
categorySchema.index(
  { tenantId: 1, systemKey: 1 },
  { unique: true, partialFilterExpression: { systemKey: { $type: "string" } } }
);

categorySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(categorySchema);

export default categorySchema;
