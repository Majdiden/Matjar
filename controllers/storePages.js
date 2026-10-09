import * as StorePagesService from "../services/storePages.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { logAudit } from "../utils/audit.js";

/**
 * Generated store pages (PBI 10 — About, Contact, policies). Dashboard-facing;
 * the storefront reads the results through the normal page and store-info
 * endpoints.
 */

export const getAbout = asyncHandler(async (req, res) => {
  const data = await StorePagesService.getAboutService(req.models, req.tenantId);
  res.json({ success: true, data });
});

export const saveAbout = asyncHandler(async (req, res) => {
  const data = await StorePagesService.saveAboutService(req.models, req.tenantId, req.body || {});
  logAudit(req.models, {
    action: "pages.about.generated",
    resource: "Page",
    resourceId: data.pages.find((p) => p.generated)?.id || null,
    changes: {
      locales: data.pages.filter((p) => p.generated).map((p) => p.locale),
      overwrite: req.body?.overwrite === true,
    },
    req,
  });
  res.json({ success: true, data });
});

export const getContact = asyncHandler(async (req, res) => {
  const data = await StorePagesService.getContactService(req.tenantId);
  res.json({ success: true, data });
});

export const setContact = asyncHandler(async (req, res) => {
  const data = await StorePagesService.setContactService(req.tenantId, req.body.enabled === true);
  logAudit(req.models, {
    action: "settings.contactPage.updated",
    resource: "Settings",
    resourceId: req.tenantId,
    changes: { enabled: data.enabled },
    req,
  });
  res.json({ success: true, data });
});

export const getPolicies = asyncHandler(async (req, res) => {
  const data = await StorePagesService.getPoliciesService(req.models, req.tenantId);
  res.json({ success: true, data });
});

export const savePolicies = asyncHandler(async (req, res) => {
  const { state, changes } = await StorePagesService.savePoliciesService(
    req.models,
    req.tenantId,
    req.body || {}
  );
  logAudit(req.models, {
    action: "settings.policies.generated",
    resource: "Settings",
    resourceId: req.tenantId,
    changes: { ...changes, overwrite: req.body?.overwrite === true },
    req,
  });
  res.json({ success: true, data: state });
});
