import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary, { uploadPresets } from "../config/cloudinary.js";
import config from "../config/index.js";

/**
 * Upload Middleware
 * Handles file uploads with multer and Cloudinary
 */

/**
 * File filter function for multer
 * Validates file type
 */
const fileFilter = (req, file, cb) => {
  // Allowed MIME types
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  // SVG blocked by default — XSS risk
  if (file.mimetype === "image/svg+xml") {
    return cb(new Error("SVG uploads are not allowed for security reasons"), false);
  }

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Only JPEG, PNG, and WebP images are allowed. Received: ${file.mimetype}`
      ),
      false
    );
  }
};

/**
 * Create Cloudinary storage configuration for multer
 *
 * @param {string} preset - Upload preset name
 * @returns {CloudinaryStorage} Cloudinary storage instance
 */
const createCloudinaryStorage = (preset = "product") => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const tenantDomain = req.tenantDomain || req.tenant?.domain || "default";
      const presetConfig = uploadPresets[preset] || uploadPresets.product;

      return {
        folder: presetConfig.folder(tenantDomain),
        allowed_formats: presetConfig.allowed_formats,
        transformation: presetConfig.transformation,
        resource_type: "image",
      };
    },
  });
};

/**
 * Create multer upload middleware with memory storage
 * This stores files in memory as buffers for processing before upload
 *
 * @param {Object} options - Multer options
 * @returns {multer.Multer} Multer instance
 */
const createMemoryUpload = (options = {}) => {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
      fileSize: config.maxFileSize,
      files: config.maxFilesPerUpload,
    },
    ...options,
  });
};

/**
 * Create multer upload middleware with Cloudinary storage
 * This directly uploads to Cloudinary
 *
 * @param {string} preset - Upload preset name
 * @param {Object} options - Multer options
 * @returns {multer.Multer} Multer instance
 */
const createCloudinaryUpload = (preset = "product", options = {}) => {
  return multer({
    storage: createCloudinaryStorage(preset),
    fileFilter,
    limits: {
      fileSize: config.maxFileSize,
      files: config.maxFilesPerUpload,
    },
    ...options,
  });
};

/**
 * Middleware instances for different upload types
 */

// Memory storage (for processing before upload)
export const memoryUpload = createMemoryUpload();

// Single file upload handlers
export const uploadSingleImage = memoryUpload.single("image");
export const uploadSingleFile = memoryUpload.single("file");
export const uploadSingleAvatar = memoryUpload.single("avatar");
export const uploadSingleLogo = memoryUpload.single("logo");
export const uploadSingleFavicon = memoryUpload.single("favicon");

// Multiple files upload handlers
export const uploadMultipleImages = memoryUpload.array("images", config.maxFilesPerUpload);
export const uploadProductImages = memoryUpload.array("productImages", config.maxFilesPerUpload);

// Mixed field uploads (for forms with different file fields)
export const uploadMixedFiles = memoryUpload.fields([
  { name: "images", maxCount: config.maxFilesPerUpload },
  { name: "thumbnail", maxCount: 1 },
  { name: "logo", maxCount: 1 },
]);

// Direct Cloudinary upload instances (bypass buffer storage)
export const directProductUpload = createCloudinaryUpload("product");
export const directCategoryUpload = createCloudinaryUpload("category");
export const directLogoUpload = createCloudinaryUpload("logo");
export const directAvatarUpload = createCloudinaryUpload("avatar");

/**
 * Error handling middleware for multer errors
 */
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    // Multer-specific errors
    let message = "File upload error";

    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        message = `File too large. Maximum size is ${config.maxFileSize / 1024 / 1024}MB`;
        break;
      case "LIMIT_FILE_COUNT":
        message = `Too many files. Maximum is ${config.maxFilesPerUpload} files`;
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = `Unexpected field name: ${error.field}`;
        break;
      default:
        message = error.message;
    }

    return res.status(400).json({
      success: false,
      message,
      error: error.code,
    });
  } else if (error) {
    // Other errors
    return res.status(400).json({
      success: false,
      message: error.message || "Upload failed",
    });
  }

  next();
};

/**
 * Validate uploaded files middleware
 * Use after multer middleware to add additional validation
 */
/**
 * Validate magic bytes match the declared MIME type.
 *
 * This is the second line of defense after the MIME allowlist — it
 * stops a client from re-labeling an `.svg` or `.exe` as `image/png`
 * and slipping it through. Any unknown mimetype falls through to a
 * `false` return, so the allowlist remains the source of truth for
 * what we accept; this function just confirms the bytes match.
 */
function validateMagicBytes(buffer, mimetype) {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: SOI marker FF D8 FF, followed by an APPn marker.
  if (mimetype === "image/jpeg" || mimetype === "image/jpg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: full 8-byte signature 89 50 4E 47 0D 0A 1A 0A.
  if (mimetype === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // WebP is a RIFF container — `RIFF` at offset 0 is shared with
  // .wav/.avi/etc., so we MUST also confirm `WEBP` at offset 8 or a
  // crafted audio file would pass as an image.
  if (mimetype === "image/webp") {
    return (
      buffer[0] === 0x52 && // R
      buffer[1] === 0x49 && // I
      buffer[2] === 0x46 && // F
      buffer[3] === 0x46 && // F
      buffer[8] === 0x57 && // W
      buffer[9] === 0x45 && // E
      buffer[10] === 0x42 && // B
      buffer[11] === 0x50 // P
    );
  }

  return false;
}

export const validateUploadedFiles = (req, res, next) => {
  // Check if files exist
  if (!req.file && !req.files) {
    return res.status(400).json({
      success: false,
      message: "No files uploaded",
    });
  }

  // Validate single file
  if (req.file) {
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Empty file uploaded",
      });
    }
    if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "File content does not match its declared type",
      });
    }
  }

  // Validate multiple files
  if (req.files) {
    const filesArray = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();

    if (filesArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    // Check each file
    for (const file of filesArray) {
      if (!file.buffer || file.buffer.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Empty file uploaded: ${file.originalname}`,
        });
      }
      if (!validateMagicBytes(file.buffer, file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `File content mismatch: ${file.originalname}`,
        });
      }
    }
  }

  next();
};

/**
 * Extract files from request
 * Normalize req.file and req.files into a consistent array
 */
export const extractFiles = (req) => {
  if (req.file) {
    return [req.file];
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      return req.files;
    }

    // If req.files is an object (from .fields()), flatten it
    return Object.values(req.files).flat();
  }

  return [];
};

export default {
  memoryUpload,
  uploadSingleImage,
  uploadSingleFile,
  uploadSingleAvatar,
  uploadSingleLogo,
  uploadSingleFavicon,
  uploadMultipleImages,
  uploadProductImages,
  uploadMixedFiles,
  directProductUpload,
  directCategoryUpload,
  directLogoUpload,
  directAvatarUpload,
  handleUploadError,
  validateUploadedFiles,
  extractFiles,
};
