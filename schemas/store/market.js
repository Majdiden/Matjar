import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const marketSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  name: { type: String, required: true }, // e.g., "United States", "European Union"
  handle: { type: String, required: true, lowercase: true, trim: true },
  isActive: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false },

  // Geographic targeting
  countries: [{ type: String, required: true }], // ISO 3166-1 alpha-2 codes

  // Currency and pricing
  currency: { type: String, required: true, default: "SDG" },
  currencyRounding: { type: String, enum: ["none", "up", "down", "nearest"], default: "nearest" },
  priceAdjustment: {
    type: { type: String, enum: ["none", "percentage", "fixed"], default: "none" },
    value: { type: Number, default: 0 },
  },

  // Localization
  language: { type: String, default: "en" },

  // Tax configuration for this market
  taxBehavior: { type: String, enum: ["inclusive", "exclusive"], default: "exclusive" },
  dutiesEnabled: { type: Boolean, default: false },

  // Catalog visibility — products/collections visible in this market
  catalogMode: { type: String, enum: ["all", "include", "exclude"], default: "all" },
  includedProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  excludedProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

marketSchema.index({ tenantId: 1, handle: 1 }, { unique: true });
marketSchema.index({ tenantId: 1, countries: 1 });
marketSchema.index({ tenantId: 1, isPrimary: 1 });

marketSchema.pre("save", function(next) { this.updatedAt = Date.now(); next(); });

applyTenantScope(marketSchema);
export default marketSchema;
