import { Schema } from "mongoose";

/**
 * Signup invitation code (admin DB, PBI 10-47).
 *
 * Generated in the platform console by an owner or a promoter. One code
 * registers one store: signup claims it atomically (status active → used)
 * and records the store. An unused code can be revoked. Adding another store
 * from an existing account never needs a code.
 */
export const INVITE_CODE_STATUSES = ["active", "used", "revoked"];
/** Characters a code is made of: no 0/O, 1/I/L, so it reads back without mistakes. */
export const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 8;

const inviteCodeSchema = new Schema(
  {
    /** Stored without separators, upper case (shown as XXXX-XXXX). */
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    status: { type: String, enum: INVITE_CODE_STATUSES, default: "active", index: true },
    /** Who it is for — a free note for the promoter's own tracking. */
    note: { type: String, trim: true, maxlength: 120, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: "TenantUser", required: true, index: true },
    createdByEmail: { type: String, default: null },
    createdByName: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },

    usedAt: { type: Date, default: null },
    usedByTenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    usedByTenantName: { type: String, default: null },
    usedByEmail: { type: String, default: null },

    revokedAt: { type: Date, default: null },
    revokedByEmail: { type: String, default: null },
  },
  { versionKey: false }
);

inviteCodeSchema.index({ createdBy: 1, createdAt: -1 });

export default inviteCodeSchema;
