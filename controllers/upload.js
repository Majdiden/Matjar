import mongoose from "mongoose";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { extractFiles } from "../middlewares/upload.js";
import {
  uploadProductImages as uploadProductImagesService,
  uploadCategoryImage as uploadCategoryImageService,
  uploadLogo as uploadLogoService,
  uploadFavicon as uploadFaviconService,
  uploadAvatar as uploadAvatarService,
  uploadContentImage as uploadContentImageService,
  deleteImageByUrl,
  deleteMultipleImagesByUrl,
  uploadImage,
} from "../services/upload.js";
import config from "../config/index.js";
import { logAudit } from "../utils/audit.js";
import logger from "../utils/logger.js";

/**
 * Upload Controller
 *
 * Every upload that succeeds also writes an `Asset` row scoped to the
 * tenant — this is the canonical ownership record. Deletion is then
 * authorized against that row, not against URL substring matching, so
 * tenants whose slug happens to be a substring of another tenant's slug
 * cannot trick the deleter into wiping someone else's image.
 */

/**
 * Persist an Asset row for an upload result. We do this *after* the
 * upload so a Cloudinary failure doesn't leave a phantom row, and we
 * never let an asset write failure surface as a 5xx — the file is
 * already up, the API contract is "URL returned ⇒ usable URL", so we
 * log and continue. The trade-off: an unrecorded asset becomes
 * undeletable via the API and has to be cleaned up out-of-band. That's
 * the safer failure mode than fabricating a successful upload response
 * with a missing file.
 */
const recordAsset = async (req, result, preset, meta = {}) => {
  try {
    const tenantId = req.tenant?._id || req.tenantId;
    if (!tenantId) {
      logger.error("[upload] cannot record asset — missing tenantId on request");
      return;
    }
    const created = await req.models.Asset.create({
      tenantId,
      url: result.url,
      publicId: result.publicId,
      preset,
      storage: config.isDevelopment ? "local" : "cloudinary",
      uploadedBy: req.user?.userId || null,
      bytes: result.bytes ?? 0,
      format: result.format ?? null,
      width: result.width ?? null,
      height: result.height ?? null,
      // Media library metadata (audit 6.6). `filename` is the original
      // upload name (search/display); `alt` starts empty and is edited
      // in the library.
      filename: (meta.filename || "").slice(0, 300),
      alt: (meta.alt || "").slice(0, 500),
    });
    return created;
  } catch (err) {
    // Don't fail the upload response — but make the orphan loud.
    logger.error("[upload] failed to record Asset row", { error: err.message });
  }
};

const requireTenantDomain = (req, res) => {
  const tenantDomain =
    req.tenant?.domain || req.tenant?.slug || req.tenantDomain || req.user?.tenantDomain;
  if (!tenantDomain) {
    res.status(400).json({ success: false, message: "Tenant domain not found" });
    return null;
  }
  return tenantDomain;
};

/**
 * @route   POST /api/upload/product
 * @desc    Upload product images
 * @access  Private (authenticated merchants)
 */
export const uploadProductImages = asyncHandler(async (req, res) => {
  const files = extractFiles(req);
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, message: "No images provided" });
  }
  const tenantDomain = requireTenantDomain(req, res);
  if (!tenantDomain) return;

  const buffers = files.map((file) => file.buffer);
  const result = await uploadProductImagesService(buffers, tenantDomain);

  // result.data is the per-image upload metadata array; record each one.
  await Promise.all((result.data || []).map((img) => recordAsset(req, img, "product")));

  res.json({
    success: true,
    message: `Uploaded ${result.images.length} images successfully`,
    data: { urls: result.images, count: result.images.length },
  });
});

/**
 * @route   POST /api/upload/category
 * @desc    Upload category image
 * @access  Private (authenticated merchants)
 */
export const uploadCategoryImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image provided" });
  }
  const tenantDomain = requireTenantDomain(req, res);
  if (!tenantDomain) return;

  const result = await uploadCategoryImageService(req.file.buffer, tenantDomain);
  await recordAsset(req, result, "category");

  res.json({
    success: true,
    message: "Category image uploaded successfully",
    data: { url: result.url, publicId: result.publicId },
  });
});

/**
 * @route   POST /api/upload/logo
 * @desc    Upload store logo
 * @access  Private (authenticated merchants)
 */
export const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No logo provided" });
  }
  const tenantDomain = requireTenantDomain(req, res);
  if (!tenantDomain) return;

  const result = await uploadLogoService(req.file.buffer, tenantDomain);
  await recordAsset(req, result, "logo");

  // Mutate by _id: req.tenantId. Matching on parsed subdomain is
  // brittle — custom domains, renamed subdomains, and legacy domain
  // shapes could point at the wrong (or no) tenant. `req.tenantId`
  // is the authenticated, host-verified identity and is the only
  // safe key for tenant mutations.
  const Tenant = mongoose.model("Tenant");
  const updated = await Tenant.findByIdAndUpdate(
    req.tenantId,
    { "settings.logo": result.url },
    { new: true }
  );
  if (!updated) {
    return res.status(500).json({
      success: false,
      message: "Failed to attach logo to tenant settings",
    });
  }

  res.json({
    success: true,
    message: "Logo uploaded successfully",
    data: { url: result.url, publicId: result.publicId },
  });
});

/**
 * @route   POST /api/upload/favicon
 * @desc    Upload store favicon
 * @access  Private (authenticated merchants)
 */
export const uploadFavicon = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No favicon provided" });
  }
  const tenantDomain = requireTenantDomain(req, res);
  if (!tenantDomain) return;

  const result = await uploadFaviconService(req.file.buffer, tenantDomain);
  await recordAsset(req, result, "favicon");

  // Tenant mutations must bind to req.tenantId (authenticated +
  // host-verified), not to the parsed subdomain.
  const Tenant = mongoose.model("Tenant");
  const updated = await Tenant.findByIdAndUpdate(
    req.tenantId,
    { "settings.favicon": result.url },
    { new: true }
  );
  if (!updated) {
    return res.status(500).json({
      success: false,
      message: "Failed to attach favicon to tenant settings",
    });
  }

  res.json({
    success: true,
    message: "Favicon uploaded successfully",
    data: { url: result.url, publicId: result.publicId },
  });
});

/**
 * @route   POST /api/upload/avatar
 * @desc    Upload user avatar
 * @access  Private (authenticated users)
 */
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No avatar provided" });
  }
  const tenantDomain = requireTenantDomain(req, res);
  if (!tenantDomain) return;
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: "User not authenticated" });
  }

  const result = await uploadAvatarService(req.file.buffer, tenantDomain);
  await recordAsset(req, result, "avatar");

  const User = req.models.User;
  await User.findByIdAndUpdate(userId, { avatar: result.url }, { new: true });

  res.json({
    success: true,
    message: "Avatar uploaded successfully",
    data: { url: result.url, publicId: result.publicId },
  });
});

/**
 * @route   POST /api/upload/image
 * @desc    Upload generic image
 * @access  Private (authenticated users)
 */
export const uploadGenericImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image provided" });
  }

  const ALLOWED_PRESETS = ["product", "category", "logo", "favicon", "avatar"];
  const { preset = "product" } = req.body;
  if (!ALLOWED_PRESETS.includes(preset)) {
    return res.status(400).json({
      success: false,
      message: `Invalid upload preset. Allowed: ${ALLOWED_PRESETS.join(", ")}`,
    });
  }
  const tenantDomain = requireTenantDomain(req, res);
  if (!tenantDomain) return;

  const result = await uploadImage(req.file.buffer, tenantDomain, preset);
  await recordAsset(req, result, preset, { filename: req.file.originalname });

  res.json({
    success: true,
    message: "Image uploaded successfully",
    data: {
      url: result.url,
      publicId: result.publicId,
      format: result.format,
      width: result.width,
      height: result.height,
    },
  });
});

/**
 * @route   POST /api/upload/content
 * @desc    Upload a media-library content image (audit 6.6). Records an
 *          Asset row with preset "content" plus the original filename so
 *          the library can search/display it. Used by the MediaLibrary
 *          dropzone and the MediaPicker upload path.
 * @access  Private (uploads.write)
 */
export const uploadContentImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image provided" });
  }
  const tenantDomain = requireTenantDomain(req, res);
  if (!tenantDomain) return;

  const result = await uploadContentImageService(req.file.buffer, tenantDomain);
  const asset = await recordAsset(req, result, "content", {
    filename: req.file.originalname,
    alt: typeof req.body?.alt === "string" ? req.body.alt : "",
  });

  res.json({
    success: true,
    message: "Image uploaded successfully",
    data: {
      _id: asset?._id,
      url: result.url,
      publicId: result.publicId,
      format: result.format,
      width: result.width,
      height: result.height,
      alt: asset?.alt || "",
      filename: asset?.filename || "",
      preset: "content",
    },
  });
});

/**
 * @route   DELETE /api/upload/image
 * @desc    Delete image by URL
 * @access  Private (authenticated users)
 *
 * Authorization is row-level: the URL must resolve to an Asset record
 * scoped to the caller's tenant. The scoped Asset model already filters
 * `tenantId`, so a tenant cannot find — let alone delete — another
 * tenant's asset row even if it knows the URL.
 */
export const deleteImage = asyncHandler(async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ success: false, message: "Image URL is required" });
  }

  const asset = await req.models.Asset.findOne({ url: imageUrl });
  if (!asset) {
    // Either the URL doesn't exist or it belongs to another tenant —
    // we collapse both into 404 so we don't leak which.
    return res.status(404).json({ success: false, message: "Asset not found" });
  }

  const result = await deleteImageByUrl(imageUrl);
  if (result.success) {
    await req.models.Asset.deleteOne({ _id: asset._id });
    logAudit(req.models, {
      action: "asset.deleted",
      resource: "Asset",
      resourceId: asset._id,
      metadata: { url: imageUrl, preset: asset.preset },
      req,
    });
  }

  res.json({ success: result.success, message: result.message });
});

/**
 * @route   DELETE /api/upload/images
 * @desc    Delete multiple images by URLs
 * @access  Private (authenticated users)
 *
 * Same row-level authorization as the single-delete handler: every URL
 * must map to an Asset row owned by the caller's tenant. If even one
 * URL fails the lookup, the whole batch is rejected — partial deletes
 * make tenant-isolation reasoning harder and the merchant can always
 * retry the legitimate subset.
 */
export const deleteMultipleImages = asyncHandler(async (req, res) => {
  const { imageUrls } = req.body;
  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    return res.status(400).json({ success: false, message: "Image URLs array is required" });
  }

  const owned = await req.models.Asset.find({ url: { $in: imageUrls } });
  if (owned.length !== imageUrls.length) {
    return res
      .status(404)
      .json({ success: false, message: "One or more assets not found" });
  }

  const result = await deleteMultipleImagesByUrl(imageUrls);
  if (result.success) {
    await req.models.Asset.deleteMany({ _id: { $in: owned.map((a) => a._id) } });
    logAudit(req.models, {
      action: "asset.deleted_bulk",
      resource: "Asset",
      metadata: { count: owned.length, urls: imageUrls },
      req,
    });
  }

  res.json({
    success: result.success,
    message: result.message,
    data: { deletedCount: result.deletedCount },
  });
});
