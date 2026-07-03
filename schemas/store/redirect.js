import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

/**
 * Redirect — merchant-defined URL redirect (audit 6.7).
 *
 * Exact-match on the storefront request path (`fromPath`) → 301/302 to
 * `toPath`. Powers two flows:
 *   - page slug renames (PageForm offers "create redirect from old URL"),
 *   - imported stores mapping legacy URLs onto the new structure.
 *
 * Matching happens in middlewares/storefrontServe.js after tenant
 * resolution and before static/SPA serving, backed by a short-TTL
 * per-tenant cache. `hits` is incremented fire-and-forget on match.
 */
const redirectSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  // Path on this store to intercept. Always starts with "/", never "/"
  // itself (that would take the whole storefront offline) — both rules
  // are enforced in the service layer with merchant-readable errors.
  fromPath: { type: String, required: true, maxlength: 1024 },
  // Destination: a relative path ("/pages/new-about") or an absolute
  // http(s) URL for off-store destinations.
  toPath: { type: String, required: true, maxlength: 2048 },
  statusCode: { type: Number, enum: [301, 302], default: 301 },
  hits: { type: Number, default: 0 },
  lastHitAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// One redirect per source path per tenant. The unique index doubles as
// the lookup index for the storefront hot path.
redirectSchema.index({ tenantId: 1, fromPath: 1 }, { unique: true });
redirectSchema.index({ tenantId: 1, createdAt: -1 });

applyTenantScope(redirectSchema);

export default redirectSchema;
