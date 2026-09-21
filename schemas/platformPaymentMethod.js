import { Schema } from "mongoose";
import { PAYMENT_INTEGRATION_KEYS } from "../config/paymentIntegrations.js";

/**
 * Platform-owned payment method catalog (admin DB). The owner decides which
 * payment methods exist on the platform, how they are presented (label,
 * description, logo, customer fields, manual-transfer providers) and whether
 * they are currently offered. Stores hold a synced copy
 * (schemas/store/paymentMethod.js) where the merchant only toggles
 * `enabled` and fills in their own details.
 */
const customerFieldSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    labelAr: { type: String, default: "" },
    type: { type: String, enum: ["text", "textarea", "number", "file", "select", "email", "tel"], default: "text" },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
    options: [{ label: { type: String }, value: { type: String }, _id: false }],
    accept: { type: String },
    maxSize: { type: Number },
  },
  { _id: false }
);

const providerTemplateSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    logo: { type: String, default: "" },
  },
  { _id: false }
);

const platformPaymentMethodSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    integrationKey: { type: String, required: true, enum: PAYMENT_INTEGRATION_KEYS },
    label: { type: String, required: true, trim: true },
    labelAr: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    descriptionAr: { type: String, default: "" },
    instructions: { type: String, default: "" },
    instructionsAr: { type: String, default: "" },
    logo: { type: String, default: "" },
    icon: { type: String, default: "" },
    // Offered on the platform at all. Off = hidden from every storefront and
    // shown as "unavailable" in merchant dashboards.
    enabled: { type: Boolean, default: false },
    // New stores get it switched on without merchant action (COD).
    enabledByDefault: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    customerFields: { type: [customerFieldSchema], default: [] },
    providers: { type: [providerTemplateSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "TenantUser", default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

platformPaymentMethodSchema.index({ enabled: 1, order: 1 });
platformPaymentMethodSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default platformPaymentMethodSchema;
