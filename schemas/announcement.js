import { Schema } from "mongoose";

/**
 * Platform announcement (admin DB): a message the platform sends to every
 * store or to the stores it picks (PBI 10-46, 10-54).
 *
 * Each store's staff get it through the channels the platform picked AND
 * they keep switched on (Settings → Notifications, type
 * `platform.announcement`):
 *   - app:   the notifications page + live popup in an open dashboard + a
 *            phone / desktop notification (Web Push) when it is closed —
 *            exactly like a new order;
 *   - email: a formatted email message.
 *
 * `audience` is the reach measured just before sending; `delivered` counts
 * what actually went out. Text is kept in both languages; every recipient
 * reads it in their own (falling back to the other one).
 */
// "tenant" (one store) is the original single-store target, kept for the
// history; new messages use "tenants" (one or more picked stores).
export const ANNOUNCEMENT_TARGETS = ["all", "tenant", "tenants"];
/** Most stores one message can be addressed to by name. */
export const ANNOUNCEMENT_MAX_STORES = 500;
/** Store names kept on the message for the history. */
export const ANNOUNCEMENT_NAMES_KEPT = 20;
export const ANNOUNCEMENT_STATUSES = ["sending", "sent", "failed"];
export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_BODY_MAX = 2000;

const textPair = {
  ar: { type: String, trim: true, default: "" },
  en: { type: String, trim: true, default: "" },
};

const reach = {
  stores: { type: Number, default: 0 },
  recipients: { type: Number, default: 0 },
  app: { type: Number, default: 0 },
  devices: { type: Number, default: 0 },
  email: { type: Number, default: 0 },
};

const announcementSchema = new Schema(
  {
    title: { ...textPair },
    body: { ...textPair },
    /** Dashboard path the notification opens (`/dashboard/...`), or null. */
    link: { type: String, default: null },
    channels: {
      app: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    target: { type: String, enum: ANNOUNCEMENT_TARGETS, required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
    tenantName: { type: String, default: null },
    // target "tenants": the picked stores, and the first names for the history.
    tenantIds: { type: [Schema.Types.ObjectId], default: undefined },
    tenantNames: { type: [String], default: undefined },

    status: { type: String, enum: ANNOUNCEMENT_STATUSES, default: "sending", index: true },
    audience: reach,
    delivered: {
      stores: { type: Number, default: 0 },
      app: { type: Number, default: 0 },
      email: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    error: { type: String, default: null },
    // Unique people who opened the email (tracking image) and who clicked
    // its button (AnnouncementEvent keeps one row per person and kind).
    // App reads are counted from the stores' notifications.
    engagement: {
      emailOpened: { type: Number, default: 0 },
      emailClicked: { type: Number, default: 0 },
    },

    createdBy: { type: Schema.Types.ObjectId, ref: "TenantUser", required: true },
    createdByEmail: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
  },
  { versionKey: false }
);

announcementSchema.index({ createdAt: -1 });

export default announcementSchema;
