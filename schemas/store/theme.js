import { Schema } from "mongoose";

/**
 * Theme Schema
 * Manages themes for multi-tenant storefronts
 */
const themeSchema = new Schema(
  {
    // Theme Identity
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    version: {
      type: String,
      required: true,
      default: "1.0.0",
    },
    description: {
      type: String,
      trim: true,
    },
    author: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      website: { type: String, trim: true },
    },

    // Theme Status
    status: {
      type: String,
      enum: ["active", "inactive", "development"],
      default: "active",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },

    // Theme Assets
    previewImage: {
      type: String, // URL to preview image
    },
    thumbnail: {
      type: String, // URL to thumbnail
    },
    screenshots: [
      {
        url: String,
        caption: String,
      },
    ],

    // NOTE (audit 1.2): the legacy `settings` blob and `features` enum
    // were retired — a theme's colors/typography/settings schema and
    // capabilities live in its built manifest
    // (storefront-themes/<slug>/dist/manifest.json, loaded by
    // services/themeManifestRegistry.js). Migration 007 $unset the old
    // fields from existing rows.

    // Compatibility
    compatibility: {
      minPlatformVersion: {
        type: String,
        default: "1.0.0",
      },
      maxPlatformVersion: String,
      requiredPlugins: [String],
    },

    // Storage Location
    storageType: {
      type: String,
      enum: ["local", "s3", "cloudinary", "cdn"],
      default: "local",
    },
    storagePath: {
      type: String, // Base path where theme files are stored
      required: true,
    },

    // Usage Statistics
    statistics: {
      installCount: { type: Number, default: 0 },
      activeInstalls: { type: Number, default: 0 },
      rating: { type: Number, min: 0, max: 5, default: 0 },
      reviewCount: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
    },

    // Pricing (for marketplace)
    pricing: {
      isFree: { type: Boolean, default: true },
      price: { type: Number, default: 0 },
      currency: { type: String, default: "SDG" },
      licenseType: {
        type: String,
        enum: ["single", "unlimited", "subscription"],
        default: "unlimited",
      },
    },

    // Metadata. Categories are free-form strings — the theme manifest is
    // the source of truth (synced by services/themeCatalogSync.js), and
    // third-party themes may declare niches the old enum never knew
    // about (jewelry, supplements, beverages, ...).
    tags: [String],
    categories: [String],

    // Catalog-sync bookkeeping (services/themeCatalogSync.js). When a
    // sync finds a row whose manifest disappeared from disk it flips
    // status to "inactive" and stamps `missingSince`; if the manifest
    // reappears the sync re-activates the row and clears the stamp.
    // Rows deactivated manually by an operator carry no stamp and are
    // never auto-reactivated.
    catalogSync: {
      missingSince: { type: Date, default: null },
      lastSyncedAt: { type: Date, default: null },
    },

    // Support & Documentation
    documentation: {
      url: String,
      changelog: String,
    },
    support: {
      email: String,
      url: String,
      forum: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
themeSchema.index({ slug: 1 });
themeSchema.index({ status: 1 });
themeSchema.index({ isDefault: 1 });
themeSchema.index({ "statistics.rating": -1 });
themeSchema.index({ "statistics.installCount": -1 });
themeSchema.index({ tags: 1 });
themeSchema.index({ categories: 1 });

// Static Methods

/**
 * Get default theme
 */
themeSchema.statics.getDefault = async function () {
  return this.findOne({ isDefault: true, status: "active" });
};

/**
 * Get active themes
 */
themeSchema.statics.getActive = async function () {
  return this.find({ status: "active", isPublished: true }).sort({
    "statistics.rating": -1,
  });
};

/**
 * Increment install count
 */
themeSchema.statics.incrementInstalls = async function (themeId) {
  return this.findByIdAndUpdate(
    themeId,
    {
      $inc: { "statistics.installCount": 1, "statistics.activeInstalls": 1 },
    },
    { new: true }
  );
};

/**
 * Decrement active installs
 */
themeSchema.statics.decrementInstalls = async function (themeId) {
  return this.findByIdAndUpdate(
    themeId,
    {
      $inc: { "statistics.activeInstalls": -1 },
    },
    { new: true }
  );
};

export default themeSchema;
