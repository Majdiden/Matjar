import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import * as svc from "../../services/platform/paymentCatalog.js";
import { PAYMENT_INTEGRATIONS } from "../../config/paymentIntegrations.js";
import { uploadImage } from "../../services/upload.js";

const audit = (req, action, entry, extra = {}) =>
  recordPlatformAudit(req, {
    action,
    resourceType: "PlatformPaymentMethod",
    resourceId: entry?._id ? String(entry._id) : null,
    reason: req.body?.reason,
    metadata: { code: entry?.code },
    ...extra,
  });

export const list = asyncHandler(async (_req, res) => {
  const [entries, usage] = await Promise.all([svc.listCatalog(), svc.usageByCode()]);
  res.json({
    success: true,
    data: {
      entries: entries.map((e) => ({ ...e, storesEnabled: usage[e.code] || 0 })),
      integrations: PAYMENT_INTEGRATIONS.map(({ key, type, label, description, supportsProviders, merchantFields }) => ({ key, type, label, description, supportsProviders, merchantFields })),
    },
  });
});

export const create = asyncHandler(async (req, res) => {
  const { reason: _r, ...body } = req.body;
  const entry = await svc.createEntry(body, req.platformUser);
  await audit(req, "payments.catalog.create", entry, { after: { code: entry.code, enabled: entry.enabled } });
  res.status(201).json({ success: true, data: entry });
});

export const update = asyncHandler(async (req, res) => {
  const { reason: _r, ...patch } = req.body;
  const { before, after } = await svc.updateEntry(req.params.id, patch);
  await audit(req, "payments.catalog.update", after, { before: { enabled: before.enabled, label: before.label }, after: { enabled: after.enabled, label: after.label }, metadata: { code: after.code, fields: Object.keys(patch) } });
  res.json({ success: true, data: after });
});

export const remove = asyncHandler(async (req, res) => {
  const entry = await svc.deleteEntry(req.params.id);
  await audit(req, "payments.catalog.delete", entry, { before: { code: entry.code } });
  res.json({ success: true, data: { id: entry._id } });
});

/** POST /:id/logo — multipart "logo"; stored under the platform folder. */
export const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No logo provided" });
  const result = await uploadImage(req.file.buffer, "platform", "logo");
  const entry = await svc.setLogo(req.params.id, result.url);
  await audit(req, "payments.catalog.logo", entry, { after: { logo: result.url } });
  res.json({ success: true, data: entry });
});
