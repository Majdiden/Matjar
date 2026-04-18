import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const companySchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  name: { type: String, required: true, trim: true },
  taxId: String,

  // Company contacts
  contacts: [{
    user: { type: Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["admin", "buyer", "viewer"], default: "buyer" },
    isPrimary: { type: Boolean, default: false },
  }],

  // Locations — each can have its own shipping address and catalog access
  locations: [{
    name: { type: String, required: true },
    address: {
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      phone: String,
    },
    isDefault: { type: Boolean, default: false },
  }],

  // Payment terms
  paymentTerms: {
    type: { type: String, enum: ["none", "net15", "net30", "net60", "net90", "custom"], default: "none" },
    customDays: Number,
    creditLimit: { type: Number, min: 0 },
    currentBalance: { type: Number, default: 0, min: 0 },
  },

  // Catalog — company-specific pricing
  catalogId: { type: Schema.Types.ObjectId, ref: "Catalog" }, // Future: link to price lists
  priceAdjustment: {
    type: { type: String, enum: ["none", "percentage", "fixed"], default: "none" },
    value: { type: Number, default: 0 },
  },

  status: { type: String, enum: ["active", "inactive", "pending"], default: "active" },
  notes: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

companySchema.index({ tenantId: 1, name: 1 });
companySchema.index({ tenantId: 1, "contacts.user": 1 });
companySchema.index({ tenantId: 1, status: 1 });

companySchema.pre("save", function(next) { this.updatedAt = Date.now(); next(); });

applyTenantScope(companySchema);
export default companySchema;
