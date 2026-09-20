import { Schema } from "mongoose";

/**
 * Platform audit ledger (admin DB) — append-only record of every mutating
 * action taken through the platform-admin API (suspend, purge, plan change,
 * flag change, billing writes, staff changes, impersonation, exports…).
 *
 * Distinct from the per-tenant `AuditLog` (merchant-side actions inside a
 * store). This one answers "which operator did what to which tenant/resource,
 * when, from where, and why". Written via services/platform/audit.js —
 * never updated or deleted by application code (no update/delete routes).
 */
const platformAuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "TenantUser", index: true },
    actorEmail: { type: String, default: null, index: true },
    actorRole: { type: String, default: null },
    actorType: { type: String, enum: ["platform_user", "system"], default: "platform_user" },

    // Dotted verb, e.g. "tenant.suspend", "plan.update", "billing.statement.record_payment".
    action: { type: String, required: true, index: true },
    resourceType: { type: String, default: null, index: true },
    resourceId: { type: String, default: null, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },

    reason: { type: String, default: null },
    // Minimal before/after snapshots of the fields that changed (never secrets).
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },

    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    requestId: { type: String, default: null },
    outcome: { type: String, enum: ["success", "failure"], default: "success" },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

platformAuditLogSchema.index({ tenantId: 1, createdAt: -1 });
platformAuditLogSchema.index({ actorId: 1, createdAt: -1 });

export default platformAuditLogSchema;
