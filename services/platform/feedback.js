/**
 * Merchant → platform feedback. Merchant-facing reads strip internal notes;
 * platform-facing reads include them. Status changes are audited and may
 * notify the merchant by email (text only).
 */
import mongoose from "mongoose";
import { APIError } from "../../middlewares/errorHandler.js";
import { sendEmail } from "../providers/email.js";
import { tenantNameMap } from "./tenantNames.js";
import logger from "../../utils/logger.js";

const Feedback = () => mongoose.model("PlatformFeedback");

/** Shape returned to the merchant that submitted it. No internal notes. */
export function merchantView(doc) {
  return {
    _id: String(doc._id),
    type: doc.type,
    status: doc.status,
    subject: doc.subject,
    message: doc.message,
    page: doc.page,
    attachments: doc.attachments || [],
    resolution: doc.resolution || null,
    resolvedAt: doc.resolvedAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function createFeedback({ tenantId, userId, userEmail, userName, type, subject, message, page, browser, attachments }) {
  const doc = await Feedback().create({
    tenantId,
    userId,
    userEmail: userEmail || null,
    userName: userName || null,
    type,
    subject,
    message,
    page: page ? String(page).slice(0, 500) : null,
    browser: browser ? String(browser).slice(0, 300) : null,
    attachments: attachments || [],
  });
  return merchantView(doc);
}

export async function listOwnFeedback(tenantId, { page = 1, limit = 20 } = {}) {
  const filter = { tenantId };
  const [rows, total] = await Promise.all([
    Feedback().find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Feedback().countDocuments(filter),
  ]);
  return { items: rows.map(merchantView), pagination: { total, page, pages: Math.ceil(total / limit), limit } };
}

// ---- platform side ----------------------------------------------------------

async function withTenantNames(rows) {
  const names = await tenantNameMap(rows.map((r) => r.tenantId));
  return rows.map((r) => ({ ...r, tenant: names[String(r.tenantId)] || null }));
}

export async function platformListFeedback({ page = 1, limit = 25, type, status, tenantId } = {}) {
  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (tenantId) filter.tenantId = new mongoose.Types.ObjectId(tenantId);
  const [rows, total] = await Promise.all([
    Feedback().find(filter).select("-internalNotes").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Feedback().countDocuments(filter),
  ]);
  const items = await withTenantNames(rows);
  return { items, pagination: { total, page, pages: Math.ceil(total / limit), limit } };
}

export async function platformCountsByStatus() {
  const rows = await Feedback().aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

export async function platformGetFeedback(id) {
  const doc = await Feedback().findById(id).lean();
  if (!doc) throw new APIError("Feedback not found", 404);
  const [row] = await withTenantNames([doc]);
  return row;
}

export async function platformUpdateStatus(id, { status, resolution, notifyMerchant }, actor) {
  const doc = await Feedback().findById(id);
  if (!doc) throw new APIError("Feedback not found", 404);
  const before = { status: doc.status, resolution: doc.resolution || null };
  doc.status = status;
  if (resolution !== undefined) doc.resolution = resolution || null;
  if (["resolved", "wont_fix"].includes(status)) doc.resolvedAt = doc.resolvedAt || new Date();
  else doc.resolvedAt = null;
  await doc.save();

  if (notifyMerchant && doc.userEmail && ["resolved", "wont_fix", "planned"].includes(status)) {
    // Text-only, no links with tokens, no internal notes.
    const subject = `Update on your feedback: ${doc.subject}`;
    const text = [
      `Hello${doc.userName ? ` ${doc.userName}` : ""},`,
      "",
      `Your feedback "${doc.subject}" is now marked as: ${status.replace(/_/g, " ")}.`,
      doc.resolution ? `\n${doc.resolution}` : "",
      "",
      "Thank you for helping us improve Matjar.",
    ].join("\n");
    sendEmail({ to: doc.userEmail, subject, text }).catch((err) =>
      logger.warn("feedback: notify email failed", { id: String(doc._id), error: err.message })
    );
  }
  return { before, after: { status: doc.status, resolution: doc.resolution || null }, doc, actor };
}

export async function platformAddNote(id, text, actor) {
  const doc = await Feedback().findById(id);
  if (!doc) throw new APIError("Feedback not found", 404);
  doc.internalNotes.push({ by: actor.id, byEmail: actor.email || null, text });
  await doc.save();
  return doc.internalNotes[doc.internalNotes.length - 1];
}
