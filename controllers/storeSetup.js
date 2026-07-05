import crypto from "crypto";
import mongoose from "mongoose";
import {
  getSetupStatus,
  clearSetupStatus,
  publishStarterContent,
} from "../services/storeSetup.js";
import { asyncHandler, APIError } from "../middlewares/errorHandler.js";

/**
 * Draft-starter status for the dashboard "publish your store" banner.
 * Returns whether the store still has unpublished starter content, and a
 * ready-to-open owner PREVIEW url (storefront + ?preview=<token>) so the
 * merchant can see their store filled with the draft content before going
 * live. Authenticated (req.tenant + req.models from the auth middleware).
 */
export const starterStatusController = asyncHandler(async (req, res) => {
  if (!req.models || !req.tenant) {
    throw new APIError("Tenant context not found", 400);
  }

  const [draftProducts, draftCollections, draftPages] = await Promise.all([
    req.models.Product.countDocuments({ isDemo: true, status: "draft" }),
    req.models.Collection.countDocuments({ isDemo: true, isPublished: false }),
    req.models.Page.countDocuments({ isDemo: true, isPublished: false }),
  ]);
  const hasDraftStarter = draftProducts + draftCollections + draftPages > 0;

  // Ensure a stable preview token exists (backfill for stores created before
  // the field was added).
  let previewToken = req.tenant.settings?.previewToken;
  if (!previewToken) {
    previewToken = crypto.randomBytes(16).toString("hex");
    await mongoose
      .model("Tenant")
      .updateOne({ _id: req.tenant._id }, { $set: { "settings.previewToken": previewToken } });
  }

  const host =
    req.tenant.domains?.subdomain?.fullDomain ||
    `${req.tenant.slug}.${process.env.PLATFORM_DOMAIN || process.env.DOMAIN_SUFFIX || "matjar.to"}`;
  const protocol = /(^|\.)localhost(:|$)/.test(host) ? "http" : "https";
  const previewUrl = `${protocol}://${host}/?preview=${encodeURIComponent(previewToken)}`;

  res.json({
    success: true,
    responseObject: {
      hasDraftStarter,
      counts: { products: draftProducts, collections: draftCollections, pages: draftPages },
      previewUrl,
      // Surfaced for the dashboard setup checklist: when the merchant actively
      // picked a theme at onboarding (true) the "customize theme" step is
      // hidden; when they skipped it (false) the step is shown until published.
      themeSelected: req.tenant.themeSelected !== false,
    },
  });
});

/**
 * Get store setup status
 * Returns the current status of store setup for a tenant
 */
export const getSetupStatusController = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  // Token comes from the registration response — the dashboard echoes it
  // back as ?token=... on every poll.
  const token = req.query.token;

  const status = await getSetupStatus(tenantId, token);

  if (!status.found) {
    // Same 404 response whether the tenant doesn't exist OR the token is
    // wrong — never leak which case it was, otherwise an attacker can
    // enumerate valid tenantIds.
    return res.status(404).json({
      success: false,
      message: "Setup status not found. Setup may have already completed or never started.",
    });
  }

  res.json({
    success: true,
    message: "Setup status retrieved successfully",
    responseObject: status,
  });
});

/**
 * Clear setup status (cleanup after viewing)
 */
export const clearSetupStatusController = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  const token = req.query.token;

  const result = await clearSetupStatus(tenantId, token);

  if (!result.cleared) {
    return res.status(404).json({
      success: false,
      message: "Setup status not found.",
    });
  }

  res.json({
    success: true,
    message: "Setup status cleared successfully",
  });
});

/**
 * Publish the draft starter content seeded at signup — take the store live.
 * Flips isDemo draft products → active and demo collections/pages → published.
 * Idempotent: re-running returns zero counts. Authenticated + settings.write.
 */
export const publishStarterController = asyncHandler(async (req, res) => {
  if (!req.models) {
    throw new APIError("Tenant context not found", 400);
  }
  const counts = await publishStarterContent(req.models, req.tenant?._id);
  res.json({
    success: true,
    message: "Starter content published",
    responseObject: counts,
  });
});
