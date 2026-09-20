/**
 * Merchant-side feedback (tenant-scoped via `authenticate`). A merchant can
 * submit feedback about the platform and read their own submissions; the
 * platform's internal notes are never returned here.
 */
import { asyncHandler } from "../middlewares/errorHandler.js";
import { createFeedback, listOwnFeedback } from "../services/platform/feedback.js";
import { logAudit } from "../utils/audit.js";

/** Path only — never persist query strings (they may carry tokens). */
function refererPath(req) {
  const ref = req.headers.referer || req.headers.referrer;
  if (!ref) return null;
  try {
    return new URL(String(ref)).pathname.slice(0, 500);
  } catch {
    return null;
  }
}

export const submitFeedback = asyncHandler(async (req, res) => {
  const me = await req.models.User.findById(req.user.userId).select("name email").lean();
  const page = refererPath(req);
  const item = await createFeedback({
    tenantId: req.tenant._id,
    userId: req.user.userId,
    userEmail: me?.email,
    userName: me?.name,
    type: req.body.type,
    subject: req.body.subject,
    message: req.body.message,
    page,
    browser: req.headers["user-agent"],
    attachments: req.body.attachments,
  });
  logAudit(req.models, {
    action: "feedback.submitted",
    resource: "PlatformFeedback",
    resourceId: item._id,
    req,
    metadata: { type: item.type },
  });
  res.status(201).json({ success: true, message: "Thanks — your feedback was sent.", responseObject: item });
});

export const listMyFeedback = asyncHandler(async (req, res) => {
  const data = await listOwnFeedback(req.tenant._id, req.query);
  res.json({ success: true, responseObject: data });
});
