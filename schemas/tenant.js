import { Schema } from "mongoose";
import config from "../config/index.js";

const tenantSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true }, // Unique slug for subdomain
  email: { type: String, required: true },

  // Domain Configuration
  domains: {
    // Subdomain (e.g., mystore.matjar.com)
    subdomain: {
      name: { type: String, required: true, unique: true, lowercase: true }, // e.g., "mystore"
      fullDomain: { type: String }, // Auto-generated: mystore.matjar.com
      isActive: { type: Boolean, default: true },
    },

    // Custom Domain (e.g., mystore.com) - Only for Pro/Enterprise plans
    customDomain: {
      name: { type: String, sparse: true, unique: true, lowercase: true }, // e.g., "mystore.com"
      isVerified: { type: Boolean, default: false },
      verificationCode: { type: String },
      verificationMethod: {
        type: String,
        enum: ["dns", "cname", "txt"],
      },
      verifiedAt: { type: Date },
      sslEnabled: { type: Boolean, default: false },
      sslIssuedAt: { type: Date },
    },

    // Primary domain (which one to use)
    primaryDomain: {
      type: String,
      enum: ["subdomain", "custom"],
      default: "subdomain",
    },
  },

  // Legacy domain field (for backward compatibility)
  domain: { type: String }, // Will be deprecated

  // Subscription & Billing
  //
  // References a SubscriptionPlan catalog row by its `key` slug. Kept as
  // a free lowercase string (not an enum) so platform operators can
  // create/rename plans in the catalog without a schema migration. The
  // plan-change endpoint validates the key against the catalog on write.
  subscriptionPlan: {
    type: String,
    lowercase: true,
    trim: true,
    default: "trial",
  },
  subscriptionStatus: {
    type: String,
    enum: ["active", "inactive", "cancelled", "suspended"],
    default: "active",
  },
  subscriptionStartDate: { type: Date, default: Date.now },
  subscriptionEndDate: Date,

  // Limits
  limits: {
    maxProducts: { type: Number, default: 100 },
    maxOrders: { type: Number, default: 1000 },
    maxUsers: { type: Number, default: 5 },
    maxStorageGB: { type: Number, default: 1 },
  },

  // Usage tracking
  usage: {
    products: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    users: { type: Number, default: 0 },
    storageGB: { type: Number, default: 0 },
  },

  // Store settings
  settings: {
    currency: { type: String, default: "SDG" },
    timezone: { type: String, default: "Africa/Khartoum" },
    language: { type: String, default: "en" },
    taxIncluded: { type: Boolean, default: false },
    activeTheme: { type: String, default: null }, // Theme slug
    storeName: { type: String, default: null },
    storeDescription: { type: String, default: null },
    logo: { type: String, default: null },
    favicon: { type: String, default: null },
    shipping: {
      type: { type: String, enum: ["flat", "weight", "zone", "free"], default: "flat" },
      rate: { type: Number, default: 0 },
      freeShippingThreshold: { type: Number, default: null },
      baseRate: { type: Number, default: 0 },
      perKgRate: { type: Number, default: 0 },
      zones: [{
        name: String,
        countries: [String],
        rates: [{
          name: String,
          price: Number,
          minWeight: Number,
          maxWeight: Number,
          estimatedDays: String,
        }],
      }],
    },
    // Markets — Shopify-style geographic groupings. Each market binds a set
    // of countries to a presentment currency, language, and optional price
    // adjustment. The storefront resolves a customer's market by their
    // shipping country and the checkout uses the market's currency for the
    // presentment total. The base currency in `currencies.base` is what the
    // store actually charges and reports against; the presentment currency
    // is purely for display + receipt clarity.
    markets: [
      {
        code: { type: String, required: true, lowercase: true, trim: true },
        name: { type: String, required: true, trim: true },
        countries: { type: [String], default: [] },
        currency: { type: String, required: true, uppercase: true, trim: true },
        language: { type: String, default: "en", lowercase: true, trim: true },
        // Pct in decimal form: 0.10 → +10%, -0.05 → -5%. Applied to the
        // base-currency subtotal BEFORE conversion so the merchant can
        // dial in regional pricing without juggling FX rounding.
        priceAdjustmentPct: { type: Number, default: 0 },
        enabled: { type: Boolean, default: true },
        // Exactly one market may be flagged default; the controller
        // enforces this on write. Used as the fallback when a customer's
        // country isn't in any explicit market.
        isDefault: { type: Boolean, default: false },
      },
    ],
    currencies: {
      // The currency the store actually charges in. Quotes/orders are
      // recorded in base; presentment is computed at quote time using the
      // FX rate from `rates`. Defaults to settings.currency for back-compat
      // — the controller seeds it from settings.currency on first write.
      base: { type: String, default: "SDG", uppercase: true, trim: true },
      // Map of currency-code → multiplier vs base. e.g. when base=USD,
      // rates = { EUR: 0.92, GBP: 0.79 } means 1 USD = 0.92 EUR.
      // Mixed because the dashboard set varies per merchant.
      rates: { type: Schema.Types.Mixed, default: {} },
      // ISO timestamp of the last manual or automated FX refresh — surfaces
      // staleness warnings in the dashboard. Server-managed.
      ratesUpdatedAt: { type: Date, default: null },
    },
    // Order status notifications — per-status email templates the merchant
     // can enable/disable and customise. When a status transition occurs,
     // the order notification service renders the matching template (if
     // enabled) and sends it to the customer's email. Templates support
     // {{customerName}}, {{orderNumber}}, {{status}}, {{total}},
     // {{trackingNumber}}, {{storeName}} via {{var}} substitution.
     //
     // Defaults live in `services/orderNotifications.js` so a brand-new
     // store sends sensible emails out of the box without forcing the
     // merchant to author six templates before their first order.
    notifications: {
      fromName: { type: String, default: null },
      fromEmail: { type: String, default: null },
      templates: {
        Pending:    { enabled: { type: Boolean, default: true }, subject: { type: String, default: null }, body: { type: String, default: null } },
        Processing: { enabled: { type: Boolean, default: true }, subject: { type: String, default: null }, body: { type: String, default: null } },
        Shipped:    { enabled: { type: Boolean, default: true }, subject: { type: String, default: null }, body: { type: String, default: null } },
        Delivered:  { enabled: { type: Boolean, default: true }, subject: { type: String, default: null }, body: { type: String, default: null } },
        Cancelled:  { enabled: { type: Boolean, default: true }, subject: { type: String, default: null }, body: { type: String, default: null } },
        Refunded:   { enabled: { type: Boolean, default: true }, subject: { type: String, default: null }, body: { type: String, default: null } },
      },
    },
    giftCards: {
      enabled: { type: Boolean, default: true },
    },
    tax: {
      enabled: { type: Boolean, default: false },
      // When true, line prices already contain tax — the calculator
      // backs out the included portion for the receipt instead of
      // adding it on top of the subtotal. Aliased to `pricesIncludeTax`
      // for clarity in newer API surfaces.
      includeInPrice: { type: Boolean, default: false },
      // Apply tax to shipping cost as well as line items. Required by
      // many EU/UK jurisdictions; opt-in because US merchants typically
      // don't tax shipping.
      taxShipping: { type: Boolean, default: false },
      rates: [
        {
          country: { type: String, default: "default" },
          state: { type: String, default: "*" },
          rate: { type: Number, default: 0 },
          name: String,
          // Optional product tax class this rate applies to. `null` or
          // missing means the rate applies to ALL products in the
          // jurisdiction. A class-specific rate (e.g. "food", "books")
          // wins over the generic rate when both match.
          productClass: { type: String, default: null },
        },
      ],
    },
  },

  // Theme Customization (per-tenant overrides)
  themeCustomization: {
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", default: null },
    isDraft: { type: Boolean, default: false }, // True if changes not yet published

    // Setting Overrides (override theme defaults)
    // Mixed types so themes can register arbitrary color/typography/layout tokens
    // without being constrained by the schema.
    settings: {
      colors: { type: Schema.Types.Mixed, default: {} },
      typography: { type: Schema.Types.Mixed, default: {} },
      layout: { type: Schema.Types.Mixed, default: {} },
      // Manifest-level global settings (Shopify-style theme.settings).
      // Each theme declares its own shape in manifest.settings[] — e.g.
      // "show_announcement_bar" (checkbox), "announcement_text" (text),
      // "brand_accent" (color). Values here are strictly validated
      // against that manifest on every write and on publish; unknown
      // keys and out-of-range values fail loudly instead of being
      // silently stripped. Mixed is the right type for the bag itself
      // because different themes declare different keys.
      theme: { type: Schema.Types.Mixed, default: {} },
    },

    // Section Configuration (control visibility and order)
    // Section settings/elements use Mixed because each theme/section type
    // declares its own arbitrary settings schema in its manifest.
    //
    // `sections` (flat array) = the Home ("index") template sections.
    // Kept for backwards compatibility with older pods/tenants that read
    // it directly. The canonical source is `sectionsByTemplate` — the
    // service layer writes both buckets in lockstep for the `index`
    // template so a read-side shim can continue to work.
    sections: [
      {
        id: { type: String, required: true }, // Unique ID e.g., "hero-1", "featured-products-2"
        type: { type: String, required: true }, // Section type (hero, featured-products, categories, etc.)
        enabled: { type: Boolean, default: true },
        order: { type: Number, required: true },
        layout: { type: String, default: "full-width" },
        settings: { type: Schema.Types.Mixed, default: {} },
        elements: { type: [Schema.Types.Mixed], default: [] },
        blocks: { type: [Schema.Types.Mixed], default: [] },
      },
    ],

    // Per-template section lists. Keys are template ids (index, product,
    // collection, cart, search, page). Stored as Mixed so we can lazily
    // add new templates without altering the schema.
    sectionsByTemplate: { type: Schema.Types.Mixed, default: () => ({}) },

    // Custom CSS (tenant-specific styling)
    customCSS: { type: String, default: "" },

    // Preview token for draft changes
    previewToken: { type: String, default: null },
    previewTokenExpiry: { type: Date, default: null },

    // Published snapshot.
    //
    // The fields above (settings/sections/customCSS) are the *draft* — the
    // working copy a merchant edits in the dashboard. The fields here are
    // the *published* version that the storefront actually serves to
    // shoppers. Without this split, every dashboard tweak would leak
    // straight into the live store the moment it was saved, which is
    // exactly the kind of "I broke prod by accident" experience we're
    // trying to prevent.
    //
    // Storefront reads `published`. Dashboard edits mutate the draft and
    // flip `isDraft` true. `publishCustomization` snapshots the draft into
    // here AND into the `ThemeCustomizationVersion` collection so that
    // every published state is recoverable via rollback.
    published: {
      themeSlug: { type: String, default: null },
      settings: {
        colors: { type: Schema.Types.Mixed, default: {} },
        typography: { type: Schema.Types.Mixed, default: {} },
        layout: { type: Schema.Types.Mixed, default: {} },
        // Published snapshot of manifest-level global settings. Must be
        // kept in lockstep with the draft `settings.theme` bucket above
        // so publishCustomization's snapshot is a faithful copy.
        theme: { type: Schema.Types.Mixed, default: {} },
      },
      sections: { type: [Schema.Types.Mixed], default: [] },
      // Per-template published snapshot — mirrors the draft
      // `sectionsByTemplate`. Keys: index, product, collection, cart,
      // search, page. Storefront reads this on each route.
      sectionsByTemplate: { type: Schema.Types.Mixed, default: () => ({}) },
      customCSS: { type: String, default: "" },
      version: { type: Number, default: 0 },
      publishedAt: { type: Date, default: null },
      publishedBy: { type: Schema.Types.ObjectId, default: null },
    },

    // Timestamps
    lastPublishedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now },
  },

  // Payment provider configuration
  paymentProviders: {
    stripe: {
      enabled: { type: Boolean, default: false },
      publicKey: String,
      secretKey: String, // Should be encrypted in production
    },
    paypal: {
      enabled: { type: Boolean, default: false },
      clientId: String,
      clientSecret: String, // Should be encrypted in production
    },
  },

  // Store setup status (persisted instead of in-memory).
  // `setupToken` is a one-time secret minted at registration and returned
  // to the dashboard as `setupToken` in the register response. The
  // unauthenticated /store-setup/status/:tenantId endpoint requires this
  // token as a query string (`?token=…`) so a third party who happens to
  // know the tenantId can't poll or clear another tenant's setup state.
  // The token is cleared when setup completes or is explicitly cleared.
  setupStatus: {
    status: { type: String, enum: ["pending", "in_progress", "completed", "failed"], default: "pending" },
    currentStep: String,
    steps: Schema.Types.Mixed,
    startedAt: Date,
    completedAt: Date,
    error: String,
    setupToken: { type: String, select: false },
  },

  isActive: { type: Boolean, default: true },

  // Data lifecycle.
  //
  // `suspendedAt` — set when a platform admin or billing event flips
  //   subscriptionStatus → "suspended". The subscription gate middleware
  //   reads this to block writes while still allowing storefront reads
  //   so shoppers see an empty/read-only store rather than a 404.
  // `suspensionReason` — free-text audit trail surfaced in the admin
  //   dashboard. Distinct from the audit log so support staff can see
  //   it without joining another collection.
  // `deletionScheduledAt` — soft-delete. Merchant/platform requests
  //   wipe; tenant stays intact for a grace window so the user can
  //   change their mind, then the lifecycle worker purges.
  // `deletedAt` — set by the purge job after data is wiped. Tenant row
  //   is kept for compliance audit trail but carries no exploitable data.
  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String, default: null },
  deletionScheduledAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes for fast domain lookup
tenantSchema.index({ domain: 1 }); // Legacy
tenantSchema.index({ email: 1 });
tenantSchema.index({ slug: 1 });
tenantSchema.index({ "domains.subdomain.name": 1 });
tenantSchema.index({ "domains.subdomain.fullDomain": 1 });
tenantSchema.index(
  { "domains.customDomain.name": 1 },
  { unique: true, sparse: true }
); // Sparse index to allow null values

// Instance Methods

/**
 * Get the active domain for this tenant
 */
tenantSchema.methods.getActiveDomain = function () {
  if (
    this.domains.primaryDomain === "custom" &&
    this.domains.customDomain.name &&
    this.domains.customDomain.isVerified
  ) {
    return this.domains.customDomain.name;
  }
  return (
    this.domains.subdomain.fullDomain ||
    `${this.domains.subdomain.name}.${config.platformDomain}`
  );
};

/**
 * Get all domains (subdomain + custom if exists)
 */
tenantSchema.methods.getAllDomains = function () {
  const domains = [
    this.domains.subdomain.fullDomain ||
      `${this.domains.subdomain.name}.${config.platformDomain}`,
  ];

  if (this.domains.customDomain.name && this.domains.customDomain.isVerified) {
    domains.push(this.domains.customDomain.name);
  }

  return domains;
};

/**
 * Check if custom domain is allowed for current subscription plan
 */
tenantSchema.methods.canUseCustomDomain = function () {
  return ["pro", "enterprise"].includes(this.subscriptionPlan);
};

/**
 * Check if domain matches this tenant
 */
tenantSchema.methods.matchesDomain = function (domain) {
  const normalizedDomain = domain.toLowerCase();

  // Check subdomain
  const subdomainFull =
    this.domains.subdomain.fullDomain ||
    `${this.domains.subdomain.name}.${config.platformDomain}`;
  if (normalizedDomain === subdomainFull.toLowerCase()) {
    return true;
  }

  // Check custom domain
  if (this.domains.customDomain.name && this.domains.customDomain.isVerified) {
    if (normalizedDomain === this.domains.customDomain.name.toLowerCase()) {
      return true;
    }
  }

  // Check legacy domain
  if (this.domain && normalizedDomain === this.domain.toLowerCase()) {
    return true;
  }

  return false;
};

/**
 * Generate verification code for custom domain
 */
tenantSchema.methods.generateDomainVerificationCode = function () {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
};

// Static Methods

/**
 * Find tenant by domain (subdomain or custom)
 */
tenantSchema.statics.findByDomain = async function (domain) {
  const normalizedDomain = domain.toLowerCase();

  // Try to find by subdomain full domain
  let tenant = await this.findOne({
    "domains.subdomain.fullDomain": normalizedDomain,
    isActive: true,
  });

  if (tenant) return tenant;

  // Try to find by subdomain name pattern for .localhost (development)
  // e.g., "mystore" from "mystore.localhost"
  const localhostPattern = /^([^.]+)\.localhost(?::\d+)?$/;
  const localhostMatch = normalizedDomain.match(localhostPattern);
  if (localhostMatch) {
    tenant = await this.findOne({
      "domains.subdomain.name": localhostMatch[1],
      isActive: true,
    });
    if (tenant) return tenant;
  }

  // Try to find by subdomain name pattern (e.g., "mystore" from "mystore.matjar.local")
  const domainSuffix = config.platformDomain.replace(/\./g, "\\.");
  const subdomainPattern = new RegExp(`^([^.]+)\\.${domainSuffix}$`);
  const subdomainMatch = normalizedDomain.match(subdomainPattern);
  if (subdomainMatch) {
    tenant = await this.findOne({
      "domains.subdomain.name": subdomainMatch[1],
      isActive: true,
    });
    if (tenant) return tenant;
  }

  // Custom domains: resolve through the Domain registry ONLY. The
  // legacy `customDomain.isVerified` flag only proves TXT ownership
  // and can persist on migrated tenants whose registry row isn't
  // yet ACTIVE. Trusting it here would let login/asset resolution
  // return a tenant whose storefront can't actually serve traffic.
  try {
    const Domain = mongoose.model("Domain");
    const domainRow = await Domain.findOne({
      hostname: normalizedDomain,
      status: "active",
    }).lean();
    if (domainRow) {
      tenant = await this.findOne({
        _id: domainRow.tenantId,
        isActive: true,
      });
      if (tenant) return tenant;
    }
  } catch {
    // Domain model not registered (boot before init, migration
    // scripts) — fall through to legacy lookup rather than crash.
  }

  // Fallback to legacy domain field
  tenant = await this.findOne({
    domain: normalizedDomain,
    isActive: true,
  });

  return tenant;
};

/**
 * Find tenant by slug
 */
tenantSchema.statics.findBySlug = async function (slug) {
  return await this.findOne({ slug: slug.toLowerCase(), isActive: true });
};

/**
 * Check if subdomain is available
 */
tenantSchema.statics.isSubdomainAvailable = async function (subdomain) {
  const count = await this.countDocuments({
    "domains.subdomain.name": subdomain.toLowerCase(),
  });
  return count === 0;
};

/**
 * Check if custom domain is available
 */
tenantSchema.statics.isCustomDomainAvailable = async function (domain) {
  const count = await this.countDocuments({
    "domains.customDomain.name": domain.toLowerCase(),
  });
  return count === 0;
};

// Pre-save middleware
tenantSchema.pre("save", function (next) {
  // Auto-generate full subdomain if not set
  if (this.domains && this.domains.subdomain && this.domains.subdomain.name) {
    if (!this.domains.subdomain.fullDomain) {
      this.domains.subdomain.fullDomain = `${this.domains.subdomain.name}.${config.platformDomain}`;
    }
  }

  // Update legacy domain field for backward compatibility
  if (this.domains) {
    this.domain = this.getActiveDomain();
  }

  this.updatedAt = Date.now();
  next();
});

export default tenantSchema;
