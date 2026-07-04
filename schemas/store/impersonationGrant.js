import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

/**
 * Consent-based support-impersonation grant.
 *
 * A platform admin (Customer Support) requests access to a specific store,
 * tied to a support ticket. The store OWNER must explicitly approve before
 * any impersonation token is minted. The grant is the single source of
 * truth for the whole lifecycle and is checked on EVERY impersonated
 * request so an owner revoke takes effect immediately (see middlewares/auth.js).
 *
 * Tenant-scoped: it lives in the tenant's own DB so the merchant's audit
 * log and status queries are naturally isolated, and a grant can never
 * leak across stores.
 *
 * Status machine:
 *   requested  → approved | denied | expired | cancelled
 *   approved   → active   | expired | cancelled
 *   active     → ended    | cancelled | expired
 *   (denied | ended | cancelled | expired are terminal)
 *
 * A grant is "live for support" only while status === "active" AND
 * sessionExpiresAt is in the future. Anything else ⇒ the impersonation
 * token is dead.
 */

export const IMPERSONATION_STATUSES = [
  "requested",
  "approved",
  "active",
  "denied",
  "ended",
  "cancelled",
  "expired",
];

// Terminal states — a grant here can never be reactivated.
export const IMPERSONATION_TERMINAL = ["denied", "ended", "cancelled", "expired"];

const impersonationGrantSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },

  // --- Who is requesting (platform admin / Customer Support) ---
  // Lives in the admin DB (TenantUser). Stored by id + snapshot so the
  // audit trail survives even if the operator record later changes.
  supportUserId: { type: Schema.Types.ObjectId, required: true, index: true },
  supportName: { type: String },
  supportEmail: { type: String },

  // --- Who must consent / is impersonated (the store owner) ---
  ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  ownerName: { type: String },
  ownerEmail: { type: String },

  // Support ticket the access is tied to. Free-form so "#1234" or "1234"
  // both work; normalized on input.
  ticket: { type: String, required: true, trim: true },

  status: { type: String, enum: IMPERSONATION_STATUSES, default: "requested", index: true },

  // 6-char consent code shown ONLY in the owner's authenticated dashboard.
  // The owner can read it to support (phone fallback) who enters it to
  // approve. Never leaves the owner's session otherwise.
  code: { type: String, required: true },

  // Approval window — the owner must approve/deny before this. Short (5 min)
  // so a stale request can't be approved much later.
  approvalExpiresAt: { type: Date, required: true, index: true },

  // Session TTL — set on approval. The impersonation token is capped to
  // this and every impersonated request re-checks it.
  sessionExpiresAt: { type: Date, index: true },

  // Lifecycle timestamps (each also produces an audit entry).
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  deniedAt: { type: Date },
  startedAt: { type: Date },
  endedAt: { type: Date },
  revokedAt: { type: Date },

  // How the approval happened: "dashboard" (owner clicked Approve) or
  // "code" (owner read the code to support who entered it).
  approvalMethod: { type: String, enum: ["dashboard", "code"], default: null },

  // Who ended it: "support" (Exit impersonation) or "owner" (revoke) or
  // "system" (expiry).
  endedBy: { type: String, enum: ["support", "owner", "system"], default: null },

  createdAt: { type: Date, default: Date.now },
});

impersonationGrantSchema.index({ tenantId: 1, status: 1 });
impersonationGrantSchema.index({ tenantId: 1, supportUserId: 1, status: 1 });
impersonationGrantSchema.index({ tenantId: 1, createdAt: -1 });
// Housekeeping TTL — grants self-delete 30 days after creation. The audit
// log (separate collection, 1-year TTL) is the durable record; the grant
// row itself is operational state we don't need to keep forever.
impersonationGrantSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

applyTenantScope(impersonationGrantSchema);

export default impersonationGrantSchema;
