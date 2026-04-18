import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const supportTicketSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  // Optional — guest contact-form submissions don't have an account.
  // When `user` is null we require `guestEmail` (enforced in the controller).
  user: { type: Schema.Types.ObjectId, ref: "User" },
  guestName: { type: String, trim: true },
  guestEmail: { type: String, trim: true, lowercase: true },
  source: { type: String, enum: ["account", "contact_form"], default: "account" },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  },
  status: {
    type: String,
    enum: ["open", "in_progress", "waiting_on_customer", "resolved", "closed"],
    default: "open",
  },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
  responses: [
    {
      from: { type: String, enum: ["customer", "support"], required: true },
      message: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  closedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

supportTicketSchema.index({ tenantId: 1, status: 1, priority: -1 });
supportTicketSchema.index({ tenantId: 1, user: 1, createdAt: -1 });
supportTicketSchema.index({ tenantId: 1, assignedTo: 1, status: 1 });

supportTicketSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(supportTicketSchema);

export default supportTicketSchema;
