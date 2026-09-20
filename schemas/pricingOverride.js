import { Schema } from "mongoose";

/**
 * Pricing override (admin DB) — a negotiated or promotional deviation from
 * the plan's pricing for one tenant (or, later, an access program).
 * Resolution ladder: platform default → plan → program → tenant override.
 *
 * Every override carries a reason and its author; creation/expiry/removal is
 * written to the platform audit ledger.
 */
const pricingOverrideSchema = new Schema(
  {
    scope: { type: String, enum: ["tenant", "program"], required: true },
    scopeId: { type: Schema.Types.ObjectId, required: true, index: true },

    // Any subset may be set; unset fields fall through to the plan.
    baseFee: {
      amount: { type: Number, default: null, min: 0 },
      currency: { type: String, default: null, uppercase: true, trim: true },
      interval: { type: String, enum: ["month", "year", null], default: null },
    },
    commissionPolicyKey: { type: String, default: null, lowercase: true, trim: true },
    // Additive percentage-point adjustment applied to whichever tier is hit
    // (e.g. -1 = one point cheaper). Clamped to >= 0 at computation time.
    percentDelta: { type: Number, default: null },
    // 0% commission until this date (inclusive). Base fee unaffected.
    feeHolidayUntil: { type: Date, default: null },

    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, default: null },
    reason: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "TenantUser", required: true },
    createdAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: "TenantUser", default: null },
  },
  { versionKey: false }
);

pricingOverrideSchema.index({ scope: 1, scopeId: 1, revokedAt: 1, endsAt: 1 });

export default pricingOverrideSchema;
