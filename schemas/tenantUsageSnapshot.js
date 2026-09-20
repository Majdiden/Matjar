import { Schema } from "mongoose";

/**
 * Point-in-time usage snapshot per tenant (admin DB). Written nightly by the
 * usage job and on demand by the operator; the usage tab shows the latest
 * row against the tenant's effective limits plus the last 30 rows as history.
 * Nothing is enforced from these numbers in this phase.
 */
const tenantUsageSnapshotSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    at: { type: Date, required: true, default: Date.now },
    products: { type: Number, default: 0 },
    staff: { type: Number, default: 0 },
    ordersThisMonth: { type: Number, default: 0 },
    storageMB: { type: Number, default: 0 },
    // Not tracked yet (no per-tenant request metering); null = unknown.
    apiRequestsToday: { type: Number, default: null },
    source: { type: String, enum: ["job", "operator"], default: "job" },
  },
  { versionKey: false }
);

tenantUsageSnapshotSchema.index({ tenantId: 1, at: -1 });
// Keep one year of history.
tenantUsageSnapshotSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default tenantUsageSnapshotSchema;
