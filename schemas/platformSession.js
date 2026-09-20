import { Schema } from "mongoose";

/**
 * Platform-staff session (admin DB). One row per issued platform JWT,
 * keyed by the token's `jti`. Lets an operator see and revoke individual
 * sessions; `platformAuthenticate` rejects a token whose row is revoked or
 * missing (fail closed). Rows expire with the token via a TTL index.
 */
const platformSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "TenantUser", required: true, index: true },
    jti: { type: String, required: true, unique: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    // Set when the session was established after a successful MFA step.
    mfaVerified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { versionKey: false }
);

// Keep rows ~1 day past token expiry so a "recent sessions" view still makes sense.
platformSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
platformSessionSchema.index({ userId: 1, createdAt: -1 });

export default platformSessionSchema;
