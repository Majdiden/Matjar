import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

/**
 * A registered WebAuthn / passkey credential (platform authenticator —
 * fingerprint / Face ID). Tenant-scoped and tied to a specific User. One user
 * may enrol several passkeys (laptop Touch ID + phone Face ID), so this is a
 * one-to-many collection rather than an embedded field on User.
 *
 * `credentialID` and `publicKey` are stored base64url-encoded (the wire
 * format @simplewebauthn uses), so they round-trip without a Buffer column.
 * `counter` is the authenticator's signature counter — bumped on every
 * successful assertion to detect cloned authenticators.
 */
const webauthnCredentialSchema = new Schema({
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
  // base64url string — unique per authenticator.
  credentialID: {
    type: String,
    required: true,
  },
  // base64url-encoded COSE public key.
  publicKey: {
    type: String,
    required: true,
  },
  counter: {
    type: Number,
    default: 0,
  },
  // e.g. ["internal", "hybrid"] — informs the browser which transports to try.
  transports: {
    type: [String],
    default: [],
  },
  // "singleDevice" | "multiDevice" (whether the passkey is synced/backed up).
  deviceType: {
    type: String,
    default: null,
  },
  backedUp: {
    type: Boolean,
    default: false,
  },
  // Friendly label the user (or the client) supplies at enrol time.
  name: {
    type: String,
    default: "Passkey",
  },
  lastUsedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// A credentialID is globally unique per authenticator; scope the uniqueness
// to the tenant so the same synced passkey enrolled on two stores doesn't
// collide across tenants.
webauthnCredentialSchema.index({ tenantId: 1, credentialID: 1 }, { unique: true });
webauthnCredentialSchema.index({ tenantId: 1, user: 1 });

applyTenantScope(webauthnCredentialSchema);

export default webauthnCredentialSchema;
