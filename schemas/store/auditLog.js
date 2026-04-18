import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const auditLogSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  // System / background events have no human actor, so this field is
  // optional. Required-ness was previously the silent reason audit
  // entries from anonymous code paths got dropped on the floor.
  actor: { type: Schema.Types.ObjectId, ref: "User" },
  actorName: { type: String }, // Snapshot for display when User is gone
  action: { type: String, required: true }, // e.g., "order.status_updated", "product.created", "settings.updated"
  resource: { type: String, required: true }, // e.g., "Order", "Product", "Settings"
  resourceId: { type: Schema.Types.ObjectId },
  changes: Schema.Types.Mixed, // { field: { from: old, to: new } }
  metadata: Schema.Types.Mixed,
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now },
});

auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, resource: 1, resourceId: 1 });
auditLogSchema.index({ tenantId: 1, actor: 1 });
auditLogSchema.index({ tenantId: 1, action: 1 });
// TTL — keep audit logs for 1 year
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

applyTenantScope(auditLogSchema);
export default auditLogSchema;
