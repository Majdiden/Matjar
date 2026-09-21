import { Schema } from "mongoose";

/**
 * Platform fee ledger (admin DB) — append-only. One row per recognised
 * commission (or its reversal), subscription charge, or operator adjustment.
 * Statements are built by summing these per tenant + period; rows are never
 * edited — corrections are new rows of type "reversal"/"adjustment".
 *
 * Idempotency: (tenantId, orderId, type) is unique for order-driven rows so a
 * replayed "delivered" event cannot double-charge.
 */
const platformFeeEventSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    type: {
      type: String,
      enum: ["commission", "reversal", "adjustment", "subscription", "credit"],
      required: true,
    },
    // Order-driven rows.
    orderId: { type: Schema.Types.ObjectId, default: null },
    orderNumber: { type: String, default: null },
    paymentMethod: { type: String, default: null },

    // What the fee was computed on (store currency) and the FX used to
    // compare against tier thresholds (policy currency).
    basisAmount: { type: Number, default: 0 },
    basisCurrency: { type: String, default: null, uppercase: true },
    fxRateToPolicyCurrency: { type: Number, default: 1 },

    // Basis + fee expressed in the POLICY currency (tier lookups and period
    // caps are evaluated in policy currency; null when FX was unavailable).
    basisPolicyAmount: { type: Number, default: null },
    feePolicyAmount: { type: Number, default: null },

    feeAmount: { type: Number, required: true }, // negative for reversal/credit
    feeCurrency: { type: String, required: true, uppercase: true },

    policyKey: { type: String, default: null },
    planKey: { type: String, default: null },
    tierIndex: { type: Number, default: null },
    percentApplied: { type: Number, default: null },
    recognitionEvent: { type: String, default: null },
    // Which pricing layer produced the numbers: plan | override | default.
    pricingSource: { type: String, default: null },

    occurredAt: { type: Date, required: true, index: true },
    periodKey: { type: String, required: true, index: true }, // YYYY-MM
    // Set once the row has been rolled into an issued statement.
    statementId: { type: Schema.Types.ObjectId, ref: "BillingStatement", default: null, index: true },

    source: { type: String, enum: ["system", "operator"], default: "system" },
    createdBy: { type: Schema.Types.ObjectId, ref: "TenantUser", default: null },
    reason: { type: String, default: null },
    // For reversals: the commission row being reversed.
    reversesEventId: { type: Schema.Types.ObjectId, ref: "PlatformFeeEvent", default: null },
    // Free-form diagnostics (feeHoliday, fxMissing, tier breakdown…). Never secrets.
    metadata: { type: Schema.Types.Mixed, default: null },

    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

platformFeeEventSchema.index({ tenantId: 1, periodKey: 1 });
platformFeeEventSchema.index({ tenantId: 1, occurredAt: -1 });
platformFeeEventSchema.index({ occurredAt: 1, type: 1 }); // platform-wide commission series
// Exactly one recognised commission per order (idempotent recognition).
// Reversals are NOT unique per order — a partially refunded order can be
// refunded again, producing a second reversal row.
platformFeeEventSchema.index(
  { tenantId: 1, orderId: 1 },
  { unique: true, name: "uniq_commission_per_order", partialFilterExpression: { type: "commission" } }
);

export default platformFeeEventSchema;
