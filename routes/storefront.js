import express from "express";
import crypto from "crypto";
import { authenticate, optionalAuth } from "../middlewares/auth.js";
import { requireTenant } from "../middlewares/tenantContext.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  signJWT,
  comparePassword,
  signOrderAccessToken,
  verifyOrderAccessToken,
} from "../utils/misc.js";
import { priceCheckout } from "../services/checkout.js";
import { lookupByCode as lookupGiftCardByCode, redeemGiftCard } from "../services/giftCard.js";
import { checkoutLimiter, storefrontApiLimiter } from "../middlewares/rateLimiters.js";
import config from "../config/index.js";
import { tenantPopulate } from "../utils/scopedModel.js";
import { exportCustomer, anonymizeCustomer } from "../services/customerPrivacy.js";
import { storefrontGetMenu } from "../controllers/menu.js";
import {
  storefrontListCollections,
  storefrontGetCollectionByHandle,
} from "../controllers/collection.js";
import {
  storefrontListPages,
  storefrontGetPageBySlug,
} from "../controllers/page.js";

const router = express.Router();
const productCardSelect =
  "name slug price compareAtPrice images category stock rating reviewCount description hasVariants options variants preorder";

// Optional auth for storefront — customer may be logged in or guest
router.use(optionalAuth);

// All storefront routes require a resolved tenant
router.use(requireTenant);

// Per-tenant rate limit for the public storefront API. Keyed on tenant
// so one tenant's viral moment or scraper bot can't starve every other
// tenant's storefront. Applied BEFORE `checkoutLimiter` on checkout-ish
// sub-routes so both budgets apply independently (gift-card brute force
// still gets the stricter per-IP checkout cap on top of this).
router.use(storefrontApiLimiter);

/**
 * @route   GET /storefront/products
 * @desc    List active products (public storefront API)
 * @access  Public
 */
router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, category, sort, search, minPrice, maxPrice } = req.query;
    const filter = { status: "active" };

    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    switch (sort) {
      case "price_asc": sortOptions.price = 1; break;
      case "price_desc": sortOptions.price = -1; break;
      case "newest": sortOptions.createdAt = -1; break;
      case "popular": sortOptions.salesCount = -1; break;
      default: sortOptions.createdAt = -1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      req.models.Product.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .select(productCardSelect),
      req.models.Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  })
);

/**
 * @route   GET /storefront/products/featured
 * @desc    Get featured products
 * @access  Public
 */
router.get(
  "/products/featured",
  asyncHandler(async (req, res) => {
    const { limit = 8 } = req.query;
    const products = await req.models.Product.find({ status: "active", featured: true })
      .limit(parseInt(limit))
      .select(productCardSelect);

    res.json({ success: true, data: { products } });
  })
);

/**
 * @route   GET /storefront/products/:slug
 * @desc    Get product by slug
 * @access  Public
 */
router.get(
  "/products/:slug",
  asyncHandler(async (req, res) => {
    const product = await req.models.Product.findOne({
      slug: req.params.slug,
      status: "active",
    }).populate("category", "name slug");

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const cardSelect = productCardSelect;

    // Fetch reviews + compute rating distribution
    const reviews = await req.models.Review.find({ product: product._id, isApproved: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("user", "firstName lastName");

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const bucket = Math.max(1, Math.min(5, Math.round(r.rating)));
      ratingDistribution[bucket] += 1;
    }

    // Related products — same category, exclude current
    const relatedProducts = await req.models.Product.find({
      category: product.category?._id,
      _id: { $ne: product._id },
      status: "active",
    })
      .sort({ rating: -1, createdAt: -1 })
      .limit(8)
      .select(cardSelect);

    // Frequently bought with — curated list first, otherwise fall back to
    // top-rated products from the same category that aren't in `relatedProducts`.
    let frequentlyBoughtWith = [];
    if (product.frequentlyBoughtWith && product.frequentlyBoughtWith.length > 0) {
      frequentlyBoughtWith = await req.models.Product.find({
        _id: { $in: product.frequentlyBoughtWith },
        status: "active",
      }).select(cardSelect);
    } else if (product.category?._id) {
      const relatedIds = relatedProducts.slice(0, 4).map((p) => p._id);
      frequentlyBoughtWith = await req.models.Product.find({
        category: product.category._id,
        _id: { $ne: product._id, $nin: relatedIds },
        status: "active",
      })
        .sort({ rating: -1 })
        .limit(3)
        .select(cardSelect);
    }

    res.json({
      success: true,
      data: {
        product,
        reviews,
        ratingDistribution,
        relatedProducts,
        frequentlyBoughtWith,
      },
    });
  })
);

/**
 * @route   GET /storefront/categories
 * @desc    List active categories
 * @access  Public
 */
router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await req.models.Category.find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .select("name slug description image parentCategory");

    res.json({ success: true, data: { categories } });
  })
);

/**
 * @route   GET /storefront/categories/:slug
 * @desc    Get category with products
 * @access  Public
 */
router.get(
  "/categories/:slug",
  asyncHandler(async (req, res) => {
    const category = await req.models.Category.findOne({
      slug: req.params.slug,
      isActive: true,
    });

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const { page = 1, limit = 20, sort } = req.query;
    const sortOptions = {};
    switch (sort) {
      case "price_asc": sortOptions.price = 1; break;
      case "price_desc": sortOptions.price = -1; break;
      case "newest": sortOptions.createdAt = -1; break;
      default: sortOptions.createdAt = -1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      req.models.Product.find({ category: category._id, status: "active" })
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .select(productCardSelect),
      req.models.Product.countDocuments({ category: category._id, status: "active" }),
    ]);

    res.json({
      success: true,
      data: {
        category,
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  })
);

/**
 * @route   GET /storefront/store-info
 * @desc    Get public store information (name, theme, customization)
 * @access  Public
 */
router.get(
  "/store-info",
  asyncHandler(async (req, res) => {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }

    const tc = tenant.themeCustomization || {};
    const activeTheme = tenant.settings?.activeTheme || null;

    // ─── Preview token handling ─────────────────────────────────
    //
    // When the dashboard editor opens the storefront inside its
    // preview iframe, it appends `?preview=<token>`. If that token
    // matches the stored one AND hasn't expired, we return the
    // *draft* snapshot instead of the published one — this is the
    // only place a logged-out request can see unpublished content,
    // and the token is the entire authorization check for that.
    //
    // Comparison is constant-time to prevent timing oracles from
    // revealing partial token matches character-by-character. The
    // token itself is 64 hex chars (32 bytes of CSPRNG entropy),
    // which makes enumeration infeasible even under a timing leak,
    // but defense in depth is cheap here.
    const previewParam =
      typeof req.query.preview === "string" ? req.query.preview : null;
    let servePreview = false;
    if (previewParam && tc.previewToken && tc.previewTokenExpiry) {
      const storedBuf = Buffer.from(tc.previewToken, "utf8");
      const providedBuf = Buffer.from(previewParam, "utf8");
      let constantTimeMatch = false;
      if (storedBuf.length === providedBuf.length) {
        constantTimeMatch = crypto.timingSafeEqual(storedBuf, providedBuf);
      }
      const notExpired = new Date(tc.previewTokenExpiry).getTime() > Date.now();
      servePreview = constantTimeMatch && notExpired;
    }

    // ─── Customization selection ────────────────────────────────
    //
    // Rule: the storefront bundle being served and the customization
    // we return MUST belong to the same theme slug. If the tenant's
    // activeTheme is missing a build artifact, storefrontServe.js
    // falls back to the default theme's bundle — so returning the
    // tenant's (mismatched) published customization would render
    // the fallback React app with sections it doesn't know. We
    // detect that by comparing the snapshot's themeSlug against
    // the tenant's declared activeTheme and, when they diverge,
    // return null (causing the fallback bundle to use its manifest
    // defaults instead of choking on foreign section types).
    let themeCustomization = null;
    if (servePreview) {
      themeCustomization = {
        themeSlug: activeTheme,
        settings: tc.settings || {},
        sections: tc.sections || [],
        customCSS: tc.customCSS || "",
        version: null,
        publishedAt: null,
        preview: true,
      };
    } else if (tc.published?.publishedAt && tc.published.themeSlug === activeTheme) {
      themeCustomization = {
        themeSlug: tc.published.themeSlug,
        settings: tc.published.settings,
        sections: tc.published.sections,
        customCSS: tc.published.customCSS,
        version: tc.published.version,
        publishedAt: tc.published.publishedAt,
      };
    }

    res.json({
      success: true,
      data: {
        store: {
          name: tenant.settings?.storeName || tenant.name,
          description: tenant.settings?.storeDescription || "",
          logo: tenant.settings?.logo || null,
          favicon: tenant.settings?.favicon || null,
          currency: tenant.settings?.currency || "SDG",
          theme: activeTheme,
          themeCustomization,
          socialLinks: tenant.settings?.socialLinks || null,
          contactInfo: tenant.settings?.contactInfo || null,
          giftCards: {
            enabled: tenant.settings?.giftCards?.enabled !== false,
          },
        },
      },
    });
  })
);

/**
 * @route   POST /storefront/auth/register
 * @desc    Customer signup — creates a customer user under the resolved tenant
 * @access  Public (tenant resolved from hostname)
 */
router.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const { name, email, password, firstName, lastName, phone } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Name, email and password are required." });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ success: false, message: "Password must be at least 6 characters." });
    }

    const existing = await req.models.User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "An account with this email already exists." });
    }

    // Mongoose pre-save hook on User schema hashes the password.
    const user = await req.models.User.create({
      name,
      firstName: firstName || name.split(" ")[0],
      lastName: lastName || name.split(" ").slice(1).join(" ") || undefined,
      email: email.toLowerCase(),
      password,
      phone,
      roles: ["customer"],
    });

    const accessToken = signJWT({
      userId: user._id.toString(),
      tenantId: req.tenant._id.toString(),
      roles: user.roles,
      // Pin the token to the current invalidation epoch. The auth
      // middleware compares this against `user.tokenVersion` and rejects
      // any token whose version is below the user's current value, which
      // is how password rotation kills every previously issued JWT.
      // Without this field, every token defaults to version 0 — which
      // means a fresh login *after* a password rotation issues a token
      // that the middleware then immediately rejects (epoch is now ≥1).
      tokenVersion: user.tokenVersion ?? 0,
    });

    res.status(201).json({
      success: true,
      message: "Account created",
      data: {
        accessToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles,
        },
      },
    });
  })
);

/**
 * @route   POST /storefront/auth/login
 * @desc    Customer login (scoped to resolved tenant)
 * @access  Public
 */
router.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required." });
    }

    const user = await req.models.User.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "Account is deactivated." });
    }

    const ok = await comparePassword(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const accessToken = signJWT({
      userId: user._id.toString(),
      tenantId: req.tenant._id.toString(),
      roles: user.roles,
      // See register handler — tokenVersion must be included so the
      // auth middleware can validate against the user's current epoch.
      tokenVersion: user.tokenVersion ?? 0,
    });

    res.json({
      success: true,
      message: "Logged in",
      data: {
        accessToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles,
        },
      },
    });
  })
);

/**
 * @route   GET /storefront/auth/me
 * @desc    Current customer profile
 * @access  Authenticated
 */
router.get(
  "/auth/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await req.models.User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    res.json({ success: true, data: { user } });
  })
);

/**
 * @route   PATCH /storefront/auth/me
 * @desc    Update current customer profile
 * @access  Authenticated
 */
router.patch(
  "/auth/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const allowed = ["name", "firstName", "lastName", "phone", "acceptsMarketing"];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.acceptsMarketing === true) {
      update.marketingConsentAt = new Date();
    }
    const user = await req.models.User.findByIdAndUpdate(
      req.user.userId,
      update,
      { new: true, runValidators: true }
    ).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    res.json({ success: true, data: { user } });
  })
);

/**
 * @route   POST /storefront/auth/me/addresses
 * @desc    Save a new address to the current customer profile
 * @access  Authenticated
 */
router.post(
  "/auth/me/addresses",
  authenticate,
  asyncHandler(async (req, res) => {
    const {
      label, firstName, lastName, phone,
      addressLine1, addressLine2, city, state, postalCode, country,
      isDefault,
    } = req.body || {};

    if (!addressLine1 || !city || !postalCode || !country) {
      return res.status(400).json({
        success: false,
        message: "addressLine1, city, postalCode and country are required.",
      });
    }

    const user = await req.models.User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (isDefault && user.addresses?.length) {
      user.addresses.forEach((a) => { a.isDefault = false; });
    }

    user.addresses = user.addresses || [];
    user.addresses.push({
      label, firstName, lastName, phone,
      addressLine1, addressLine2, city, state, postalCode, country,
      isDefault: !!isDefault,
    });
    await user.save();

    res.status(201).json({ success: true, data: { addresses: user.addresses } });
  })
);

/**
 * @route   PATCH /storefront/auth/me/addresses/:addressId
 * @desc    Update one address on the current customer profile
 * @access  Authenticated
 */
router.patch(
  "/auth/me/addresses/:addressId",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await req.models.User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const address = user.addresses?.id(req.params.addressId);
    if (!address) return res.status(404).json({ success: false, message: "Address not found." });

    const fields = [
      "label", "firstName", "lastName", "phone",
      "addressLine1", "addressLine2", "city", "state", "postalCode", "country",
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) address[f] = req.body[f];
    }
    if (req.body.isDefault === true) {
      // Setting one address default unsets the others — there is only ever
      // one "ship-here-by-default" address per customer.
      user.addresses.forEach((a) => { a.isDefault = String(a._id) === String(address._id); });
    }
    await user.save();
    res.json({ success: true, data: { addresses: user.addresses } });
  })
);

/**
 * @route   DELETE /storefront/auth/me/addresses/:addressId
 * @desc    Remove an address from the current customer profile
 * @access  Authenticated
 */
router.delete(
  "/auth/me/addresses/:addressId",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await req.models.User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const address = user.addresses?.id(req.params.addressId);
    if (!address) return res.status(404).json({ success: false, message: "Address not found." });

    const wasDefault = address.isDefault;
    address.deleteOne();

    // If we removed the default address, promote whichever is left so the
    // checkout flow always has a default to pre-fill.
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    await user.save();
    res.json({ success: true, data: { addresses: user.addresses } });
  })
);

/**
 * @route   POST /storefront/auth/me/password
 * @desc    Change the current customer's password (requires current pwd)
 * @access  Authenticated
 */
router.post(
  "/auth/me/password",
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new passwords are required.",
      });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }
    const user = await req.models.User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const ok = await comparePassword(currentPassword, user.password);
    if (!ok) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }
    user.password = newPassword; // pre-save hook hashes
    // Bump the token-version epoch so every JWT issued before this change
    // is rejected by the auth middleware on next use. Without this, a
    // stolen access token would remain valid until its natural expiry
    // even after the customer rotated their password.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    res.json({ success: true, message: "Password updated." });
  })
);

/**
 * @route   DELETE /storefront/auth/me
 * @desc    Soft-delete the current customer (deactivate). Hard delete is
 *          intentionally not exposed — order history must be preserved.
 * @access  Authenticated
 */
router.delete(
  "/auth/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await req.models.User.findByIdAndUpdate(
      req.user.userId,
      { isActive: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.json({ success: true, message: "Account deactivated." });
  })
);

/**
 * @route   GET /storefront/auth/me/export
 * @desc    GDPR Article 15 — right to access. Returns a full JSON dump
 *          of everything we store about the authenticated customer.
 * @access  Authenticated
 */
router.get(
  "/auth/me/export",
  authenticate,
  asyncHandler(async (req, res) => {
    const data = await exportCustomer(req.models, req.user.userId);
    res.setHeader("Content-Disposition", `attachment; filename="my-data-${Date.now()}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(data, null, 2));
  })
);

/**
 * @route   POST /storefront/auth/me/anonymize
 * @desc    GDPR Article 17 — right to erasure. Replaces PII on the user
 *          row and denormalized copies on orders with deterministic
 *          placeholders. Order records themselves are kept for tax
 *          compliance. Bumps tokenVersion so existing sessions die.
 * @access  Authenticated (requires re-auth via password confirmation)
 */
router.post(
  "/auth/me/anonymize",
  authenticate,
  asyncHandler(async (req, res) => {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ success: false, message: "Password confirmation required." });
    }
    const user = await req.models.User.findById(req.user.userId).select("+password");
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }
    const ok = await comparePassword(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials." });

    const result = await anonymizeCustomer(req.models, req.user.userId);
    res.json({ success: true, data: result });
  })
);

/**
 * @route   POST /storefront/checkout/quote
 * @desc    Live priced checkout quote (subtotal, shipping, tax, discount, total)
 *          using the current cart and an optional shipping address + discount.
 * @access  Public (auth-aware)
 */
router.post(
  "/checkout/quote",
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    // Guest checkout uses the cart session cookie minted by the storefront
    // cart routes (req.session.cartSessionId). No token required — the
    // checkout page must quote prices for anonymous shoppers exactly the
    // same way it does for logged-in customers.
    const sessionId = req.session?.cartSessionId;
    const cartFilter = userId
      ? { user: userId }
      : sessionId
      ? { sessionId }
      : null;
    if (!cartFilter) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    const cart = await req.models.Cart.findOne(cartFilter).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    // Cart line items only carry a `variantId` (string snapshot of the
    // variant subdocument _id). priceCheckout expects the resolved variant
    // subdoc so it can apply variant-level price/sku overrides — without
    // this lookup the quote always fell back to the parent product price
    // and a variant on sale would be silently full-priced at checkout.
    const lines = cart.items.map((item) => {
      const product = item.product;
      let variant = null;
      if (item.variantId && product?.variants?.length) {
        variant = product.variants.find(
          (v) => v && v._id && v._id.toString() === String(item.variantId)
        ) || null;
      }
      return {
        product,
        quantity: item.quantity,
        variant,
        isPreorder: !!item.isPreorder,
        preorderExpectedShipDate: item.preorderExpectedShipDate || null,
      };
    });

    const { shippingAddress, discountCode, discountCodes } = req.body || {};

    const quote = await priceCheckout({
      lines,
      shippingAddress,
      discountCode,
      discountCodes,
      models: req.models,
      tenantId: req.tenant._id,
      userId,
    });

    res.json({ success: true, data: { quote } });
  })
);

/**
 * @route   POST /storefront/orders
 * @desc    Guest-friendly order placement. Mirrors POST /api/orders but
 *          uses optionalAuth (no "No token provided" for guests) and
 *          resolves the cart via the guest cart session cookie when there
 *          is no authenticated user. The authenticated-customer code path
 *          is unchanged — this is purely an additive route so the
 *          storefront checkout page works for both audiences.
 * @access  Public (auth-aware)
 */
router.post(
  "/orders",
  asyncHandler(async (req, res) => {
    const { createOrderService } = await import("../services/order.js");
    const userId = req.user?.userId || null;
    const sessionId = req.session?.cartSessionId || null;

    // Guests must identify themselves by email so we can send the
    // confirmation + tracking token. Logged-in customers fall back to
    // their account email downstream.
    if (!userId && !req.body?.customerEmail) {
      return res.status(400).json({
        success: false,
        message: "An email address is required to place a guest order.",
      });
    }
    if (!userId && !sessionId) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    const result = await createOrderService(
      req.models,
      userId,
      { ...req.body, sessionId },
      req.tenant._id
    );

    if (result.success) {
      const order = result.responseObject?.order || result.responseObject;
      if (order && order._id) {
        const email =
          order.guestCustomer?.email ||
          order.user?.email ||
          req.body?.customerEmail ||
          "";
        result.responseObject = result.responseObject || {};
        result.responseObject.trackingToken = signOrderAccessToken({
          tenantId: req.tenant._id,
          orderId: order._id,
          email,
        });
      }
    }
    res.status(result.statusCode).json(result);
  })
);

/**
 * @route   GET /storefront/orders/:id
 * @desc    Public order lookup for the customer-facing tracking page.
 *          Logged-in customers can view any of their own orders. Guests
 *          can present the order email; newer confirmation links also
 *          include a signed per-order access token (`?token=<hmac>`).
 *          If a token is supplied it must be valid, but exact email +
 *          order id remains supported so older/plain tracking links work.
 * @access  Public (owner cookie/JWT OR matching guest email/token)
 */
router.get(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { email, token } = req.query;
    const userId = req.user?.userId;

    let order;
    try {
      order = await req.models.Order.findOne({ _id: id })
        .populate("products.product", "name slug images price sku")
        .populate("user", "email firstName lastName");
    } catch (err) {
      // Cast errors on a malformed id
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Authorization:
    //   • Owner: signed-in customer whose user id matches the order.
    //   • Guest: exact checkout email PLUS a valid signed per-order access
    //     token. Email alone is no longer sufficient — guessing an order
    //     id + email pair is too weak a gate, so we require the HMAC
    //     token that checkout emits in the confirmation link.
    const ownerId = order.user?._id?.toString();
    const isOwner = userId && ownerId && ownerId === userId;
    const guestEmail = (order.guestCustomer?.email || order.user?.email || "").toLowerCase().trim();
    const requestedEmail = String(email || "").toLowerCase().trim();
    const emailMatches =
      requestedEmail && guestEmail && guestEmail === requestedEmail;
    const hasToken = typeof token === "string" && token.trim().length > 0;
    const tokenValid =
      emailMatches &&
      hasToken &&
      verifyOrderAccessToken({
        tenantId: req.tenantId,
        orderId: order._id,
        email: guestEmail,
        token: String(token),
      });
    const isGuestAuthorized = emailMatches && hasToken && tokenValid;

    if (!isOwner && !isGuestAuthorized) {
      // Don't leak whether the order exists — same shape as a 404.
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Strip fields the storefront should never see (internal notes,
    // by-user references, etc.) — keep status, history events, line
    // snapshots, addresses, totals, tracking.
    const safeHistory = (order.history || []).map((h) => ({
      event: h.event,
      status: h.status,
      previousStatus: h.previousStatus,
      note: h.note,
      at: h.at,
    }));

    // Expose shipments without leaking staff-only fields (internal notes,
    // by/byName references). The storefront tracking page renders one row
    // per shipment with its status, items, and tracking info.
    const safeFulfillments = (order.fulfillments || []).map((f) => ({
      _id: f._id,
      status: f.status,
      items: (f.items || []).map((it) => ({
        orderLineId: it.orderLineId,
        quantity: it.quantity,
      })),
      trackingNumber: f.trackingNumber,
      trackingCarrier: f.trackingCarrier,
      shippedAt: f.shippedAt,
      deliveredAt: f.deliveredAt,
      cancelledAt: f.cancelledAt,
      createdAt: f.createdAt,
    }));

    res.json({
      success: true,
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          products: order.products,
          subtotal: order.subtotal,
          shippingCost: order.shippingCost,
          tax: order.tax,
          discount: order.discount,
          totalAmount: order.totalAmount,
          shippingAddress: order.shippingAddress,
          trackingNumber: order.trackingNumber,
          trackingCarrier: order.trackingCarrier,
          fulfillments: safeFulfillments,
          history: safeHistory,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        },
      },
    });
  })
);

/**
 * @route   POST /storefront/contact
 * @desc    Public contact-form submission. Logged-in customers attach their
 *          user record automatically; guests must supply name + email.
 *          Stored as a SupportTicket so merchants can triage in the dashboard.
 * @access  Public
 */
router.post(
  "/contact",
  asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body || {};

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: "Subject and message are required" });
    }
    if (String(message).trim().length < 10) {
      return res.status(400).json({ success: false, message: "Message must be at least 10 characters" });
    }

    const payload = {
      subject: String(subject).trim().slice(0, 200),
      message: String(message).trim().slice(0, 5000),
      priority: "medium",
      source: "contact_form",
    };

    // auth middleware exposes the signed-in user as req.user.userId — there is
    // no _id on the JWT payload, so the old `req.user?._id` check always
    // fell through to the guest branch even for authenticated customers.
    if (req.user?.userId) {
      payload.user = req.user.userId;
    } else {
      if (!email || !/^\S+@\S+\.\S+$/.test(String(email))) {
        return res.status(400).json({ success: false, message: "A valid email is required" });
      }
      payload.guestEmail = String(email).trim().toLowerCase();
      payload.guestName = name ? String(name).trim().slice(0, 100) : undefined;
    }

    const ticket = await req.models.SupportTicket.create(payload);

    res.status(201).json({
      success: true,
      message: "Thanks — your message has been received. We'll get back to you shortly.",
      data: { ticketId: ticket._id },
    });
  })
);

/**
 * @route   POST /storefront/reviews
 * @desc    Submit a product review (authenticated customers only).
 *          Sets `isVerifiedPurchase` automatically when the customer has at
 *          least one Delivered order containing the product. Enforces the
 *          one-review-per-user-per-product rule via the unique compound
 *          index — duplicates are surfaced as a clean 409.
 * @access  Authenticated customer
 */
router.post(
  "/reviews",
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "You must be signed in to leave a review" });
    }

    const { productId, rating, title, comment } = req.body || {};

    if (!productId) {
      return res.status(400).json({ success: false, message: "productId is required" });
    }
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be a number between 1 and 5" });
    }
    if (!comment || String(comment).trim().length < 5) {
      return res
        .status(400)
        .json({ success: false, message: "Please write at least a few words about the product" });
    }

    // Make sure the product actually exists in this tenant before creating
    // a dangling review.
    const product = await req.models.Product.findById(productId).select("_id");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Verified-purchase check: any non-cancelled order by this user that
    // contains the product AND has been paid for earns the badge. We do
    // NOT require status="Delivered" — orders sit in "Shipped" or
    // "Processing" for arbitrary periods (especially with COD or partial
    // fulfillments) and the buyer is still a real customer with hands on
    // the product. Cash-on-delivery orders that are marked Delivered
    // without ever being marked Paid are also covered via the status leg.
    const purchasedOrder = await req.models.Order.findOne({
      user: userId,
      "products.product": product._id,
      status: { $nin: ["Cancelled", "Refunded"] },
      $or: [
        { paymentStatus: { $in: ["Paid", "Partially Refunded"] } },
        { status: "Delivered" },
      ],
    }).select("_id");

    try {
      const review = await req.models.Review.create({
        user: userId,
        product: product._id,
        rating: Math.round(ratingNum),
        title: title ? String(title).trim().slice(0, 200) : undefined,
        comment: String(comment).trim().slice(0, 5000),
        isVerifiedPurchase: !!purchasedOrder,
      });

      // Roll up rating + count on the product so listing pages stay accurate
      // without needing to re-aggregate on every read.
      const agg = await req.models.Review.aggregate([
        { $match: { product: product._id, isApproved: true } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
      ]);
      if (agg.length > 0) {
        await req.models.Product.findByIdAndUpdate(product._id, {
          rating: Math.round((agg[0].avg || 0) * 10) / 10,
          reviewCount: agg[0].count || 0,
        });
      }

      // Populate user.name for immediate display in the UI.
      await review.populate(tenantPopulate("user", review.tenantId, "name"));

      return res.status(201).json({
        success: true,
        message: "Thanks for your review!",
        data: { review },
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: "You've already reviewed this product" });
      }
      throw err;
    }
  })
);

/**
 * @route   GET /storefront/reviews/mine
 * @desc    List the signed-in customer's own reviews. Powers the Reviews
 *          tab on the customer account page so the customer can see
 *          everything they've published (whether approved or pending).
 * @access  Authenticated customer
 */
router.get(
  "/reviews/mine",
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "You must be signed in" });
    }

    const reviews = await req.models.Review.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("product", "name slug images price")
      .lean();

    res.json({ success: true, data: { reviews } });
  })
);

/**
 * @route   GET /storefront/menus/:handle
 * @desc    Get a menu by handle (public) — returns fully resolved item tree
 * @access  Public
 */
router.get("/menus/:handle", storefrontGetMenu);

/**
 * @route   GET /storefront/collections
 * @desc    List all published collections
 * @access  Public
 */
router.get("/collections", storefrontListCollections);

/**
 * @route   GET /storefront/collections/:handle
 * @desc    Get a collection by handle with its resolved products (paginated)
 * @access  Public
 */
router.get("/collections/:handle", storefrontGetCollectionByHandle);

/**
 * @route   GET /storefront/pages
 * @desc    List all published content pages (minimal fields — title, slug, locale).
 *          Used by footer/sitemap renderers that need to enumerate every
 *          published page without pulling down the full HTML bodies.
 * @access  Public
 */
router.get("/pages", storefrontListPages);

/**
 * @route   GET /storefront/pages/:slug
 * @desc    Fetch a single published page by slug. Unpublished pages are
 *          indistinguishable from nonexistent ones (404).
 * @access  Public
 */
router.get("/pages/:slug", storefrontGetPageBySlug);

// ─── Gift cards ──────────────────────────────────────────────────
// Public lookup + redeem for storefront checkout. `checkoutLimiter`
// keeps this surface safe from brute-force code guessing.

/**
 * Sanitize a gift card for storefront consumption — never expose the
 * codeHash or internal transaction log on the public surface.
 */
function publicGiftCard(card) {
  if (!card) return null;
  return {
    _id: card._id,
    balance: card.balance,
    currency: card.currency,
    codeLast4: card.codeLast4,
    status: card.status,
    coverShipping: !!card.coverShipping,
    coverTax: !!card.coverTax,
    expiresAt: card.expiresAt || null,
  };
}

/**
 * @route   GET /storefront/me/giftcards
 * @desc    List gift cards owned by the authenticated customer. Returns
 *          sanitized cards (never the full code, only last-4).
 * @access  Authenticated
 */
router.get(
  "/me/giftcards",
  authenticate,
  asyncHandler(async (req, res) => {
    // Match by explicit customerId OR by issuedTo.email (case-insensitive)
    // so cards issued to the user's email before they registered still
    // appear in their checkout chip list.
    const User = req.models.User;
    const me = await User.findById(req.user.userId).select("email").lean();
    const or = [{ customerId: req.user.userId }];
    if (me?.email) {
      or.push({ "issuedTo.email": new RegExp(`^${me.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    }
    const cards = await req.models.GiftCard.find({
      $or: or,
      status: "active",
      balance: { $gt: 0 },
    })
      .select("codeLast4 balance initialAmount currency status expiresAt createdAt coverShipping coverTax")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: { cards: cards.map(publicGiftCard) } });
  })
);

/**
 * @route   POST /storefront/giftcards/lookup
 * @desc    Validate a gift card code and return its balance.
 * @access  Public
 */
router.post(
  "/giftcards/lookup",
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const { code } = req.body || {};
    const card = await lookupGiftCardByCode(req.models, code);
    res.json({ success: true, data: publicGiftCard(card) });
  })
);

/**
 * @route   POST /storefront/giftcards/redeem
 * @desc    Redeem a gift card against an order. Atomic on the service
 *          layer so double-spend windows are impossible.
 * @access  Public
 */
router.post(
  "/giftcards/redeem",
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const { code, amount, orderId } = req.body || {};
    const card = await redeemGiftCard(req.models, code, amount, {
      orderId,
      by: req.user?.userId || null,
    });
    res.json({ success: true, data: publicGiftCard(card) });
  })
);

/**
 * @route   GET /storefront/payment-methods
 * @desc    List enabled payment methods for the current tenant. Secrets
 *          (`config`) are excluded — this endpoint is public.
 * @access  Public
 */
router.get(
  "/payment-methods",
  asyncHandler(async (req, res) => {
    const methods = await req.models.PaymentMethod.find({ enabled: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    // Defense-in-depth: even if a legacy tenant has a `type: "gateway"`
    // method flipped on (e.g. a stale Stripe row from an older seed),
    // don't surface it to the storefront when the corresponding gateway
    // is parked at the platform level. Keeps soft-launch stores from
    // offering a checkout option that will 404 on create-intent.
    const stripeEnabled = config.stripeEnabled;
    const gatewayAllowed = (code) => {
      if (code === "stripe") return stripeEnabled;
      // Unknown gateway codes stay hidden — there's no catalog entry
      // that would have minted them post-soft-launch.
      return false;
    };
    const sanitized = (methods || [])
      .filter((m) => m.type !== "gateway" || gatewayAllowed(m.code))
      .map((m) => {
        // For manual methods, only expose enabled sub-providers — and
        // only providers that actually have account details filled.
        const providers =
          m.type === "manual"
            ? (m.providers || [])
                .filter((p) => p.enabled && (p.accountNumber || p.phone))
                .map((p) => ({
                  code: p.code,
                  label: p.label,
                  logo: p.logo || "",
                  accountNumber: p.accountNumber || "",
                  beneficiaryName: p.beneficiaryName || "",
                  phone: p.phone || "",
                  instructions: p.instructions || "",
                }))
            : [];
        return {
          code: m.code,
          type: m.type,
          label: m.label,
          description: m.description || "",
          providerLogos: m.providerLogos || [],
          icon: m.icon || (m.providerLogos && m.providerLogos[0]) || "",
          instructions: m.instructions || "",
          customerFields: m.customerFields || [],
          providers,
          order: m.order || 0,
        };
      })
      // Hide a manual method entirely when the merchant hasn't yet
      // configured any usable provider — avoids a dead checkout option.
      .filter((m) => m.type !== "manual" || m.providers.length > 0);
    res.json({ success: true, data: { methods: sanitized } });
  })
);

export default router;
