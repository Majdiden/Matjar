import { Router } from "express";
import authRoutes from "../routes/auth.js";
import productRoutes from "../routes/product.js";
import categoryRoutes from "../routes/category.js";
import storefrontCartRoutes from "../routes/storefrontCart.js";
import userRoutes from "../routes/user.js";
import orderRoutes from "../routes/order.js";
import themeRoutes from "../routes/theme.js";
import themeCustomizationRoutes from "../routes/themeCustomization.js";
import domainRoutes from "../routes/domain.js";
import discountRoutes from "../routes/discount.js";
import settingsRoutes from "../routes/settings.js";
import storeSetupRoutes from "../routes/storeSetup.js";
import uploadRoutes from "../routes/upload.js";
import wishlistRoutes from "../routes/wishlist.js";
import analyticsRoutes from "../routes/analytics.js";
import customerRoutes from "../routes/customer.js";
import reviewRoutes from "../routes/review.js";
import inventoryRoutes from "../routes/inventory.js";
import paymentRoutes from "../routes/payment.js";
import paymentMethodsRoutes from "../routes/paymentMethods.js";
import fulfillmentRoutes from "../routes/fulfillment.js";
import auditLogRoutes from "../routes/auditLog.js";
import marketRoutes from "../routes/market.js";
import companyRoutes from "../routes/company.js";
import customFieldRoutes from "../routes/customField.js";
import featureRoutes from "../routes/features.js";
import customerSegmentRoutes from "../routes/customerSegment.js";
import webhookRoutes from "../routes/webhook.js";
import collectionRoutes from "../routes/collection.js";
import menuRoutes from "../routes/menu.js";
import giftCardRoutes from "../routes/giftCard.js";
import staffRoutes from "../routes/staff.js";
import rolesRoutes from "../routes/roles.js";
import notificationRoutes from "../routes/notification.js";
import pageRoutes from "../routes/page.js";
import assetRoutes from "../routes/asset.js";
import redirectRoutes from "../routes/redirect.js";
import impersonationRoutes from "../routes/impersonation.js";
import plansRoutes from "../routes/plans.js";

const router = Router();

// API routes
router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/cart", storefrontCartRoutes); // Storefront cart routes (public/guest)
router.use("/users", userRoutes);
router.use("/orders", orderRoutes);
router.use("/themes", themeRoutes);
router.use("/theme-customization", themeCustomizationRoutes);
router.use("/domains", domainRoutes);
router.use("/store-setup", storeSetupRoutes);
router.use("/upload", uploadRoutes); // Image upload routes
router.use("/wishlist", wishlistRoutes); // Wishlist routes
router.use("/discounts", discountRoutes); // Discount routes
router.use("/store-settings", settingsRoutes); // Store settings routes
router.use("/analytics", analyticsRoutes); // Analytics routes
router.use("/customers", customerRoutes); // Customer management routes
router.use("/reviews", reviewRoutes); // Review management routes
router.use("/inventory", inventoryRoutes); // Inventory management routes
router.use("/payments", paymentRoutes); // Payment routes (Stripe)
router.use("/payment-methods", paymentMethodsRoutes); // Tenant payment method config (CRUD)
router.use("/fulfillments", fulfillmentRoutes); // Fulfillment management routes
router.use("/audit-logs", auditLogRoutes); // Audit log routes
router.use("/markets", marketRoutes); // Market management routes
router.use("/companies", companyRoutes); // B2B company routes
router.use("/custom-fields", customFieldRoutes); // Custom field (metafield) routes
router.use("/customer-segments", customerSegmentRoutes); // Customer segmentation (saved filters)
router.use("/webhooks", webhookRoutes); // Merchant webhook endpoints (CRUD + test)
router.use("/collections", collectionRoutes); // Collection management (manual + smart)
router.use("/menus", menuRoutes); // Navigation menus (header, footer, mobile)
router.use("/gift-cards", giftCardRoutes); // Gift card management + redemption
router.use("/staff", staffRoutes); // Staff/team management + invite flow
router.use("/roles", rolesRoutes); // Custom role catalog + tenant-defined roles
router.use("/notifications", notificationRoutes); // In-app notification center + SSE stream
router.use("/pages", pageRoutes); // CMS-style static content pages (about, contact, privacy…)
router.use("/assets", assetRoutes); // Media library (browse/reuse uploaded assets)
router.use("/redirects", redirectRoutes); // URL redirects (301/302 mapping)
router.use("/features", featureRoutes); // Effective platform feature flags (dashboard read)
router.use("/impersonation", impersonationRoutes); // Owner-side support-impersonation consent
router.use("/plans", plansRoutes); // Public subscription-plan catalog (geo-localized pricing)

export default router;
