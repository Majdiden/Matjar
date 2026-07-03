import cloudinary, {
  uploadPresets,
  deleteImage,
  deleteImages,
  extractPublicId,
} from "../config/cloudinary.js";
import sharp from "sharp";
import config from "../config/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Upload Service
 * Handles image uploads to Cloudinary with optimization
 */

/**
 * Upload a single image to Cloudinary
 *
 * @param {Buffer|string} file - File buffer or path
 * @param {string} tenantDomain - Tenant's domain
 * @param {string} preset - Upload preset name (product, category, logo, etc.)
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Upload result with URL and public_id
 */
export const uploadImage = async (file, tenantDomain, preset = "product", options = {}) => {
  try {
    // Handle local development upload
    if (config.isDevelopment) {
      const uploadDir = path.join(process.cwd(), "public", "uploads", preset);
      
      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      const filename = `${preset}-${timestamp}-${random}.jpg`; // Default to jpg for simplicity
      const filepath = path.join(uploadDir, filename);

      // Process buffer
      let buffer = file;
      if (!Buffer.isBuffer(file)) {
        // Handle base64 or path if needed, but assuming buffer for now based on controller
        // If it's a path, read it
        if (typeof file === 'string' && fs.existsSync(file)) {
           buffer = fs.readFileSync(file);
        } else if (typeof file === 'string' && file.startsWith('data:')) {
           // Handle base64 string
           const base64Data = file.replace(/^data:image\/\w+;base64,/, "");
           buffer = Buffer.from(base64Data, 'base64');
        }
      }

      // Optimize and save locally
      // We can use sharp here too if we want consistent optimization
      await sharp(buffer)
        .resize(1200, 1200, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat("jpeg", { quality: 85 })
        .toFile(filepath);

      const fileStats = fs.statSync(filepath);
      const metadata = await sharp(filepath).metadata();
      
      // Return a ROOT-RELATIVE URL. Hardcoding `http://localhost:3000`
      // breaks every tenant served on a subdomain (the storefront at
      // `acme.localhost:3000` would load images from the bare
      // `localhost:3000` origin, which is cross-origin under
      // helmet's `crossOriginResourcePolicy: same-site` and the
      // `img-src 'self'` CSP — i.e. every product image renders as a
      // broken image). A relative path resolves against whatever
      // origin the browser loaded the storefront from, which is the
      // same Express process on the same port, so static files from
      // `public/uploads` are served same-origin and the CSP allows
      // them via `'self'`.
      const url = `/uploads/${preset}/${filename}`;

      return {
        success: true,
        url: url,
        publicId: `local-${preset}-${timestamp}-${random}`,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        bytes: fileStats.size,
      };
    }

    const presetConfig = uploadPresets[preset];

    if (!presetConfig) {
      throw new Error(`Invalid upload preset: ${preset}`);
    }

    const uploadOptions = {
      folder: presetConfig.folder(tenantDomain),
      transformation: presetConfig.transformation,
      allowed_formats: presetConfig.allowed_formats,
      resource_type: "image",
      ...options,
    };

    // If file is a buffer, convert to base64
    let uploadFile = file;
    if (Buffer.isBuffer(file)) {
      uploadFile = `data:image/jpeg;base64,${file.toString("base64")}`;
    }

    const result = await cloudinary.uploader.upload(uploadFile, uploadOptions);

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    };
  } catch (error) {
    logger.error("Error uploading image", { error: error.message });
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

/**
 * Upload multiple images to Cloudinary
 *
 * @param {Array} files - Array of file buffers or paths
 * @param {string} tenantDomain - Tenant's domain
 * @param {string} preset - Upload preset name
 * @param {Object} options - Additional upload options
 * @returns {Promise<Array>} Array of upload results
 */
export const uploadMultipleImages = async (files, tenantDomain, preset = "product", options = {}) => {
  try {
    const uploadPromises = files.map((file) => uploadImage(file, tenantDomain, preset, options));

    const results = await Promise.all(uploadPromises);

    return {
      success: true,
      images: results,
    };
  } catch (error) {
    logger.error("Error uploading multiple images", { error: error.message });
    throw new Error(`Failed to upload images: ${error.message}`);
  }
};

/**
 * Optimize image before upload
 *
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Optimization options
 * @returns {Promise<Buffer>} Optimized image buffer
 */
export const optimizeImage = async (buffer, options = {}) => {
  try {
    const {
      width = 1200,
      height = 1200,
      quality = 85,
      format = "jpeg",
    } = options;

    const optimized = await sharp(buffer)
      .resize(width, height, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFormat(format, { quality })
      .toBuffer();

    return optimized;
  } catch (error) {
    logger.error("Error optimizing image", { error: error.message });
    throw new Error(`Failed to optimize image: ${error.message}`);
  }
};

/**
 * Create thumbnail from image
 *
 * @param {Buffer} buffer - Image buffer
 * @param {number} size - Thumbnail size (width/height)
 * @returns {Promise<Buffer>} Thumbnail buffer
 */
export const createThumbnail = async (buffer, size = 400) => {
  try {
    const thumbnail = await sharp(buffer)
      .resize(size, size, {
        fit: "cover",
        position: "center",
      })
      .toFormat("jpeg", { quality: 80 })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    logger.error("Error creating thumbnail", { error: error.message });
    throw new Error(`Failed to create thumbnail: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary by URL
 *
 * @param {string} imageUrl - Cloudinary image URL
 * @returns {Promise<Object>} Deletion result
 */
export const deleteImageByUrl = async (imageUrl) => {
  try {
    const publicId = extractPublicId(imageUrl);

    if (!publicId) {
      throw new Error("Could not extract public_id from URL");
    }

    const result = await deleteImage(publicId);

    return {
      success: result.success,
      message: result.success ? "Image deleted successfully" : "Failed to delete image",
    };
  } catch (error) {
    logger.error("Error deleting image", { error: error.message });
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

/**
 * Delete multiple images from Cloudinary by URLs
 *
 * @param {Array<string>} imageUrls - Array of Cloudinary image URLs
 * @returns {Promise<Object>} Deletion result
 */
export const deleteMultipleImagesByUrl = async (imageUrls) => {
  try {
    const publicIds = imageUrls.map((url) => extractPublicId(url)).filter(Boolean);

    if (publicIds.length === 0) {
      throw new Error("No valid public_ids found in URLs");
    }

    const result = await deleteImages(publicIds);

    return {
      success: result.success,
      deletedCount: publicIds.length,
      message: `Deleted ${publicIds.length} images successfully`,
    };
  } catch (error) {
    logger.error("Error deleting multiple images", { error: error.message });
    throw new Error(`Failed to delete images: ${error.message}`);
  }
};

/**
 * Validate file size
 *
 * @param {number} size - File size in bytes
 * @param {number} maxSize - Max allowed size in bytes
 * @returns {boolean} Is valid
 */
export const validateFileSize = (size, maxSize = config.maxFileSize) => {
  return size <= maxSize;
};

/**
 * Validate file type
 *
 * @param {string} mimetype - File MIME type
 * @param {Array<string>} allowedTypes - Allowed MIME types
 * @returns {boolean} Is valid
 */
export const validateFileType = (mimetype, allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]) => {
  return allowedTypes.includes(mimetype);
};

/**
 * Get image metadata
 *
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} Image metadata
 */
export const getImageMetadata = async (buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();

    return {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
    };
  } catch (error) {
    logger.error("Error getting image metadata", { error: error.message });
    throw new Error(`Failed to get image metadata: ${error.message}`);
  }
};

/**
 * Upload product images (main + thumbnails)
 *
 * @param {Array} files - Array of file buffers
 * @param {string} tenantDomain - Tenant's domain
 * @returns {Promise<Object>} Upload results
 */
export const uploadProductImages = async (files, tenantDomain) => {
  try {
    const results = await uploadMultipleImages(files, tenantDomain, "product");

    return {
      success: true,
      images: results.images.map((img) => img.url),
      data: results.images,
    };
  } catch (error) {
    throw new Error(`Failed to upload product images: ${error.message}`);
  }
};

/**
 * Upload category image
 *
 * @param {Buffer} file - File buffer
 * @param {string} tenantDomain - Tenant's domain
 * @returns {Promise<Object>} Upload result
 */
export const uploadCategoryImage = async (file, tenantDomain) => {
  try {
    const result = await uploadImage(file, tenantDomain, "category");

    return {
      success: true,
      url: result.url,
      publicId: result.publicId,
    };
  } catch (error) {
    throw new Error(`Failed to upload category image: ${error.message}`);
  }
};

/**
 * Upload logo
 *
 * @param {Buffer} file - File buffer
 * @param {string} tenantDomain - Tenant's domain
 * @returns {Promise<Object>} Upload result
 */
export const uploadLogo = async (file, tenantDomain) => {
  try {
    const result = await uploadImage(file, tenantDomain, "logo");

    return {
      success: true,
      url: result.url,
      publicId: result.publicId,
    };
  } catch (error) {
    throw new Error(`Failed to upload logo: ${error.message}`);
  }
};

/**
 * Upload favicon
 *
 * @param {Buffer} file - File buffer
 * @param {string} tenantDomain - Tenant's domain
 * @returns {Promise<Object>} Upload result
 */
export const uploadFavicon = async (file, tenantDomain) => {
  try {
    const result = await uploadImage(file, tenantDomain, "favicon");

    return {
      success: true,
      url: result.url,
      publicId: result.publicId,
    };
  } catch (error) {
    throw new Error(`Failed to upload favicon: ${error.message}`);
  }
};

/**
 * Upload a media-library content image (audit 6.6). Destined for CMS
 * page bodies and theme sections; recorded as an Asset with preset
 * "content" by the controller.
 *
 * @param {Buffer} file - File buffer
 * @param {string} tenantDomain - Tenant's domain
 * @returns {Promise<Object>} Upload result (url, publicId, dimensions…)
 */
export const uploadContentImage = async (file, tenantDomain) => {
  try {
    return await uploadImage(file, tenantDomain, "content");
  } catch (error) {
    throw new Error(`Failed to upload content image: ${error.message}`);
  }
};

/**
 * Upload user avatar
 *
 * @param {Buffer} file - File buffer
 * @param {string} tenantDomain - Tenant's domain
 * @returns {Promise<Object>} Upload result
 */
export const uploadAvatar = async (file, tenantDomain) => {
  try {
    const result = await uploadImage(file, tenantDomain, "avatar");

    return {
      success: true,
      url: result.url,
      publicId: result.publicId,
    };
  } catch (error) {
    throw new Error(`Failed to upload avatar: ${error.message}`);
  }
};
