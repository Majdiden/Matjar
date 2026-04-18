import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const staffInviteSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ["admin", "manager", "staff"],
    required: true,
  },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  // Stored as SHA-256 hash of the raw token. The plaintext token is only
  // returned to the caller once (at creation / resend) and is included in
  // the invite email link. On acceptance the raw token is hashed and
  // compared via constant-time equality through the database lookup.
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  acceptedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

staffInviteSchema.index({ tenantId: 1, email: 1 });
staffInviteSchema.index({ tenantId: 1, acceptedAt: 1 });
staffInviteSchema.index({ token: 1 }, { unique: true });

staffInviteSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(staffInviteSchema);

export default staffInviteSchema;
