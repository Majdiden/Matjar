import { Schema } from "mongoose";

/**
 * Plan change record (admin DB). A merchant or operator moves a tenant from
 * one plan (family) to another; the switch takes effect at `effectiveAt`
 * (default: next statement period) so one period is never billed under two
 * models. Applied by the billing period job or immediately by an operator.
 */
const planChangeSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    fromPlan: { type: String, default: null },
    toPlan: { type: String, required: true },
    requestedBy: { type: String, enum: ["merchant", "operator"], required: true },
    requestedById: { type: Schema.Types.ObjectId, default: null },
    requestedAt: { type: Date, default: Date.now },
    effectiveAt: { type: Date, required: true, index: true },
    appliedAt: { type: Date, default: null },
    // Set while `applying`; a claim older than 15 min is re-claimable (N3).
    claimedAt: { type: Date, default: null },
    // `applying` is a transient claim held by applyDueChanges (released on failure).
    status: { type: String, enum: ["scheduled", "applying", "applied", "cancelled"], default: "scheduled", index: true },
    reason: { type: String, default: null },
  },
  { versionKey: false }
);

export default planChangeSchema;
