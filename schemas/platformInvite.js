import { Schema } from "mongoose";

/**
 * Platform-staff invitation (admin DB). An OWNER/ADMIN invites an operator by
 * email with a role; the invitee sets a password through the accept link.
 *
 * Only the SHA-256 hash of the raw token is stored — the raw token lives in
 * the email only, so a DB leak cannot be used to accept an invite.
 */
const platformInviteSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked"],
      default: "pending",
      index: true,
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: "TenantUser", required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default platformInviteSchema;
