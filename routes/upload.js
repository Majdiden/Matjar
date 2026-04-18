import express from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import {
  uploadMultipleImages,
  uploadSingleImage,
  uploadSingleLogo,
  uploadSingleFavicon,
  uploadSingleAvatar,
  handleUploadError,
  validateUploadedFiles,
} from "../middlewares/upload.js";

import {
  uploadProductImages,
  uploadCategoryImage,
  uploadLogo,
  uploadFavicon,
  uploadAvatar,
  uploadGenericImage,
  deleteImage,
  deleteMultipleImages,
} from "../controllers/upload.js";
import { uploadLimiter } from "../middlewares/rateLimiters.js";

const router = express.Router();

// Tenant resolved at route.config.js level via storefrontTenantResolver
// Dedicated upload rate limit caps bandwidth/storage abuse independent
// of the global /api limiter.
router.use(uploadLimiter, authenticate);

/**
 * @route   POST /api/upload/product
 * @desc    Upload product images (multiple)
 * @access  Private
 */
router.post(
  "/product",
  requirePermission("uploads.write"),
  uploadMultipleImages,
  handleUploadError,
  validateUploadedFiles,
  uploadProductImages
);

/**
 * @route   POST /api/upload/category
 * @desc    Upload category image (single)
 * @access  Private
 */
router.post(
  "/category",
  requirePermission("uploads.write"),
  uploadSingleImage,
  handleUploadError,
  validateUploadedFiles,
  uploadCategoryImage
);

/**
 * @route   POST /api/upload/logo
 * @desc    Upload store logo
 * @access  Private
 */
router.post(
  "/logo",
  requirePermission("uploads.write"),
  uploadSingleLogo,
  handleUploadError,
  validateUploadedFiles,
  uploadLogo
);

/**
 * @route   POST /api/upload/favicon
 * @desc    Upload store favicon
 * @access  Private
 */
router.post(
  "/favicon",
  requirePermission("uploads.write"),
  uploadSingleFavicon,
  handleUploadError,
  validateUploadedFiles,
  uploadFavicon
);

/**
 * @route   POST /api/upload/avatar
 * @desc    Upload user avatar
 * @access  Private
 */
router.post(
  "/avatar",
  uploadSingleAvatar,
  handleUploadError,
  validateUploadedFiles,
  uploadAvatar
);

/**
 * @route   POST /api/upload/image
 * @desc    Upload generic image
 * @access  Private
 */
router.post(
  "/image",
  requirePermission("uploads.write"),
  uploadSingleImage,
  handleUploadError,
  validateUploadedFiles,
  uploadGenericImage
);

/**
 * @route   DELETE /api/upload/image
 * @desc    Delete single image
 * @access  Private
 */
router.delete("/image", requirePermission("uploads.write"), deleteImage);

/**
 * @route   DELETE /api/upload/images
 * @desc    Delete multiple images
 * @access  Private
 */
router.delete("/images", requirePermission("uploads.write"), deleteMultipleImages);

export default router;
