/**
 * Platform-admin routes — cross-tenant support/ops surface.
 *
 * Mounted at /api/platform in server/route.config.js. These routes
 * deliberately bypass the per-host tenant resolver because platform
 * admins operate across tenants.
 *
 * Authorization: each mutating route is gated by a scope from
 * PLATFORM_SCOPES. Read-only tenant inspection needs support.read.
 * The requireScope middleware has a legacy fallback that treats a user
 * with `platformAdmin:true` and an empty scopes array as fully
 * permissioned, so pre-migration admins keep working.
 */

import { Router } from "express";
import {
  platformAuthenticate,
  requireScope,
  validateObjectId,
  requireRole,
  requireRecentReauth,
  PLATFORM_SCOPES,
} from "../middlewares/platformAdmin.js";
import {
  listTenants,
  getTenant,
  retryTenantSetup,
  suspend,
  unsuspend,
  scheduleDeletion,
  cancelDeletion,
  purge,
  exportData,
  requestAsyncExport,
  getExportStatus,
  downloadExport,
  listTenantOrders,
  getTenantOrder,
  listTenantPayments,
  listFailedJobs,
  retryFailedJob,
  listFailedWebhooks,
  getTenantStats,
  getTenantsStats,
  getQueuesStats,
  seedTenantStarterContent,
  getPhoneCountries,
  updatePhoneCountries,
} from "../controllers/platformAdmin.js";
import { platformLogin, platformMe } from "../controllers/platform/auth.js";
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  changeTenantPlan,
} from "../controllers/platform/plans.js";
// Phase A sub-routers — each owned by one workstream (see docs/plans/platform-admin-operating-system.md)
import platformAuthRoutes from "./platform/auth.js";
import platformAuthPrivateRoutes from "./platform/authPrivate.js";
import securityRoutes from "./platform/security.js";
import auditRoutes from "./platform/audit.js";
import platformUserRoutes from "./platform/users.js";
import tenantUserRoutes from "./platform/tenantUsers.js";
import billingRoutes from "./platform/billing.js";
import overviewRoutes from "./platform/overview.js";
// Phase C sub-routers
import incidentRoutes from "./platform/incidents.js";
import privacyRoutes from "./platform/privacy.js";
import bulkRoutes from "./platform/bulk.js";
// Phase B sub-routers
import systemRoutes from "./platform/health.js";
import webhookInspectorRoutes from "./platform/webhooks.js";
import feedbackRoutes from "./platform/feedback.js";
// Phase B (B1): access programs, per-tenant config/feature-overrides/usage, usage refresh
import programRoutes from "./platform/programs.js";
import tenantConfigRoutes from "./platform/config.js";
import usageRoutes from "./platform/usage.js";
// Phase B (B2): cross-store commerce search + storefront domains/themes/health
import commerceRoutes from "./platform/commerce.js";
import storefrontRoutes from "./platform/storefront.js";
import analyticsRoutes from "./platform/analytics.js";
import settingsRoutes from "./platform/settings.js";
import {
  requestController as impersonationRequest,
  pollController as impersonationPoll,
  approveByCodeController as impersonationApproveByCode,
  enterController as impersonationEnter,
  exitController as impersonationExit,
} from "../controllers/impersonation.js";
import {
  getPlatformFeatures,
  updatePlatformFeatures,
} from "../controllers/featureFlags.js";

const router = Router();

// Public: platform admin login
router.post("/login", platformLogin);
// Public platform auth extras (invite accept, password reset) — routes/platform/auth.js
router.use("/auth", platformAuthRoutes);

// Everything below requires a platform-admin token.
router.use(platformAuthenticate);

// Session info (no scope required beyond being authenticated).
router.get("/me", platformMe);

// --- Phase A domain routers (all behind platformAuthenticate; each route
// declares its own requireScope) ---
router.use("/auth", platformAuthPrivateRoutes); // authenticated: MFA enrolment, re-auth
router.use("/security", securityRoutes);
router.use("/audit", auditRoutes);
router.use("/users", platformUserRoutes);
router.use("/tenants/:tenantId/users", tenantUserRoutes);
router.use("/billing", billingRoutes);
router.use("/overview", overviewRoutes);
router.use("/incidents", incidentRoutes);
router.use("/tenants/:tenantId/privacy", privacyRoutes);
router.use("/bulk", bulkRoutes);
router.use("/system", systemRoutes);
// Global configuration registry (Phase C) — see config/platformSettingsRegistry.js
router.use("/settings", settingsRoutes);
router.use("/webhooks", webhookInspectorRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/programs", programRoutes);
// NOTE: this parametric mount sits BEFORE the literal "/tenants-stats" and
// "/tenants/:tenantId/..." routes below. Express matches "/tenants/:tenantId"
// against any single segment, so every path under it must be declared in
// routes/platform/config.js (config, feature-overrides, usage, limit-overrides)
// — a new literal sub-path added elsewhere would be shadowed by this router
// only if it collides with one of those names; the router 404s nothing else
// (unmatched requests fall through to the routes below).
router.use("/tenants/:tenantId", tenantConfigRoutes);
router.use("/usage", usageRoutes);
router.use("/commerce", commerceRoutes);
router.use("/storefront", storefrontRoutes);
router.use("/analytics", analyticsRoutes); // Phase C: platform analytics (read-only aggregates)

// --- Platform feature flags ---
router.get("/features", requireScope(PLATFORM_SCOPES.SUPPORT_READ), getPlatformFeatures);
router.put("/features", requireScope(PLATFORM_SCOPES.FLAGS_WRITE), updatePlatformFeatures);

// --- Phone countries offered on merchant signup / profile forms ---
router.get("/phone-countries", requireScope(PLATFORM_SCOPES.SUPPORT_READ), getPhoneCountries);
router.put("/phone-countries", requireScope(PLATFORM_SCOPES.FLAGS_WRITE), updatePhoneCountries);

// --- Tenant inspection (support.read) ---
router.get("/tenants", requireScope(PLATFORM_SCOPES.SUPPORT_READ), listTenants);
router.get(
  "/tenants-stats",
  requireScope(PLATFORM_SCOPES.SUPPORT_READ),
  getTenantsStats
);
router.get(
  "/tenants/:tenantId/stats",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_READ),
  getTenantStats
);
router.get(
  "/tenants/:tenantId",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_READ),
  getTenant
);
router.get(
  "/tenants/:tenantId/orders",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_READ),
  listTenantOrders
);
router.get(
  "/tenants/:tenantId/orders/:orderId",
  validateObjectId("tenantId", "orderId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_READ),
  getTenantOrder
);
router.get(
  "/tenants/:tenantId/payments",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.BILLING_READ),
  listTenantPayments
);
router.get(
  "/tenants/:tenantId/failed-webhooks",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_READ),
  listFailedWebhooks
);

// --- Subscription plan catalog (read: billing.read; write: tenant.lifecycle) ---
router.get("/plans", requireScope(PLATFORM_SCOPES.BILLING_READ), listPlans);
router.post("/plans", requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE), createPlan);
router.patch(
  "/plans/:id",
  validateObjectId("id"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  updatePlan
);
router.delete(
  "/plans/:id",
  validateObjectId("id"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  deletePlan
);

// Change a tenant's current plan (tenant.lifecycle)
router.patch(
  "/tenants/:tenantId/plan",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  changeTenantPlan
);

// --- Tenant lifecycle (tenant.lifecycle) ---
router.post(
  "/tenants/:tenantId/retry-setup",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  retryTenantSetup
);
// On-demand starter (demo) content seed for one store — see controller.
router.post(
  "/tenants/:tenantId/seed-starter-content",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  seedTenantStarterContent
);
router.post(
  "/tenants/:tenantId/suspend",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  suspend
);
router.post(
  "/tenants/:tenantId/unsuspend",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  unsuspend
);
router.post(
  "/tenants/:tenantId/schedule-deletion",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  scheduleDeletion
);
router.post(
  "/tenants/:tenantId/cancel-deletion",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  cancelDeletion
);
// Purge is owner-only on top of the lifecycle scope: it is the one
// irreversible tenant action and ADMIN otherwise holds every scope.
router.post(
  "/tenants/:tenantId/purge",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  requireRole("owner"),
  // Irreversible: the owner must have re-authenticated within the last 5 min.
  requireRecentReauth,
  purge
);

// --- Data export (tenant.export) ---
router.get(
  "/tenants/:tenantId/export",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_EXPORT),
  exportData
);
router.post(
  "/tenants/:tenantId/exports",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_EXPORT),
  requestAsyncExport
);
router.get(
  "/tenants/:tenantId/exports/:exportId",
  validateObjectId("tenantId", "exportId"),
  requireScope(PLATFORM_SCOPES.TENANT_EXPORT),
  getExportStatus
);
router.get(
  "/tenants/:tenantId/exports/:exportId/download",
  validateObjectId("tenantId", "exportId"),
  requireScope(PLATFORM_SCOPES.TENANT_EXPORT),
  downloadExport
);

// --- Impersonation (support.impersonate) ---
// The silent mint (POST /tenants/:id/impersonate) was removed: every
// impersonation goes through the owner-consent grant flow below, so the
// read-only guarantee and the revoke-anytime guarantee always hold.

// Consent-based impersonation: request → (owner approves) → enter → exit.
// The owner must explicitly approve in their dashboard (or read the code to
// support, who submits it via approve-code) before a token is ever minted.
router.post(
  "/tenants/:tenantId/impersonation/request",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_IMPERSONATE),
  impersonationRequest
);
router.get(
  "/tenants/:tenantId/impersonation/:grantId",
  validateObjectId("tenantId", "grantId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_IMPERSONATE),
  impersonationPoll
);
router.post(
  "/tenants/:tenantId/impersonation/:grantId/approve-code",
  validateObjectId("tenantId", "grantId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_IMPERSONATE),
  impersonationApproveByCode
);
router.post(
  "/tenants/:tenantId/impersonation/:grantId/enter",
  validateObjectId("tenantId", "grantId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_IMPERSONATE),
  impersonationEnter
);
router.post(
  "/tenants/:tenantId/impersonation/:grantId/exit",
  validateObjectId("tenantId", "grantId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_IMPERSONATE),
  impersonationExit
);

// --- Queues (queue.retry; listing requires support.read) ---
router.get(
  "/queues-stats",
  requireScope(PLATFORM_SCOPES.SUPPORT_READ),
  getQueuesStats
);
router.get(
  "/queues/:queue/failed",
  requireScope(PLATFORM_SCOPES.SUPPORT_READ),
  listFailedJobs
);
router.post(
  "/queues/:queue/failed/:jobId/retry",
  requireScope(PLATFORM_SCOPES.QUEUE_RETRY),
  retryFailedJob
);

export default router;
