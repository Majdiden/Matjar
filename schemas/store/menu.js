import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

// Declare menuItemSchema first (without children), then add children recursively
const menuItemSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    // Optional per-language label overrides. `label` is the default/fallback;
    // the storefront shows `translations[lang].label` when the merchant filled
    // it in (Dashboard → Menus). Applies at every nesting level.
    translations: {
      en: { label: { type: String, trim: true, default: "" } },
      ar: { label: { type: String, trim: true, default: "" } },
    },
    url: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: ["link", "collection", "product", "category", "page", "external"],
      default: "link",
    },
    resourceId: { type: Schema.Types.ObjectId, default: null },
    target: { type: String, enum: ["_self", "_blank"], default: "_self" },
    icon: { type: String, trim: true, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

// Recursive children — Mongoose supports self-referential sub-schemas this way
menuItemSchema.add({ children: { type: [menuItemSchema], default: [] } });

const menuSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  handle: { type: String, required: true, trim: true, lowercase: true },
  title: { type: String, required: true, trim: true },
  location: {
    type: String,
    enum: ["header", "footer", "mobile", "custom"],
    default: "custom",
  },
  items: { type: [menuItemSchema], default: [] },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

menuSchema.index({ tenantId: 1, handle: 1 }, { unique: true });
menuSchema.index({ tenantId: 1, location: 1 });

menuSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(menuSchema);

export default menuSchema;
