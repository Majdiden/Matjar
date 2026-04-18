import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const customerFieldSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["text", "textarea", "number", "file", "select", "email", "tel"],
      default: "text",
    },
    required: { type: Boolean, default: false },
    placeholder: { type: String },
    options: [
      {
        label: { type: String },
        value: { type: String },
        _id: false,
      },
    ],
    accept: { type: String },
    maxSize: { type: Number },
  },
  { _id: false }
);

/**
 * Sub-provider under a manual-transfer method (Bankak, Fawry, OCash, …).
 * Each provider carries the merchant's own receiving-account info —
 * shown to the customer at checkout after they pick the provider.
 * Merchants enable + fill account details; they can't add/remove the
 * provider list itself (system-defined).
 */
const manualProviderSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    logo: { type: String, default: "" },
    enabled: { type: Boolean, default: false },
    accountNumber: { type: String, default: "" },
    beneficiaryName: { type: String, default: "" },
    phone: { type: String, default: "" },
    instructions: { type: String, default: "" },
  },
  { _id: false }
);

const paymentMethodSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  code: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ["gateway", "manual", "cod"],
    required: true,
  },
  label: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  providerLogos: { type: [String], default: [] },
  icon: { type: String, default: "" },
  enabled: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  instructions: { type: String, default: "" },
  customerFields: { type: [customerFieldSchema], default: [] },
  // Manual-transfer sub-providers. Only populated when type === "manual".
  providers: { type: [manualProviderSchema], default: [] },
  // Provider secrets (API keys, webhook secrets, etc.) — never returned
  // to the storefront. `select: false` keeps these out of query results
  // unless explicitly requested by admin code.
  config: { type: Schema.Types.Mixed, select: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

paymentMethodSchema.index({ tenantId: 1, code: 1 }, { unique: true });
paymentMethodSchema.index({ tenantId: 1, enabled: 1, order: 1 });

paymentMethodSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(paymentMethodSchema);

export default paymentMethodSchema;
