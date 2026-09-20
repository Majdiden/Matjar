import { Schema } from "mongoose";

/**
 * Per-tenant feature-flag override (admin DB) — the last rung of the
 * resolution ladder (default → global → plan → program → tenant).
 *
 * Every override is reasoned, attributed, optionally time-bounded and
 * revocable; creation and revocation are written to the platform audit
 * ledger by the controller. Only ONE live override per (scope, scopeId, key)
 * — creating a new one for the same key revokes the previous row.
 */
const featureOverrideSchema = new Schema(
  {
    scope: { type: String, enum: ["tenant"], default: "tenant" },
    scopeId: { type: Schema.Types.ObjectId, required: true, index: true },
    key: { type: String, required: true, trim: true },
    value: { type: Boolean, required: true },
    reason: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "TenantUser", default: null },
    createdAt: { type: Date, default: Date.now },
    endsAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: "TenantUser", default: null },
  },
  { versionKey: false }
);

featureOverrideSchema.index({ scope: 1, scopeId: 1, key: 1, revokedAt: 1 });
featureOverrideSchema.index({ key: 1, revokedAt: 1 });

export default featureOverrideSchema;
