import { Schema } from "mongoose";

/**
 * Access program (admin DB) — a named cohort of stores (Pilot, Partner,
 * Early Access…) carrying feature and limit overrides that apply on top of
 * the plan layer for every member. Membership lives on the tenant
 * (`tenant.accessPrograms: [key]`) so the feature/limit resolvers need one
 * read of the tenant plus the active programs.
 *
 * Closing a program removes nothing — its overrides simply stop applying.
 * Overrides are stored as `{ k, v }` pairs, never as dotted field names
 * (flag keys contain dots; see services/featureFlags.js).
 */
const accessProgramSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["draft", "active", "closed"], default: "draft", index: true },

    // Informational only (who the program is meant for); not enforced.
    eligibility: {
      countries: { type: [String], default: [] },
      planKeys: { type: [String], default: [] },
    },

    featureOverrides: {
      type: [{ _id: false, k: { type: String, required: true }, v: { type: Boolean, required: true } }],
      default: [],
    },
    limitOverrides: {
      maxProducts: { type: Number, default: null },
      maxStaff: { type: Number, default: null },
      maxOrdersPerMonth: { type: Number, default: null },
      maxStorageMB: { type: Number, default: null },
    },

    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: "TenantUser", default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

accessProgramSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default accessProgramSchema;
