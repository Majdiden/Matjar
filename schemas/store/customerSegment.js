import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

/**
 * Customer Segment — a saved, named filter over the customer base.
 *
 * The merchant defines criteria once (e.g. "VIPs: spent ≥ $500 in the last
 * 90 days") and the dashboard / discount targeting / email tools resolve
 * the segment to a concrete user list on demand. Segments are recomputed
 * lazily — we do NOT materialise membership, because order activity drifts
 * constantly and a stale list is worse than a slightly slower query.
 *
 * Filter shape is intentionally narrow. Each non-null field becomes one
 * predicate in an AND. Adding new dimensions later (location, product
 * affinity, etc.) is a non-breaking change because the resolver only acts
 * on fields it recognises.
 */
const customerSegmentSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },

  filters: {
    // Lifetime spend across all non-cancelled orders.
    totalSpentMin: { type: Number, default: null, min: 0 },
    totalSpentMax: { type: Number, default: null, min: 0 },
    // Lifetime order count.
    orderCountMin: { type: Number, default: null, min: 0 },
    orderCountMax: { type: Number, default: null, min: 0 },
    // Recency window — by absolute date so the merchant decides the
    // semantics ("active in 2026" vs "dormant since 2024-Q4"). Stored as
    // Date so the dashboard can render an editable date picker.
    lastOrderAfter: { type: Date, default: null },
    lastOrderBefore: { type: Date, default: null },
    // Free-form tags on the user document. ALL listed tags must match
    // (logical AND); for OR semantics the merchant creates two segments.
    tags: { type: [String], default: [] },
    // Substring filter on the user's email — useful for "all @acme.com
    // employees". Case-insensitive.
    emailContains: { type: String, default: null, trim: true },
    // Whether the user has opted in to marketing comms. Tri-state:
    // null = don't filter, true = only opted-in, false = only opted-out.
    acceptsMarketing: { type: Boolean, default: null },
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

customerSegmentSchema.index({ tenantId: 1, name: 1 }, { unique: true });

customerSegmentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(customerSegmentSchema);

export default customerSegmentSchema;
