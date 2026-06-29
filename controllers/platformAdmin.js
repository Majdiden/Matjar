/**
 * Platform-admin (support/ops) controller.
 *
 * These endpoints are cross-tenant — they operate on the admin DB and
 * reach into scoped tenant models as needed. Every mutating action is
 * audit-logged. Not exposed to merchants; mounted at /api/platform.
 */

import mongoose from "mongoose";
import { signJWT, comparePassword } from "../utils/misc.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  suspendTenant,
  unsuspendTenant,
  scheduleTenantDeletion,
  cancelScheduledDeletion,
  purgeTenant,
} from "../services/tenantLifecycle.js";
import { retrySetup } from "../services/storeSetup.js";
import { mintImpersonationToken } from "../services/impersonation.js";
import { exportTenantData } from "../services/dataExport.js";
import { enqueueTenantExport } from "../services/jobs/index.js";
import { getQueue, QUEUE_NAMES } from "../services/jobs/queues.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { PLATFORM_SCOPES } from "../middlewares/platformAdmin.js";
import config from "../config/index.js";
import { streamFile } from "../services/providers/storage.js";
import logger from "../utils/logger.js";

// Keys whose values might be secrets. Matches case-insensitively so
// variants like "apiKey", "API_KEY", "authToken" are all caught. Used
// to redact BullMQ job payloads before they leave the controller.
const SENSITIVE_KEY_RE = /password|secret|token|authorization|api[_-]?key|hash|cookie|bearer/i;
function redactPayload(value, depth = 0) {
  if (depth > 6) return "[depth-limit]";
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redactPayload(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = typeof v === "string" ? "[redacted]" : "[redacted]";
      } else {
        out[k] = redactPayload(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

// --- Auth ------------------------------------------------------------

export const platformLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password required." });
  }
  const TenantUser = mongoose.model("TenantUser");
  const user = await TenantUser.findOne({ email: String(email).toLowerCase().trim(), platformAdmin: true })
    .select("+platformPasswordHash name email platformAdmin");
  if (!user || !user.platformPasswordHash) {
    return res.status(401).json({ success: false, message: "Invalid credentials." });
  }
  const ok = await comparePassword(password, user.platformPasswordHash);
  if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials." });

  // Short TTL on platform tokens because blast radius is cross-tenant.
  // Frontend also enforces an idle timeout; this is the hard ceiling.
  const token = signJWT({ platformUserId: String(user._id), platformAdmin: true }, "30m");
  logger.info("Platform admin login", { platformUserId: String(user._id) });
  res.json({
    success: true,
    data: { token, user: { id: String(user._id), name: user.name, email: user.email } },
  });
});

/**
 * Returns the authenticated platform user plus their scopes, so the
 * frontend can gate UI affordances client-side (server still enforces).
 */
export const platformMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.platformUser.id,
      name: req.platformUser.name,
      email: req.platformUser.email,
      platformAdmin: req.platformUser.platformAdmin,
      scopes: req.platformUser.scopes,
      // Include the canonical list so the frontend doesn't have to
      // hardcode scope names or 404 when new scopes ship.
      availableScopes: Object.values(PLATFORM_SCOPES),
    },
  });
});

// --- Tenant listing / inspection -------------------------------------

export const listTenants = asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, status, q } = req.query;
  const filter = {};
  if (status) filter.subscriptionStatus = status;
  if (q) {
    const rx = new RegExp(String(q).trim(), "i");
    filter.$or = [{ name: rx }, { email: rx }, { slug: rx }, { domain: rx }];
  }
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const Tenant = mongoose.model("Tenant");
  const [rows, total] = await Promise.all([
    Tenant.find(filter)
      .select("name slug email domains subscriptionPlan subscriptionStatus suspendedAt deletionScheduledAt deletedAt setupStatus.status createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Tenant.countDocuments(filter),
  ]);
  res.json({ success: true, data: { tenants: rows, pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } } });
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
  res.json({ success: true, data: result });
});

// --- Lifecycle -------------------------------------------------------

export const suspend = asyncHandler(async (req, res) => {
  const t = await suspendTenant({
    tenantId: req.params.tenantId,
    reason: req.body?.reason,
    platformUserEmail: req.platformUser.email,
  });
  res.json({ success: true, data: { tenantId: String(t._id), status: t.subscriptionStatus } });
});

export const unsuspend = asyncHandler(async (req, res) => {
  const t = await unsuspendTenant({
    tenantId: req.params.tenantId,
    platformUserEmail: req.platformUser.email,
  });
  res.json({ success: true, data: { tenantId: String(t._id), status: t.subscriptionStatus } });
});

export const scheduleDeletion = asyncHandler(async (req, res) => {
  const graceDays = req.body?.graceDays ? Number(req.body.graceDays) : undefined;
  const t = await scheduleTenantDeletion({
    tenantId: req.params.tenantId,
    platformUserEmail: req.platformUser.email,
    graceDays,
  });
  res.json({ success: true, data: { tenantId: String(t._id), deletionScheduledAt: t.deletionScheduledAt } });
});

export const cancelDeletion = asyncHandler(async (req, res) => {
  const t = await cancelScheduledDeletion({ tenantId: req.params.tenantId });
  res.json({ success: true, data: { tenantId: String(t._id) } });
});

export const purge = asyncHandler(async (req, res) => {
  const force = req.body?.force === true;
  const result = await purgeTenant({ tenantId: req.params.tenantId, force });
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
    data: redactPayload(j.data),
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
  const agg = await Tenant.aggregate([
    { $group: { _id: "$subscriptionStatus", count: { $sum: 1 } } },
  ]);
  const byStatus = {};
  for (const row of agg) byStatus[row._id || "unknown"] = row.count;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const setupFailed = await Tenant.countDocuments({ "setupStatus.status": "failed" });
  const scheduledForDeletion = await Tenant.countDocuments({
    deletionScheduledAt: { $ne: null, $exists: true },
  });
  res.json({
    success: true,
    data: { total, byStatus, setupFailed, scheduledForDeletion },
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

// --- Subscription plan catalog --------------------------------------

// Plan keys are stable slugs referenced by tenant.subscriptionPlan.
// Lowercase, start alphanumeric, then alphanumerics / dash / underscore.
const PLAN_KEY_RE = /^[a-z0-9][a-z0-9-_]*$/;

/**
 * Whitelist + coerce a plan payload into the catalog shape. `key` is
 * never taken from here (immutable on update, validated separately on
 * create) — pass it via `overrides`.
 */
function sanitizePlanInput(body = {}, overrides = {}) {
  const out = {};
  if (body.name != null) out.name = String(body.name).trim();
  if (body.description != null) out.description = String(body.description);
  if (body.price != null && body.price !== "") out.price = Number(body.price);
  if (body.currency != null) out.currency = String(body.currency).toUpperCase().trim();
  if (body.interval != null) out.interval = body.interval;
  if (Array.isArray(body.features)) {
    out.features = body.features.map((f) => String(f).trim()).filter(Boolean);
  }
  if (body.limits && typeof body.limits === "object") {
    const num = (v) => (v == null || v === "" ? null : Number(v));
    out.limits = {
      maxProducts: num(body.limits.maxProducts),
      maxStaff: num(body.limits.maxStaff),
    };
  }
  if (body.isActive != null) out.isActive = !!body.isActive;
  if (body.sortOrder != null && body.sortOrder !== "") out.sortOrder = Number(body.sortOrder);
  return { ...out, ...overrides };
}

export const listPlans = asyncHandler(async (_req, res) => {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const plans = await SubscriptionPlan.find({}).sort({ sortOrder: 1, key: 1 }).lean();
  res.json({ success: true, data: plans });
});

export const createPlan = asyncHandler(async (req, res) => {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const body = req.body || {};
  const key = String(body.key || "").toLowerCase().trim();
  if (!key || !PLAN_KEY_RE.test(key)) {
    return res.status(400).json({
      success: false,
      message: "A valid plan key is required (lowercase slug, e.g. \"starter\").",
    });
  }
  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ success: false, message: "Plan name is required." });
  }
  const existing = await SubscriptionPlan.findOne({ key });
  if (existing) {
    return res.status(409).json({ success: false, message: `A plan with key "${key}" already exists.` });
  }
  const plan = await SubscriptionPlan.create(sanitizePlanInput(body, { key }));
  logger.info("Platform: plan created", { key, by: req.platformUser.email });
  res.status(201).json({ success: true, data: plan });
});

export const updatePlan = asyncHandler(async (req, res) => {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  // `key` is the immutable identifier tenants reference — ignore any
  // attempt to change it so existing tenant assignments don't orphan.
  const update = sanitizePlanInput(req.body || {});
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ success: false, message: "No updatable fields provided." });
  }
  update.updatedAt = new Date();
  const plan = await SubscriptionPlan.findByIdAndUpdate(
    req.params.id,
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });
  logger.info("Platform: plan updated", { id: req.params.id, by: req.platformUser.email });
  res.json({ success: true, data: plan });
});

export const deletePlan = asyncHandler(async (req, res) => {
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });

  // Block delete if any tenant is currently on this plan — otherwise
  // their subscriptionPlan would dangle against a non-existent catalog row.
  const Tenant = mongoose.model("Tenant");
  const inUse = await Tenant.countDocuments({ subscriptionPlan: plan.key });
  if (inUse > 0) {
    return res.status(409).json({
      success: false,
      message: `Cannot delete plan "${plan.key}" — ${inUse} tenant(s) are on it. Move them to another plan first.`,
    });
  }
  await plan.deleteOne();
  logger.warn("Platform: plan deleted", { key: plan.key, by: req.platformUser.email });
  res.json({ success: true, data: { id: req.params.id } });
});

/**
 * Change a tenant's current plan. Validates the plan key against the
 * catalog, then sets tenant.subscriptionPlan, refreshes the subscription
 * window (start = now, end = now + interval), and applies the plan's
 * entitlement limits to the tenant.
 */
export const changeTenantPlan = asyncHandler(async (req, res) => {
  const planKey = String(req.body?.plan ?? req.body?.planKey ?? "").toLowerCase().trim();
  if (!planKey) {
    return res.status(400).json({ success: false, message: "A plan key is required." });
  }
  const SubscriptionPlan = mongoose.model("SubscriptionPlan");
  const plan = await SubscriptionPlan.findOne({ key: planKey });
  if (!plan) {
    return res.status(404).json({ success: false, message: `Unknown plan "${planKey}".` });
  }

  const now = new Date();
  const endDate = new Date(now);
  if (plan.interval === "year") endDate.setFullYear(endDate.getFullYear() + 1);
  else endDate.setMonth(endDate.getMonth() + 1);

  const set = {
    subscriptionPlan: plan.key,
    subscriptionStartDate: now,
    subscriptionEndDate: endDate,
  };
  // Track entitlements off the plan when it declares them. maxStaff maps
  // to the tenant's maxUsers limit.
  if (plan.limits?.maxProducts != null) set["limits.maxProducts"] = plan.limits.maxProducts;
  if (plan.limits?.maxStaff != null) set["limits.maxUsers"] = plan.limits.maxStaff;

  const Tenant = mongoose.model("Tenant");
  const t = await Tenant.findByIdAndUpdate(req.params.tenantId, { $set: set }, { new: true });
  if (!t) return res.status(404).json({ success: false, message: "Tenant not found." });

  logger.warn("Platform: tenant plan changed", {
    tenantId: String(t._id),
    plan: plan.key,
    by: req.platformUser.email,
  });
  res.json({
    success: true,
    data: {
      tenantId: String(t._id),
      subscriptionPlan: t.subscriptionPlan,
      subscriptionStartDate: t.subscriptionStartDate,
      subscriptionEndDate: t.subscriptionEndDate,
    },
  });
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
