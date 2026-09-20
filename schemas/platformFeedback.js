import { Schema } from "mongoose";

/**
 * Merchant → platform feedback (admin DB). Submitted from the merchant
 * dashboard, triaged by platform operators. Internal notes are never
 * returned to the merchant.
 */
export const FEEDBACK_TYPES = ["bug", "feature_request", "question", "ux", "other"];
export const FEEDBACK_STATUSES = ["open", "investigating", "planned", "in_progress", "resolved", "wont_fix"];

const platformFeedbackSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    userEmail: { type: String, default: null, lowercase: true, trim: true },
    userName: { type: String, default: null, trim: true },
    type: { type: String, enum: FEEDBACK_TYPES, required: true, index: true },
    status: { type: String, enum: FEEDBACK_STATUSES, default: "open", index: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 4000 },
    page: { type: String, default: null, maxlength: 500 },
    browser: { type: String, default: null, maxlength: 300 },
    attachments: { type: [String], default: [] },
    internalNotes: {
      type: [
        {
          by: { type: Schema.Types.ObjectId, ref: "TenantUser", required: true },
          byEmail: { type: String, default: null },
          at: { type: Date, default: Date.now },
          text: { type: String, required: true, maxlength: 2000 },
        },
      ],
      default: [],
    },
    resolution: { type: String, default: null, maxlength: 2000 },
    resolvedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

platformFeedbackSchema.index({ status: 1, createdAt: -1 });
platformFeedbackSchema.index({ tenantId: 1, createdAt: -1 });

platformFeedbackSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default platformFeedbackSchema;
