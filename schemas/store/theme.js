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

    // Theme Configuration
    settings: {
      // Colors
      colors: {
        primary: { type: String, default: "#2563eb" },
        secondary: { type: String, default: "#1e40af" },
        accent: { type: String, default: "#f59e0b" },
        background: { type: String, default: "#ffffff" },
        text: { type: String, default: "#1f2937" },
        textLight: { type: String, default: "#6b7280" },
        success: { type: String, default: "#10b981" },
        error: { type: String, default: "#ef4444" },
        border: { type: String, default: "#e5e7eb" },
      },

      // Typography
      typography: {
        fontFamily: {
          type: String,
          default: "'Inter', sans-serif",
        },
        fontSizeBase: {
          type: String,
          default: "16px",
        },
        headingFontFamily: {
          type: String,
          default: "'Inter', sans-serif",
        },
      },

      // Layout
      layout: {
        containerWidth: {
          type: String,
          default: "1280px",
        },
        headerHeight: {
          type: String,
          default: "80px",
        },
        sidebarWidth: {
          type: String,
          default: "280px",
        },
      },

      // Homepage
      homepage: {
        showFeaturedProducts: { type: Boolean, default: true },
        featuredProductsLimit: { type: Number, default: 8 },
        showCategories: { type: Boolean, default: true },
        showBanner: { type: Boolean, default: true },
        bannerText: { type: String, default: "Free Shipping on Orders Over $50" },
        showNewArrivals: { type: Boolean, default: true },
        newArrivalsLimit: { type: Number, default: 12 },
      },

      // Product Page
      product: {
        showRelatedProducts: { type: Boolean, default: true },
        relatedProductsLimit: { type: Number, default: 4 },
        showReviews: { type: Boolean, default: true },
        showStock: { type: Boolean, default: true },
        enableZoom: { type: Boolean, default: true },
      },

      // Cart
      cart: {
        showRecommendations: { type: Boolean, default: true },
        enableQuickCheckout: { type: Boolean, default: true },
      },

      // Footer
      footer: {
        showNewsletter: { type: Boolean, default: true },
        showSocialLinks: { type: Boolean, default: true },
        copyrightText: { type: String, default: "© 2024 All rights reserved." },
      },

      // Custom settings (JSON)
      custom: {
        type: Map,
        of: Schema.Types.Mixed,
      },
    },

    // Features
    features: [
      {
        type: String,
        enum: [
          "responsive-design",
          "product-quick-view",
          "ajax-cart",
          "product-zoom",
          "reviews-ratings",
          "wishlist",
          "product-comparison",
          "mega-menu",
          "live-search",
          "multi-currency",
          "multi-language",
          "rtl-support",
          "dark-mode",
          "size-guide",
          "color-swatches",
          "fit-guide",
        ],
      },
    ],

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

    // Metadata
    tags: [String],
    categories: [
      {
        type: String,
        enum: [
          "fashion",
          "apparel",
          "electronics",
          "food",
          "beauty",
          "sports",
          "home",
          "books",
          "toys",
          "general",
        ],
      },
    ],

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

// Instance Methods

/**
 * Check if feature is enabled
 */
themeSchema.methods.hasFeature = function (featureName) {
  return this.features.includes(featureName);
};

/**
 * Get theme configuration for frontend
 */
themeSchema.methods.getPublicConfig = function () {
  return {
    name: this.name,
    version: this.version,
    settings: this.settings,
    features: this.features,
  };
};

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
