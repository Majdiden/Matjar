import tenantSchema from "../schemas/tenant.js";
import tenantUserSchema from "../schemas/tenantUser.js";
import subscriptionSchema from "../schemas/subscription.js";
import subscriptionPlanSchema from "../schemas/subscriptionPlan.js";
import domainSchema from "../schemas/domain.js";
import tenantExportSchema from "../schemas/tenantExport.js";
// Phase A platform operating-system models (admin DB)
import platformAuditLogSchema from "../schemas/platformAuditLog.js";
import platformInviteSchema from "../schemas/platformInvite.js";
import platformSessionSchema from "../schemas/platformSession.js";
import { ensureConsumedMfaTokenIndex } from "../services/platform/mfa.js";
import commissionPolicySchema from "../schemas/commissionPolicy.js";
import pricingOverrideSchema from "../schemas/pricingOverride.js";
import platformFeeEventSchema from "../schemas/platformFeeEvent.js";
import billingStatementSchema from "../schemas/billingStatement.js";
import planChangeSchema from "../schemas/planChange.js";
import incidentSchema from "../schemas/incident.js";
import platformPaymentMethodSchema from "../schemas/platformPaymentMethod.js";
import storefrontHealthSchema from "../schemas/storefrontHealth.js";
import platformFeedbackSchema from "../schemas/platformFeedback.js";
import webhookDeliverySchema from "../schemas/store/webhookDelivery.js";
// Phase B (access programs, feature overrides, usage snapshots)
import accessProgramSchema from "../schemas/accessProgram.js";
import featureOverrideSchema from "../schemas/featureOverride.js";
import tenantUsageSnapshotSchema from "../schemas/tenantUsageSnapshot.js";
import themeSchema from "../schemas/store/theme.js";
import userSchema from "../schemas/store/user.js";
import productSchema from "../schemas/store/product.js";
import categorySchema from "../schemas/store/category.js";
import orderSchema from "../schemas/store/order.js";
import cartSchema from "../schemas/store/cart.js";
import promotionSchema from "../schemas/store/promotion.js";
import taxSchema from "../schemas/store/tax.js";
import shippingSchema from "../schemas/store/shipping.js";
import discountSchema from "../schemas/discount.js";
import paymentSchema from "../schemas/store/payment.js";
import reviewSchema from "../schemas/store/review.js";
import wishlistSchema from "../schemas/store/wishlist.js";
import supportTicketSchema from "../schemas/store/supportTicket.js";
import currencySchema from "../schemas/store/currency.js";
import productI18nSchema from "../schemas/store/productI18n.js";
import analyticsSchema from "../schemas/store/analytics.js";
import webhookSchema from "../schemas/store/webhook.js";
import refreshTokenSchema from "../schemas/store/refreshToken.js";
import auditLogSchema from "../schemas/store/auditLog.js";
import marketSchema from "../schemas/store/market.js";
import companySchema from "../schemas/store/company.js";
import customFieldSchema from "../schemas/store/customField.js";
import assetSchema from "../schemas/store/asset.js";
import customerSegmentSchema from "../schemas/store/customerSegment.js";
import themeCustomizationVersionSchema from "../schemas/store/themeCustomizationVersion.js";
import collectionSchema from "../schemas/store/collection.js";
import menuSchema from "../schemas/store/menu.js";
import giftCardSchema from "../schemas/store/giftCard.js";
import staffInviteSchema from "../schemas/store/staffInvite.js";
import paymentMethodSchema from "../schemas/store/paymentMethod.js";
import roleSchema from "../schemas/store/role.js";
import idempotencyRecordSchema from "../schemas/store/idempotencyRecord.js";
import notificationSchema from "../schemas/store/notification.js";
import pageSchema from "../schemas/store/page.js";
import redirectSchema from "../schemas/store/redirect.js";
import webauthnCredentialSchema from "../schemas/store/webauthnCredential.js";
import pushSubscriptionSchema from "../schemas/store/pushSubscription.js";
import impersonationGrantSchema from "../schemas/store/impersonationGrant.js";

/**
 * Register all models on a single shared connection.
 * Admin models (no tenantId) and tenant-scoped models coexist in the same DB.
 */
export function registerAllModels(connection) {
  // Admin models
  connection.model("Tenant", tenantSchema);
  connection.model("TenantUser", tenantUserSchema);
  connection.model("Subscription", subscriptionSchema);
  connection.model("SubscriptionPlan", subscriptionPlanSchema);
  connection.model("Theme", themeSchema);
  connection.model("Domain", domainSchema);
  connection.model("TenantExport", tenantExportSchema);
  connection.model("PlatformAuditLog", platformAuditLogSchema);
  connection.model("PlatformInvite", platformInviteSchema);
  connection.model("PlatformSession", platformSessionSchema);
  // TTL index for single-use MFA step tokens (idempotent, best-effort).
  if (connection.db) ensureConsumedMfaTokenIndex().catch((err) => console.warn("consumed-mfa-token index:", err?.message));
  connection.model("CommissionPolicy", commissionPolicySchema);
  connection.model("PricingOverride", pricingOverrideSchema);
  connection.model("PlatformFeeEvent", platformFeeEventSchema);
  connection.model("BillingStatement", billingStatementSchema);
  connection.model("PlanChange", planChangeSchema);
  connection.model("Incident", incidentSchema);
  connection.model("PlatformPaymentMethod", platformPaymentMethodSchema);
  connection.model("StorefrontHealth", storefrontHealthSchema);
  connection.model("PlatformFeedback", platformFeedbackSchema);
  connection.model("AccessProgram", accessProgramSchema);
  connection.model("FeatureOverride", featureOverrideSchema);
  connection.model("TenantUsageSnapshot", tenantUsageSnapshotSchema);

  // Tenant-scoped models
  connection.model("User", userSchema);
  connection.model("Product", productSchema);
  connection.model("Category", categorySchema);
  connection.model("Order", orderSchema);
  connection.model("Cart", cartSchema);
  connection.model("Promotion", promotionSchema);
  connection.model("Tax", taxSchema);
  connection.model("Shipping", shippingSchema);
  connection.model("Discount", discountSchema);
  connection.model("Payment", paymentSchema);
  connection.model("Review", reviewSchema);
  connection.model("Wishlist", wishlistSchema);
  connection.model("SupportTicket", supportTicketSchema);
  connection.model("Currency", currencySchema);
  connection.model("ProductI18n", productI18nSchema);
  connection.model("Analytics", analyticsSchema);
  connection.model("Webhook", webhookSchema);
  connection.model("WebhookDelivery", webhookDeliverySchema);
  connection.model("RefreshToken", refreshTokenSchema);
  connection.model("AuditLog", auditLogSchema);
  connection.model("Market", marketSchema);
  connection.model("Company", companySchema);
  connection.model("CustomField", customFieldSchema);
  connection.model("Asset", assetSchema);
  connection.model("CustomerSegment", customerSegmentSchema);
  connection.model("ThemeCustomizationVersion", themeCustomizationVersionSchema);
  connection.model("Collection", collectionSchema);
  connection.model("Menu", menuSchema);
  connection.model("GiftCard", giftCardSchema);
  connection.model("StaffInvite", staffInviteSchema);
  connection.model("PaymentMethod", paymentMethodSchema);
  connection.model("Role", roleSchema);
  connection.model("IdempotencyRecord", idempotencyRecordSchema);
  connection.model("Notification", notificationSchema);
  connection.model("Page", pageSchema);
  connection.model("Redirect", redirectSchema);
  connection.model("WebauthnCredential", webauthnCredentialSchema);
  connection.model("PushSubscription", pushSubscriptionSchema);
  connection.model("ImpersonationGrant", impersonationGrantSchema);
}
