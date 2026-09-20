import { Schema } from "mongoose";

/**
 * Commission policy ("rate card") — admin DB. Reusable across plans and
 * overrides. Defines how the variable percentage is computed for a store.
 *
 * Tier thresholds are expressed in `currency` (platform currency, SDG); a
 * store trading in another currency has its period basis converted with the
 * PLATFORM-owned FX table (services/platform/billing/fx.js — never the
 * merchant's own rates) only to look up the tier; the fee itself is computed
 * and recorded in the store's currency (decision 2 in the plan).
 */
const tierSchema = new Schema(
  {
    // Upper bound of the tier (inclusive) in `currency` for basis "gmv", or an
    // order count for basis "order_count". null = open-ended (must be last).
    upTo: { type: Number, default: null, min: 0 },
    percent: { type: Number, required: true, min: 0, max: 100 },
    // Optional fixed amount per order on top of the percentage (store currency
    // via FX at recognition time).
    fixedPerOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const commissionPolicySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },

    basis: { type: String, enum: ["gmv", "order_count"], default: "gmv" },
    // Which orders count toward the period basis / tier lookup.
    gmvScope: { type: String, enum: ["delivered", "paid", "placed"], default: "delivered" },
    // When a fee event is written for an order (decision 1: delivered).
    recognitionEvent: { type: String, enum: ["delivered", "paid"], default: "delivered" },
    period: { type: String, enum: ["calendar_month", "rolling_30d", "lifetime"], default: "calendar_month" },
    // marginal = progressive brackets; bracket = whole period at the reached tier's rate.
    tierMode: { type: String, enum: ["marginal", "bracket"], default: "marginal" },
    tiers: { type: [tierSchema], default: [{ upTo: null, percent: 0, fixedPerOrder: 0 }] },

    perOrder: {
      minFee: { type: Number, default: null, min: 0 },
      maxFee: { type: Number, default: null, min: 0 },
    },
    periodCap: { type: Number, default: null, min: 0 },
    // "all" or an explicit list of payment-method codes that carry commission.
    paymentMethods: { type: Schema.Types.Mixed, default: "all" },

    currency: { type: String, default: "SDG", uppercase: true, trim: true },
    rounding: { type: String, enum: ["nearest", "up", "down"], default: "nearest" },
    precision: { type: Number, default: 0, min: 0, max: 4 },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

commissionPolicySchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default commissionPolicySchema;
