import { Schema } from "mongoose";

/**
 * Subscription plan catalog (admin DB).
 *
 * Platform-level pricing/feature catalog managed by platform operators.
 * A tenant references a plan by its `key` slug via tenant.subscriptionPlan;
 * the catalog row is the source of truth for price, features, and limits.
 *
 * No Stripe/billing integration lives here — this is purely the catalog +
 * a tenant's assignment to a plan. Registered on the shared/admin
 * connection in utils/initDbConnection.js alongside Tenant/Subscription.
 */

// No platform currency lives in config; mirror the tenant settings
// default (schemas/tenant.js settings.currency) so a brand-new plan
// renders with a sensible currency out of the box.
const DEFAULT_CURRENCY = "SDG";

const subscriptionPlanSchema = new Schema({
  // Stable slug a tenant is assigned to (e.g. "trial", "starter", "pro").
  // Immutable identifier — tenants reference it by value.
  key: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  price: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: DEFAULT_CURRENCY, uppercase: true, trim: true },
  interval: { type: String, enum: ["month", "year"], default: "month" },
  features: { type: [String], default: [] },

  // Entitlement limits applied to a tenant when the plan is assigned.
  // `null` means "not enforced by this plan".
  limits: {
    maxProducts: { type: Number, default: null },
    maxStaff: { type: Number, default: null },
  },

  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

subscriptionPlanSchema.index({ sortOrder: 1, key: 1 });

subscriptionPlanSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default subscriptionPlanSchema;
