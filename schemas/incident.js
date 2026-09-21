import { Schema } from "mongoose";

/**
 * Platform incident (admin DB) — a lightweight operational record for
 * "something is broken for N stores": severity, status, who owns it, which
 * services/tenants are affected, a timeline of updates and resolution notes.
 *
 * Platform-only: never exposed to merchants. Does not replace external
 * monitoring; it is the operator's log of what happened and when.
 */
export const INCIDENT_SEVERITIES = ["sev1", "sev2", "sev3", "sev4"];
export const INCIDENT_STATUSES = ["investigating", "identified", "monitoring", "resolved"];
export const INCIDENT_MAX_TENANTS = 500;
export const INCIDENT_MAX_TIMELINE = 500;
// Statuses an incident can be moved to without going through /resolve.
export const INCIDENT_OPEN_STATUSES = INCIDENT_STATUSES.filter((s) => s !== "resolved");

const timelineEntrySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "TenantUser", default: null },
    byEmail: { type: String, default: null },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    // Status the incident moved to with this entry, when it changed.
    status: { type: String, enum: [...INCIDENT_STATUSES, null], default: null },
  },
  { _id: true }
);

const incidentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    severity: { type: String, enum: INCIDENT_SEVERITIES, required: true, index: true },
    status: { type: String, enum: INCIDENT_STATUSES, default: "investigating", index: true },

    startedAt: { type: Date, required: true },
    detectedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },

    affectedServices: { type: [String], default: [] },
    affectedTenantIds: {
      type: [Schema.Types.ObjectId],
      default: [],
      validate: [(v) => v.length <= INCIDENT_MAX_TENANTS, `At most ${INCIDENT_MAX_TENANTS} tenants`],
    },

    ownerId: { type: Schema.Types.ObjectId, ref: "TenantUser", default: null },
    ownerEmail: { type: String, default: null },

    timeline: { type: [timelineEntrySchema], default: [] },
    resolutionNotes: { type: String, default: null, maxlength: 5000 },

    createdBy: { type: Schema.Types.ObjectId, ref: "TenantUser", required: true },
    createdByEmail: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

incidentSchema.index({ status: 1, severity: 1, startedAt: -1 });
incidentSchema.index({ startedAt: -1 });

incidentSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default incidentSchema;
