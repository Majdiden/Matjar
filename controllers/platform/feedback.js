import { asyncHandler } from "../../middlewares/errorHandler.js";
import {
  platformListFeedback,
  platformCountsByStatus,
  platformGetFeedback,
  platformUpdateStatus,
  platformAddNote,
} from "../../services/platform/feedback.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";

/** GET /api/platform/feedback?type=&status=&tenantId=&page=&limit= */
export const listFeedback = asyncHandler(async (req, res) => {
  const [data, counts] = await Promise.all([platformListFeedback(req.query), platformCountsByStatus()]);
  res.json({ success: true, data: { ...data, counts } });
});

/** GET /api/platform/feedback/:id */
export const getFeedback = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await platformGetFeedback(req.params.id) });
});

/** PATCH /api/platform/feedback/:id/status — tenant.lifecycle */
export const updateFeedbackStatus = asyncHandler(async (req, res) => {
  const { status, resolution, reason, notifyMerchant } = req.body;
  const out = await platformUpdateStatus(req.params.id, { status, resolution, notifyMerchant }, req.platformUser);
  await recordPlatformAudit(req, {
    action: "feedback.status.update",
    resourceType: "PlatformFeedback",
    resourceId: req.params.id,
    tenantId: out.doc.tenantId,
    reason: reason || null,
    before: out.before,
    after: out.after,
    metadata: { notifyMerchant: !!notifyMerchant },
  });
  res.json({ success: true, data: await platformGetFeedback(req.params.id) });
});

/** POST /api/platform/feedback/:id/notes — tenant.lifecycle */
export const addFeedbackNote = asyncHandler(async (req, res) => {
  const note = await platformAddNote(req.params.id, req.body.text, req.platformUser);
  const doc = await platformGetFeedback(req.params.id);
  await recordPlatformAudit(req, {
    action: "feedback.note.add",
    resourceType: "PlatformFeedback",
    resourceId: req.params.id,
    tenantId: doc.tenantId,
    metadata: { noteId: String(note._id) },
  });
  res.status(201).json({ success: true, data: doc });
});
