import { Schema } from "mongoose";

/**
 * Subscription plan catalog (admin DB).
 *
 * Two plan FAMILIES the merchant chooses between
 * (docs/plans/platform-admin-operating-system.md §2):
 *
 *   commission    no base fee; a percentage of delivered sales computed by the
 *                 referenced CommissionPolicy (admin-controlled tiers).
 *   subscription  a fixed base fee per month/year; no percentage.
 *   hybrid        both (representable, not offered at launch).
 *
 * A tenant references a plan by its immutable `key` (tenant.subscriptionPlan).
 * No card-billing integration lives here — fees accrue in the platform fee
 * ledger and are collected per monthly statement (services/platform/billing).
 *
 * Legacy fields `price/currency/interval/features` are kept readable for
 * older callers; `pricing.baseFee` is the source of truth (migration 009
 * copies them across).
 */
const DEFAULT_CURRENCY = "SDG";

export const PLAN_FAMILIES = Object.freeze(["commission", "subscription", "hybrid"]);

const moneySchema = new Schema(
  {
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: DEFAULT_CURRENCY, uppercase: true, trim: true },
    interval: { type: String, enum: ["month", "year"], default: "month" },
  },
  { _id: false }
);

const subscriptionPlanSchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },

  family: { type: String, enum: PLAN_FAMILIES, default: "subscription" },
  pricing: {
    // A yearly plan is simply interval:"year" (billed 1/12 per statement).
    baseFee: { type: moneySchema, default: () => ({}) },
    // Subscription plans only: free days after assignment before the base
    // fee starts. Commission plans need no trial (validated in the
    // controller). Granted once per tenant, ever (tenant.billing.trialUsedAt).
    trialDays: { type: Number, default: 0, min: 0, max: 365 },
    // Required for commission/hybrid families; null for subscription.
    commissionPolicyKey: { type: String, default: null, lowercase: true, trim: true },
  },

  // Legacy display fields — mirrored from pricing.baseFee on write.
  price: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: DEFAULT_CURRENCY, uppercase: true, trim: true },
  interval: { type: String, enum: ["month", "year"], default: "month" },
  features: { type: [String], default: [] },

  // Entitlement limits applied to a tenant when the plan is assigned.
  // `null` means "not enforced by this plan".
  limits: {
    maxProducts: { type: Number, default: null },
    maxStaff: { type: Number, default: null },
    maxOrdersPerMonth: { type: Number, default: null },
    maxStorageMB: { type: Number, default: null },
    maxApiRequestsPerDay: { type: Number, default: null },
  },
  // Feature keys (config/featureFlags.js) this plan entitles. Consumed by the
  // plan-entitlement layer in Phase B; stored now so the catalog is complete.
  entitlements: { type: [String], default: [] },

  // Merchant self-service switching is always effective next period; an
  // operator may force "immediately" per change (PlanChange.effectiveAt).
  switching: {
    allowSelfService: { type: Boolean, default: true },
    minimumTermDays: { type: Number, default: 0, min: 0 },
  },

  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

subscriptionPlanSchema.index({ sortOrder: 1, key: 1 });

// (M7) Unmigrated rows: seed pricing.baseFee from the legacy flat fields on
// hydrate so reads and later saves never see a zero base fee.
// (M7) Remember whether `pricing.baseFee.amount` was actually persisted, so an
// unmigrated row (legacy `price` only) is recognised even after Mongoose
// applies the in-memory schema default of 0.
subscriptionPlanSchema.pre("init", function (raw) {
  // `raw` is the document exactly as loaded from MongoDB (no defaults yet).
  this.$locals.baseFeePersisted = raw?.pricing?.baseFee?.amount != null;
});

subscriptionPlanSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  const legacy = Number(this.price) || 0;
  const unmigrated = !this.isNew && this.$locals.baseFeePersisted === false && !this.isModified("pricing.baseFee");
  if (unmigrated && legacy > 0) {
    // Seed pricing.baseFee from the legacy fields instead of persisting the default 0.
    this.set("pricing.baseFee", { amount: legacy, currency: this.currency || DEFAULT_CURRENCY, interval: this.interval || "month" });
    return next();
  }
  // Keep the legacy mirror in sync ONLY when the base fee actually changed
  // (M7) — a rename on an unmigrated plan must not wipe its price.
  if (this.isModified("pricing.baseFee") || this.isNew) {
    const bf = this.pricing?.baseFee || {};
    this.price = bf.amount || 0;
    this.currency = bf.currency || DEFAULT_CURRENCY;
    this.interval = bf.interval || "month";
  }
  next();
});

export default subscriptionPlanSchema;
