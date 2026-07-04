import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

/**
 * A browser Web Push subscription belonging to a merchant staff user.
 *
 * Tenant-scoped and tied to a specific User. One user may have several
 * subscriptions (installed PWA on their phone + Chrome on their laptop),
 * so this is a one-to-many collection keyed by the push service `endpoint`.
 *
 * `keys.p256dh` / `keys.auth` are the ECDH public key + auth secret the
 * browser generates for the subscription; web-push needs both to encrypt
 * the payload. `userAgent` is stored purely for debugging / letting the
 * merchant recognise a device later.
 *
 * Subscriptions are pruned automatically when the push service reports the
 * endpoint as gone (HTTP 404/410) during a send.
 */
const pushSubscriptionSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // The push service URL — globally unique per browser subscription.
  endpoint: {
    type: String,
    required: true,
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  userAgent: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// The same endpoint must never map to two rows within a tenant; upserts key
// on (tenantId, endpoint). Scoped to the tenant so the same browser
// subscribing to two stores doesn't collide across tenants.
pushSubscriptionSchema.index({ tenantId: 1, endpoint: 1 }, { unique: true });
pushSubscriptionSchema.index({ tenantId: 1, user: 1 });

applyTenantScope(pushSubscriptionSchema);

export default pushSubscriptionSchema;
