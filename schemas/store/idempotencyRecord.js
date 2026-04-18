import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

/**
 * Idempotency record — stores the outcome of a mutating request keyed by
 * a client-supplied `Idempotency-Key` header so that replays (double-clicks,
 * network retries, brief outages) collapse onto a single side effect.
 *
 * Scope: per-tenant + per-key. The `method` + `path` + `bodyHash` are
 * captured so replaying the same key with a different payload surfaces a
 * 409 "Idempotency key reused with different payload" (protects against
 * client bugs that recycle keys across unrelated actions).
 *
 * Retention: 24h TTL. That's long enough to absorb every realistic retry
 * window (networking blips, user refresh, browser crash-and-restart)
 * without bloating the collection indefinitely.
 */
const idempotencyRecordSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  key: { type: String, required: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  // SHA-256 of the canonicalised request body. Allows the middleware to
  // detect key re-use with a mismatched payload without having to store
  // the raw body (which may contain sensitive fields).
  bodyHash: { type: String, required: true },
  // Captured response envelope — replayed verbatim on cache hit. Stored
  // as Mixed because endpoints return arbitrary shapes.
  response: { type: Schema.Types.Mixed },
  statusCode: { type: Number, required: true, default: 200 },
  createdAt: { type: Date, default: Date.now },
});

// Unique per-tenant key. Two different tenants can coexist with the same
// idempotency key (they'll never share state).
idempotencyRecordSchema.index({ tenantId: 1, key: 1 }, { unique: true });
// TTL — 24h. Mongo sweeps expired records; no manual GC needed.
idempotencyRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

applyTenantScope(idempotencyRecordSchema);
export default idempotencyRecordSchema;
