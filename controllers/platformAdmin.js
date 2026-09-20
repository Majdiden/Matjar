/**
 * Platform-admin (support/ops) controller.
 *
 * These endpoints are cross-tenant — they operate on the admin DB and
 * reach into scoped tenant models as needed. Every mutating action is
 * audit-logged. Not exposed to merchants; mounted at /api/platform.
 */

import mongoose from "mongoose";
import { escapeRegExp, clampInt } from "../utils/misc.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  suspendTenant,
  unsuspendTenant,
  scheduleTenantDeletion,
  cancelScheduledDeletion,
  purgeTenant,
} from "../services/tenantLifecycle.js";
import { retrySetup, seedStarterContentForTenant } from "../services/storeSetup.js";
import { getPhoneCountryConfig, setPhoneCountryConfig } from "../services/phoneCountries.js";
import { PHONE_COUNTRY_CATALOG } from "../config/phoneCountries.js";
import { mintImpersonationToken } from "../services/impersonation.js";
import { exportTenantData } from "../services/dataExport.js";
import { enqueueTenantExport } from "../services/jobs/index.js";
import { getQueue, QUEUE_NAMES } from "../services/jobs/queues.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { PLATFORM_SCOPES } from "../middlewares/platformAdmin.js";
import config from "../config/index.js";
import { streamFile } from "../services/providers/storage.js";
import logger from "../utils/logger.js";
import { recordPlatformAudit, redactForAudit } from "../services/platform/audit.js";
import { LIFECYCLE_STATES } from "../services/tenantLifecycle.js";


/** The lifecycle-relevant fields of a tenant, for audit before/after snapshots. */
const lifecycleSnapshot = (t) =>
  t
    ? {
        lifecycle: t.lifecycle?.state || null,
        subscriptionStatus: t.subscriptionStatus || null,
        isActive: t.isActive,
        suspendedAt: t.suspendedAt || null,
        deletionScheduledAt: t.deletionScheduledAt || null,
        deletedAt: t.deletedAt || null,
      }
    : null;

async function tenantSnapshot(tenantId) {
  const t = await mongoose.model("Tenant").findById(tenantId).select("lifecycle.state subscriptionStatus isActive suspendedAt deletionScheduledAt deletedAt").lean();
  return lifecycleSnapshot(t);
}


// --- Tenant listing / inspection -------------------------------------

export const listTenants = asyncHandler(async (req, res) => {
  const { status, q, lifecycle } = req.query;
  const page = clampInt(req.query.page, 1, 1, 100000);
  const limit = clampInt(req.query.limit, 25, 1, 100);
  const filter = {};
  if (status) filter.subscriptionStatus = String(status);
  if (lifecycle) {
    const wanted = String(lifecycle).toLowerCase();
    if (!Object.values(LIFECYCLE_STATES).includes(wanted)) {
      return res.status(400).json({ success: false, message: "Unknown lifecycle state." });
    }
    filter["lifecycle.state"] = wanted;
  }
  if (q) {
    const term = String(q).trim().slice(0, 100);
    if (term) {
      const rx = new RegExp(escapeRegExp(term), "i");
      filter.$or = [{ name: rx }, { email: rx }, { slug: rx }, { domain: rx }, { phone: rx }];
    }
  }
  const skip = (page - 1) * limit;
  const Tenant = mongoose.model("Tenant");
  const [rows, total] = await Promise.all([
    Tenant.find(filter)
      .select("name slug email phone phoneCountry domains subscriptionPlan subscriptionStatus suspendedAt deletionScheduledAt deletedAt setupStatus.status lifecycle.state lifecycle.reason lifecycle.changedAt createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Tenant.countDocuments(filter),
  ]);
  res.json({ success: true, data: { tenants: rows, pagination: { total, page, pages: Math.ceil(total / limit) } } });
});

export const getTenant = asyncHandler(async (req, res) => {
  const Tenant = mongoose.model("Tenant");
  const t = await Tenant.findById(req.params.tenantId).lean();
  if (!t) return res.status(404).json({ success: false, message: "Tenant not found." });
  if (t.paymentProviders) {
    if (t.paymentProviders.stripe?.secretKey) t.paymentProviders.stripe.secretKey = "***";
    if (t.paymentProviders.paypal?.clientSecret) t.paymentProviders.paypal.clientSecret = "***";
  }
  if (t.setupStatus) delete t.setupStatus.setupToken;
  res.json({ success: true, data: t });
});

// --- Setup retry -----------------------------------------------------

export const retryTenantSetup = asyncHandler(async (req, res) => {
  const result = await retrySetup(req.params.tenantId);
  logger.warn("Platform: setup retry", { tenantId: req.params.tenantId, by: req.platformUser.email });
  await recordPlatformAudit(req, {
    action: "tenant.setup.retry",
    resourceType: "Tenant",
    resourceId: req.params.tenantId,
    tenantId: req.params.tenantId,
    after: { success: result?.success, status: result?.status?.status || null },
    outcome: result?.success ? "success" : "failure",
  });
  res.json({ success: true, data: result });
});

// --- On-demand starter content -----------------------------------------
//
// Auto-seeding at signup is off by default (feature flag
// `onboarding.starterContent`); this lets an operator populate a single
// store with the niche-matched DRAFT starter catalog after the fact. The
// seeder refuses to touch a store that already has real merchant products,
// so it is safe to call on a live store (it becomes a no-op).

export const seedTenantStarterContent = asyncHandler(async (req, res) => {
  const result = await seedStarterContentForTenant(req.params.tenantId);
  logger.warn("Platform: starter content seed", {
    tenantId: req.params.tenantId,
    by: req.platformUser.email,
    seeded: result.seeded,
    source: result.source,
  });
  await recordPlatformAudit(req, {
    action: "tenant.seed_starter_content",
    resourceType: "Tenant",
    resourceId: req.params.tenantId,
    tenantId: req.params.tenantId,
    after: { seeded: result.seeded, source: result.source, products: result.products, categories: result.categories, collections: result.collections, pages: result.pages },
    outcome: result.success ? "success" : "failure",
  });
  res.json({ success: true, data: result });
});

// --- Phone countries (signup / profile dial codes) ---------------------

/** GET /platform/phone-countries — effective config + the pickable catalog. */
export const getPhoneCountries = asyncHandler(async (_req, res) => {
  const config = await getPhoneCountryConfig();
  res.json({ success: true, data: { ...config, catalog: PHONE_COUNTRY_CATALOG } });
});

/**
 * PUT /platform/phone-countries
 * body: { countries: [{ iso2, name, nameAr, dialCode, minDigits, maxDigits, enabled }], defaultCountry }
 * Replaces the operator's full list. Validation lives in the service.
 */
export const updatePhoneCountries = asyncHandler(async (req, res) => {
  const before = await getPhoneCountryConfig();
  const config = await setPhoneCountryConfig(
    { countries: req.body?.countries, defaultCountry: req.body?.defaultCountry },
    req.platformUser?.id
  );
  logger.warn("Platform: phone countries updated", {
    by: req.platformUser.email,
    enabled: config.countries.filter((c) => c.enabled).map((c) => c.iso2),
    defaultCountry: config.defaultCountry,
  });
  const summarize = (cfg) => ({
    enabled: cfg.countries.filter((c) => c.enabled).map((c) => `${c.iso2} ${c.dialCode}`),
    disabled: cfg.countries.filter((c) => !c.enabled).map((c) => c.iso2),
    defaultCountry: cfg.defaultCountry,
  });
  await recordPlatformAudit(req, {
    action: "phone_countries.update",
    resourceType: "PlatformConfig",
    resourceId: "phoneCountries",
    before: summarize(before),
    after: summarize(config),
  });
  res.json({ success: true, data: { ...config, catalog: PHONE_COUNTRY_CATALOG } });
});

// --- Lifecycle -------------------------------------------------------

// Lifecycle transitions throw with statusCode 409 when the transition table
// forbids the move (e.g. suspending an archived tenant); surface that as a
// 409 rather than a masked 500.
const lifecycleError = (res, err) => {
  const status = err?.statusCode === 409 ? 409 : err?.message === "Tenant not found" ? 404 : 500;
  if (status === 500) logger.error("Lifecycle operation failed", { error: err?.message });
  return res.status(status).json({ success: false, message: status === 500 ? "Operation failed." : err.message });
};

const reasonFromBody = (req, max = 500) => {
  const r = req.body?.reason;
  return r == null ? null : String(r).trim().slice(0, max) || null;
};

export const suspend = asyncHandler(async (req, res) => {
  const reason = reasonFromBody(req);
  if (!reason || reason.length < 4) {
    return res.status(400).json({ success: false, message: "A reason (min 4 characters) is required." });
  }
  const before = await tenantSnapshot(req.params.tenantId);
  let t;
  try {
    t = await suspendTenant({ tenantId: req.params.tenantId, reason, platformUserEmail: req.platformUser.email });
  } catch (err) {
    return lifecycleError(res, err);
  }
  await recordPlatformAudit(req, {
    action: "tenant.suspend",
    resourceType: "Tenant",
    resourceId: t._id,
    tenantId: t._id,
    reason,
    before,
    after: lifecycleSnapshot(t),
  });
  res.json({ success: true, data: { tenantId: String(t._id), status: t.subscriptionStatus, lifecycle: t.lifecycle?.state } });
});

export const unsuspend = asyncHandler(async (req, res) => {
  const reason = reasonFromBody(req);
  const before = await tenantSnapshot(req.params.tenantId);
  let t;
  try {
    t = await unsuspendTenant({ tenantId: req.params.tenantId, platformUserEmail: req.platformUser.email, reason });
  } catch (err) {
    return lifecycleError(res, err);
  }
  await recordPlatformAudit(req, {
    action: "tenant.unsuspend",
    resourceType: "Tenant",
    resourceId: t._id,
    tenantId: t._id,
    reason,
    before,
    after: lifecycleSnapshot(t),
  });
  res.json({ success: true, data: { tenantId: String(t._id), status: t.subscriptionStatus, lifecycle: t.lifecycle?.state } });
});

export const scheduleDeletion = asyncHandler(async (req, res) => {
  const graceDays = req.body?.graceDays ? Number(req.body.graceDays) : undefined;
  const reason = reasonFromBody(req);
  if (!reason || reason.length < 4) {
    return res.status(400).json({ success: false, message: "A reason (min 4 characters) is required." });
  }
  const before = await tenantSnapshot(req.params.tenantId);
  let t;
  try {
    t = await scheduleTenantDeletion({ tenantId: req.params.tenantId, platformUserEmail: req.platformUser.email, graceDays, reason });
  } catch (err) {
    if (/graceDays/.test(err.message)) return res.status(400).json({ success: false, message: err.message });
    return lifecycleError(res, err);
  }
  await recordPlatformAudit(req, {
    action: "tenant.schedule_deletion",
    resourceType: "Tenant",
    resourceId: t._id,
    tenantId: t._id,
    reason,
    before,
    after: lifecycleSnapshot(t),
    metadata: { graceDays: graceDays ?? null },
  });
  res.json({ success: true, data: { tenantId: String(t._id), deletionScheduledAt: t.deletionScheduledAt, lifecycle: t.lifecycle?.state } });
});

export const cancelDeletion = asyncHandler(async (req, res) => {
  const before = await tenantSnapshot(req.params.tenantId);
  let t;
  try {
    t = await cancelScheduledDeletion({ tenantId: req.params.tenantId, platformUserEmail: req.platformUser.email });
  } catch (err) {
    return lifecycleError(res, err);
  }
  await recordPlatformAudit(req, {
    action: "tenant.cancel_deletion",
    resourceType: "Tenant",
    resourceId: t._id,
    tenantId: t._id,
    before,
    after: lifecycleSnapshot(t),
  });
  res.json({ success: true, data: { tenantId: String(t._id), lifecycle: t.lifecycle?.state } });
});

export const purge = asyncHandler(async (req, res) => {
  const force = req.body?.force === true;
  const before = await tenantSnapshot(req.params.tenantId);
  let result;
  try {
    result = await purgeTenant({ tenantId: req.params.tenantId, force, platformUserEmail: req.platformUser.email, via: "console" });
  } catch (err) {
    await recordPlatformAudit(req, {
      action: "tenant.purge",
      resourceType: "Tenant",
      resourceId: req.params.tenantId,
      tenantId: req.params.tenantId,
      before,
      metadata: { force, error: err.message },
      outcome: "failure",
    });
    const status = err?.message === "Tenant not found" ? 404 : err?.statusCode === 409 ? 409 : 500;
    return res.status(status).json({ success: false, message: status === 500 ? "Purge failed." : err.message });
  }
  await recordPlatformAudit(req, {
    action: "tenant.purge",
    resourceType: "Tenant",
    resourceId: req.params.tenantId,
    tenantId: req.params.tenantId,
    before,
    after: await tenantSnapshot(req.params.tenantId),
    metadata: { force, counts: result.counts },
  });
  logger.warn("Platform: tenant purged", { tenantId: req.params.tenantId, by: req.platformUser.email, force });
  res.json({ success: true, data: result });
});

// --- Export ----------------------------------------------------------

/**
 * Sync export — returns the full dump inline. Disabled in production
 * because it can OOM the web dyno on large tenants and bypasses the
 * audited download-proxy path. Dev/CI use only; prod operators go
 * through requestAsyncExport + downloadExport.
 */
export const exportData = asyncHandler(async (req, res) => {
  if (config.isProduction && !config.allowSyncExport) {
    return res.status(410).json({
      success: false,
      message: "Sync export is disabled in production. Use async export + download proxy.",
    });
  }
  const data = await exportTenantData(req.params.tenantId);
  await recordPlatformAudit(req, {
    action: "export.sync_download",
    resourceType: "Tenant",
    resourceId: req.params.tenantId,
    tenantId: req.params.tenantId,
  });
  res.json({ success: true, data });
});

/**
 * Async export — creates a TenantExport row, enqueues the worker job,
 * returns the row id so the caller can poll for status/URL.
 */
export const requestAsyncExport = asyncHandler(async (req, res) => {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(req.params.tenantId).select("_id");
  if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });
  const TenantExport = mongoose.model("TenantExport");
  const row = await TenantExport.create({
    tenantId: tenant._id,
    requestedBy: req.platformUser.email,
    status: "pending",
  });
  await enqueueTenantExport(tenant._id, row._id, { source: "platform-admin" });
  logger.warn("Platform: async export requested", {
    tenantId: String(tenant._id),
    exportId: String(row._id),
    by: req.platformUser.email,
  });
  await recordPlatformAudit(req, {
    action: "export.request",
    resourceType: "TenantExport",
    resourceId: row._id,
    tenantId: tenant._id,
  });
  res.status(202).json({ success: true, data: { exportId: String(row._id), status: row.status } });
});

export const getExportStatus = asyncHandler(async (req, res) => {
  const TenantExport = mongoose.model("TenantExport");
  // Don't select `url` — it's marked select:false on the schema and is
  // intentionally not exposed. Clients download via the proxy endpoint.
  const row = await TenantExport.findOne({
    _id: req.params.exportId,
    tenantId: req.params.tenantId,
  }).lean();
  if (!row) return res.status(404).json({ success: false, message: "Export not found." });
  // Synthesize a proxy download path so the UI has something to link to.
  // There is no raw storage URL to expose — see schemas/tenantExport.js.
  const downloadUrl =
    row.status === "ready"
      ? `/api/platform/tenants/${row.tenantId}/exports/${row._id}/download`
      : null;
  res.json({ success: true, data: { ...row, downloadUrl } });
});

/**
 * Download proxy — streams the export file through the API server so
 * access can be scope-checked and expiry-enforced. Tenants never see
 * the underlying storage URL (which would otherwise bypass auth).
 */
export const downloadExport = asyncHandler(async (req, res) => {
  const TenantExport = mongoose.model("TenantExport");
  const row = await TenantExport.findOne({
    _id: req.params.exportId,
    tenantId: req.params.tenantId,
  });
  if (!row) return res.status(404).json({ success: false, message: "Export not found." });
  if (row.status !== "ready") {
    return res.status(409).json({ success: false, message: `Export is ${row.status}, not ready.` });
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return res.status(410).json({ success: false, message: "Export has expired." });
  }
  if (!row.storageKey) {
    return res.status(500).json({ success: false, message: "Export has no storage key." });
  }

  logger.warn("Platform: export downloaded", {
    tenantId: String(row.tenantId),
    exportId: String(row._id),
    by: req.platformUser.email,
  });
  await recordPlatformAudit(req, {
    action: "export.download",
    resourceType: "TenantExport",
    resourceId: row._id,
    tenantId: row.tenantId,
    metadata: { bytes: row.bytes ?? null },
  });

  const filename = `tenant-${row.tenantId}-${row._id}.json`;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  try {
    const stream = await streamFile({
      publicId: row.storageKey,
      provider: row.provider,
      folder: "tenant-exports",
    });
    stream.on("error", (err) => {
      logger.error("Export stream error", { exportId: String(row._id), error: err.message });
      if (!res.headersSent) {
        res.status(502).json({ success: false, message: "Failed to stream export." });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (err) {
    logger.error("Export open failed", { exportId: String(row._id), error: err.message });
    return res
      .status(502)
      .json({ success: false, message: `Failed to open export: ${err.message}` });
  }
});

// --- Order / payment inspection -------------------------------------

export const listTenantOrders = asyncHandler(async (req, res) => {
  const models = createScopedModels(mongoose.connection, req.params.tenantId);
  const { page = 1, limit = 25, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [rows, total] = await Promise.all([
    models.Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    models.Order.countDocuments(filter),
  ]);
  res.json({ success: true, data: { orders: rows, pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } } });
});

export const getTenantOrder = asyncHandler(async (req, res) => {
  const models = createScopedModels(mongoose.connection, req.params.tenantId);
  const order = await models.Order.findById(req.params.orderId).lean();
  if (!order) return res.status(404).json({ success: false, message: "Order not found." });
  res.json({ success: true, data: order });
});

export const listTenantPayments = asyncHandler(async (req, res) => {
  const models = createScopedModels(mongoose.connection, req.params.tenantId);
  if (!models.Payment) return res.json({ success: true, data: [] });
  const rows = await models.Payment.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ success: true, data: rows });
});

// --- Impersonation ---------------------------------------------------

export const impersonate = asyncHandler(async (req, res) => {
  const { reason, ttlSeconds } = req.body || {};
  const result = await mintImpersonationToken({
    platformUser: req.platformUser,
    tenantId: req.params.tenantId,
    reason,
    ttlSeconds,
  });
  logger.warn("Platform: impersonation minted", {
    tenantId: req.params.tenantId,
    by: req.platformUser.email,
    reason: String(reason).slice(0, 120),
  });
  await recordPlatformAudit(req, {
    action: "impersonation.mint_legacy",
    resourceType: "Tenant",
    resourceId: req.params.tenantId,
    tenantId: req.params.tenantId,
    reason: reason ? String(reason).slice(0, 500) : null,
    metadata: { userId: result?.userId || null, expiresIn: result?.expiresIn || null },
  });
  res.json({ success: true, data: result });
});

// --- Failed jobs inspection -----------------------------------------

export const listFailedJobs = asyncHandler(async (req, res) => {
  const queueName = req.params.queue;
  if (!Object.values(QUEUE_NAMES).includes(queueName)) {
    return res.status(400).json({ success: false, message: `Unknown queue ${queueName}` });
  }
  const q = getQueue(queueName);
  const start = parseInt(req.query.start || "0", 10);
  const end = start + Math.min(parseInt(req.query.limit || "50", 10), 200) - 1;
  const jobs = await q.getFailed(start, end);
  const shaped = jobs.map((j) => ({
    id: j.id,
    name: j.name,
    attemptsMade: j.attemptsMade,
    failedReason: j.failedReason,
    // Redact before returning — job payloads can contain passwords
    // (registration), webhook secrets, API keys, session tokens, etc.
    data: redactForAudit(j.data),
    timestamp: j.timestamp,
    finishedOn: j.finishedOn,
  }));
  res.json({ success: true, data: shaped });
});

// Per-queue extra scope requirements. queue.retry is the baseline; any
// queue listed here demands an additional scope because its side
// effects touch money or tenant-state. Enforced inside the handler
// (can't be a static router guard because it varies by :queue param).
const EXTRA_SCOPE_BY_QUEUE = {
  [QUEUE_NAMES.PAYMENT_RECONCILIATION]: PLATFORM_SCOPES.BILLING_READ,
  [QUEUE_NAMES.TENANT_LIFECYCLE]: PLATFORM_SCOPES.TENANT_LIFECYCLE,
};

export const retryFailedJob = asyncHandler(async (req, res) => {
  const queueName = req.params.queue;
  if (!Object.values(QUEUE_NAMES).includes(queueName)) {
    return res.status(400).json({ success: false, message: `Unknown queue ${queueName}` });
  }
  // Per-queue extra scope gate — queue.retry is already enforced at
  // the router; this additionally blocks retrying high-blast-radius
  // queues unless the operator also holds the relevant domain scope.
  const extra = EXTRA_SCOPE_BY_QUEUE[queueName];
  if (extra && !req.platformUser.scopes.includes(extra)) {
    return res.status(403).json({
      success: false,
      message: `Retrying jobs in "${queueName}" requires the "${extra}" scope.`,
    });
  }
  const q = getQueue(queueName);
  const job = await q.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: "Job not found." });
  await job.retry();
  logger.warn("Platform: job retried", { queue: queueName, jobId: req.params.jobId, by: req.platformUser.email });
  await recordPlatformAudit(req, {
    action: "queue.job.retry",
    resourceType: "Job",
    resourceId: `${queueName}:${job.id}`,
    tenantId: mongoose.Types.ObjectId.isValid(job.data?.tenantId) ? job.data.tenantId : null,
    metadata: { queue: queueName, jobName: job.name, attemptsMade: job.attemptsMade },
  });
  res.json({ success: true, data: { jobId: job.id } });
});

// --- Aggregate stats for the UI dashboards --------------------------

/**
 * Tenant-centric KPIs for the TenantDetail hero. Everything is scoped
 * to a single tenant and fails-soft per metric so a missing model or
 * a dead collection doesn't blank the whole dashboard.
 */
export const getTenantStats = asyncHandler(async (req, res) => {
  const tenantId = req.params.tenantId;
  const models = createScopedModels(mongoose.connection, tenantId);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const safe = async (fn, fallback) => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const [
    orders30d,
    revenue30dAgg,
    failedWebhooks,
    pendingExports,
    auditLast,
    usersTotal,
    productsTotal,
  ] = await Promise.all([
    safe(() => models.Order?.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }) ?? 0, 0),
    safe(
      () =>
        models.Order?.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $ne: "cancelled" } } },
          { $group: { _id: null, total: { $sum: "$total" } } },
        ]) ?? [],
      []
    ),
    safe(() => models.WebhookDelivery?.countDocuments({ status: "failed" }) ?? 0, 0),
    safe(
      () =>
        mongoose
          .model("TenantExport")
          .countDocuments({ tenantId, status: { $in: ["pending", "running"] } }),
      0
    ),
    safe(
      () =>
        models.AuditLog?.find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .lean() ?? [],
      []
    ),
    safe(() => models.User?.countDocuments({}) ?? 0, 0),
    safe(() => models.Product?.countDocuments({}) ?? 0, 0),
  ]);

  const revenue30d = revenue30dAgg?.[0]?.total || 0;

  res.json({
    success: true,
    data: {
      orders30d,
      revenue30d,
      failedWebhooks,
      pendingExports,
      usersTotal,
      productsTotal,
      recentAudit: auditLast,
    },
  });
});

/**
 * Cross-tenant tenants-list stats: counts per subscription status so
 * the Tenants page can render a clickable status-filter header.
 */
export const getTenantsStats = asyncHandler(async (_req, res) => {
  const Tenant = mongoose.model("Tenant");
  const [agg, lifecycleAgg] = await Promise.all([
    Tenant.aggregate([{ $group: { _id: "$subscriptionStatus", count: { $sum: 1 } } }]),
    Tenant.aggregate([{ $group: { _id: "$lifecycle.state", count: { $sum: 1 } } }]),
  ]);
  const byStatus = {};
  for (const row of agg) byStatus[row._id || "unknown"] = row.count;
  const byLifecycle = {};
  for (const row of lifecycleAgg) byLifecycle[row._id || "unknown"] = row.count;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const setupFailed = await Tenant.countDocuments({ "setupStatus.status": "failed" });
  const scheduledForDeletion = await Tenant.countDocuments({
    deletionScheduledAt: { $ne: null, $exists: true },
  });
  res.json({
    success: true,
    data: { total, byStatus, byLifecycle, setupFailed, scheduledForDeletion },
  });
});

/**
 * Per-queue counts across every BullMQ queue, used by the Queues
 * overview cards. Pulls live JobCounts from Redis — cheap enough to
 * call on every page load.
 */
export const getQueuesStats = asyncHandler(async (_req, res) => {
  const names = Object.values(QUEUE_NAMES);
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        const q = getQueue(name);
        const counts = await q.getJobCounts(
          "waiting",
          "active",
          "completed",
          "failed",
          "delayed",
          "paused"
        );
        return { name, counts };
      } catch (err) {
        return { name, error: err.message, counts: {} };
      }
    })
  );
  res.json({ success: true, data: results });
});

// --- Failed webhook deliveries (tenant-scoped) ----------------------

export const listFailedWebhooks = asyncHandler(async (req, res) => {
  const { createScopedModels } = await import("../utils/scopedModel.js");
  const models = createScopedModels(mongoose.connection, req.params.tenantId);
  if (!models.WebhookDelivery) {
    return res.status(404).json({ success: false, message: "Webhook delivery model not available." });
  }
  const rows = await models.WebhookDelivery.find({ status: "failed" })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ success: true, data: rows });
});
