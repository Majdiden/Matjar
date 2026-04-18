import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const notificationSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  // Dotted event-style key (e.g. "order.created", "stock.low"). Indexed so
  // the dashboard can filter the inbox by type cheaply.
  type: { type: String, required: true, index: true },
  severity: {
    type: String,
    enum: ["info", "success", "warning", "error"],
    default: "info",
  },
  title: { type: String, required: true },
  body: { type: String },
  // Generic pointer back at the resource that produced the notification so
  // the UI can deep-link ("order" + orderId → /orders/:id).
  resourceType: { type: String },
  resourceId: { type: Schema.Types.ObjectId },
  data: { type: Schema.Types.Mixed },
  // Permission key required to see the notification. Null ⇒ visible to any
  // authenticated user in the tenant (subject to recipient filter).
  permission: { type: String, default: null },
  // When empty, the notification is broadcast to every permitted user.
  // When populated, only the listed users may see it.
  recipientUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  readBy: [
    {
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      readAt: { type: Date, default: Date.now },
      _id: false,
    },
  ],
  dismissedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now, index: -1 },
  // TTL — MongoDB auto-purges after this timestamp. Populated in pre-save
  // to createdAt + 90 days.
  expireAt: { type: Date },
});

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ "readBy.userId": 1 });
notificationSchema.index({ resourceType: 1, resourceId: 1 });
notificationSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

notificationSchema.pre("save", function (next) {
  if (!this.createdAt) this.createdAt = new Date();
  if (!this.expireAt) {
    this.expireAt = new Date(this.createdAt.getTime() + NINETY_DAYS_MS);
  }
  next();
});

applyTenantScope(notificationSchema);

export default notificationSchema;
