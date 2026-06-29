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
  PLATFORM_SCOPES,
} from "../middlewares/platformAdmin.js";
import {
  platformLogin,
  platformMe,
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
  impersonate,
  listFailedJobs,
  retryFailedJob,
  listFailedWebhooks,
  getTenantStats,
  getTenantsStats,
  getQueuesStats,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  changeTenantPlan,
} from "../controllers/platformAdmin.js";

const router = Router();

// Public: platform admin login
router.post("/login", platformLogin);

// Everything below requires a platform-admin token.
router.use(platformAuthenticate);

// Session info (no scope required beyond being authenticated).
router.get("/me", platformMe);

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
router.post(
  "/tenants/:tenantId/purge",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
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
router.post(
  "/tenants/:tenantId/impersonate",
  validateObjectId("tenantId"),
  requireScope(PLATFORM_SCOPES.SUPPORT_IMPERSONATE),
  impersonate
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
