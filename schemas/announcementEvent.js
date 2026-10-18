import { Schema } from "mongoose";

/**
 * One person opening or clicking an announcement email (admin DB, PBI 10-54).
 * Unique per message, person and kind, so the counters on the announcement
 * are unique people, however often the email is opened.
 *
 * Email opens are counted with a tracking image: mail apps that block images
 * never report, and some (Apple Mail privacy protection) load them for every
 * message, so "opened" is an estimate. Clicks are exact.
 */
export const ANNOUNCEMENT_EVENT_KINDS = ["email_open", "email_click"];

const announcementEventSchema = new Schema(
  {
    announcementId: { type: Schema.Types.ObjectId, ref: "Announcement", required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ANNOUNCEMENT_EVENT_KINDS, required: true },
    at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

announcementEventSchema.index({ announcementId: 1, userId: 1, kind: 1 }, { unique: true });

export default announcementEventSchema;
