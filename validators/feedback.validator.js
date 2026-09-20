import { z } from "zod";
import config from "../config/index.js";
import { FEEDBACK_TYPES, FEEDBACK_STATUSES } from "../schemas/platformFeedback.js";

/**
 * Attachments are references to assets the merchant already uploaded through
 * the media library: same-origin `/uploads/...` paths (local-disk provider)
 * or https URLs on the platform's own upload host (Cloudinary). Any other
 * host is rejected so the queue can never carry links to arbitrary sites.
 */
// Allow-set computed once at module load. Each source has its own guard so a
// malformed PUBLIC_DASHBOARD_URL cannot disable Cloudinary attachments.
const CLOUDINARY_HOST = "res.cloudinary.com";
const CLOUDINARY_PREFIX =
  config.uploadProvider === "cloudinary" && config.cloudinaryCloudName ? `/${config.cloudinaryCloudName}/` : null;
const DASHBOARD_HOST = (() => {
  try {
    return config.publicDashboardUrl ? new URL(config.publicDashboardUrl).hostname : null;
  } catch {
    return null;
  }
})();

export function isAllowedAttachment(v) {
  if (typeof v !== "string") return false;
  if (/^\/uploads\/[A-Za-z0-9._\/-]+$/.test(v)) return true;
  let u;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  // Cloudinary: host AND this platform's cloud-name path prefix (fail closed
  // when the cloud name is not configured).
  if (u.hostname === CLOUDINARY_HOST) return !!CLOUDINARY_PREFIX && u.pathname.startsWith(CLOUDINARY_PREFIX);
  return !!DASHBOARD_HOST && u.hostname === DASHBOARD_HOST;
}

const attachmentUrl = z
  .string()
  .trim()
  .max(500)
  .refine(isAllowedAttachment, "Attachment must be an asset uploaded to this platform");

export const createFeedbackSchema = z.object({
  body: z.object({
    type: z.enum(FEEDBACK_TYPES),
    subject: z.string().trim().min(3).max(200),
    message: z.string().trim().min(5).max(4000),
    // `page` is derived server-side from the Referer header; a client-supplied
    // value is ignored (zod strips undeclared keys).
    attachments: z.array(attachmentUrl).max(3).optional(),
  }),
});

export const listOwnFeedbackSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const platformListFeedbackSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    type: z.enum(FEEDBACK_TYPES).optional(),
    status: z.enum(FEEDBACK_STATUSES).optional(),
    tenantId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  }),
});

export const updateFeedbackStatusSchema = z.object({
  body: z.object({
    status: z.enum(FEEDBACK_STATUSES),
    resolution: z.string().trim().max(2000).optional(),
    reason: z.string().trim().min(3).max(500).optional(),
    notifyMerchant: z.boolean().optional(),
  }),
});

export const addFeedbackNoteSchema = z.object({
  body: z.object({
    text: z.string().trim().min(1).max(2000),
  }),
});
