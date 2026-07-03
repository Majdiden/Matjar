import { v2 as cloudinary } from "cloudinary";
import config from "./index.js";
import logger from "../utils/logger.js";

/**
 * Cloudinary Configuration
 * Multi-tenant image storage service
 */

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
  secure: true,
});

/**
 * Generate folder path for tenant-specific uploads
 * Format: {baseFolder}/{tenantDomain}/{entityType}
 *
 * @param {string} tenantDomain - Tenant's domain
 * @param {string} entityType - Type of entity (products, categories, logos, avatars)
 * @returns {string} Folder path
 */
export const getTenantFolder = (tenantDomain, entityType) => {
  const baseFolder = config.cloudinaryFolder;
  return `${baseFolder}/${tenantDomain}/${entityType}`;
};

/**
 * Upload options for different entity types
 */
export const uploadPresets = {
  product: {
    folder: (tenantDomain) => getTenantFolder(tenantDomain, "products"),
    transformation: [
      { width: 1200, height: 1200, crop: "limit" }, // Main image
      { quality: "auto:good" },
      { fetch_format: "auto" }, // Auto format (WebP when supported)
    ],
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },

  productThumbnail: {
    folder: (tenantDomain) => getTenantFolder(tenantDomain, "products/thumbnails"),
    transformation: [
      { width: 400, height: 400, crop: "fill" },
      { quality: "auto:eco" },
      { fetch_format: "auto" },
    ],
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },

  category: {
    folder: (tenantDomain) => getTenantFolder(tenantDomain, "categories"),
    transformation: [
      { width: 800, height: 800, crop: "limit" },
      { quality: "auto:good" },
      { fetch_format: "auto" },
    ],
    allowed_formats: ["jpg", "jpeg", "png", "webp", "svg"],
  },

  logo: {
    folder: (tenantDomain) => getTenantFolder(tenantDomain, "branding"),
    transformation: [
      { width: 500, height: 500, crop: "limit" },
      { quality: "auto:best" },
      { fetch_format: "auto" },
    ],
    allowed_formats: ["jpg", "jpeg", "png", "webp", "svg"],
  },

  favicon: {
    folder: (tenantDomain) => getTenantFolder(tenantDomain, "branding"),
    transformation: [
      { width: 64, height: 64, crop: "fill" },
      { quality: "auto:best" },
      { format: "png" },
    ],
    allowed_formats: ["jpg", "jpeg", "png", "ico"],
  },

  avatar: {
    folder: (tenantDomain) => getTenantFolder(tenantDomain, "avatars"),
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
      { quality: "auto:good" },
      { fetch_format: "auto" },
    ],
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },

  // Media-library uploads destined for CMS page bodies and theme
  // sections (audit 6.6). Wide limit — hero/banner imagery is the
  // common case — with auto quality/format like the other presets.
  content: {
    folder: (tenantDomain) => getTenantFolder(tenantDomain, "content"),
    transformation: [
      { width: 1600, height: 1600, crop: "limit" },
      { quality: "auto:good" },
      { fetch_format: "auto" },
    ],
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },

  theme: {
    folder: (tenantDomain) => getTenantFolder(tenantDomain, "themes"),
    transformation: [
      { width: 1600, height: 1200, crop: "limit" },
      { quality: "auto:good" },
      { fetch_format: "auto" },
    ],
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
};

/**
 * Helper to extract public_id from Cloudinary URL
 *
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID or null
 */
export const extractPublicId = (url) => {
  if (!url) return null;

  try {
    const urlParts = url.split("/");
    const uploadIndex = urlParts.indexOf("upload");

    if (uploadIndex === -1) return null;

    // Get everything after /upload/v{version}/
    const pathAfterUpload = urlParts.slice(uploadIndex + 2).join("/");

    // Remove file extension
    const publicId = pathAfterUpload.replace(/\.[^/.]+$/, "");

    return publicId;
  } catch (error) {
    logger.error("Error extracting public_id from URL", { error: error.message });
    return null;
  }
};

/**
 * Delete image from Cloudinary
 *
 * @param {string} publicId - Public ID of the image
 * @returns {Promise<Object>} Deletion result
 */
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === "ok",
      result,
    };
  } catch (error) {
    logger.error("Error deleting image from Cloudinary", { error: error.message });
    throw error;
  }
};

/**
 * Delete multiple images from Cloudinary
 *
 * @param {string[]} publicIds - Array of public IDs
 * @returns {Promise<Object>} Deletion result
 */
export const deleteImages = async (publicIds) => {
  try {
    const result = await cloudinary.api.delete_resources(publicIds);
    return {
      success: true,
      result,
    };
  } catch (error) {
    logger.error("Error deleting multiple images from Cloudinary", { error: error.message });
    throw error;
  }
};

/**
 * Get image info from Cloudinary
 *
 * @param {string} publicId - Public ID of the image
 * @returns {Promise<Object>} Image info
 */
export const getImageInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result;
  } catch (error) {
    logger.error("Error getting image info from Cloudinary", { error: error.message });
    throw error;
  }
};

export default cloudinary;
