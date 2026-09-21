/**
 * Platform overview metrics (admin console home).
 *
 * Every metric group is computed fail-soft: one dead collection or a Redis
 * outage blanks that group (zeros + `errors[]`), never the whole page. The
 * result is cached in-process for CACHE_TTL_MS because the aggregations
 * touch every tenant's orders and the operator refreshes often from a phone.
 *
 * GMV is never summed across currencies — each store trades in its own
 * currency (decision 2 in docs/plans/platform-admin-operating-system.md), so
 * commerce/revenue figures are returned as per-currency breakdowns.
 */
import mongoose from "mongoose";
import { getQueue, getQueueConnection, QUEUE_NAMES } from "../jobs/queues.js";
import { DOMAIN_STATUSES } from "../../schemas/domain.js";
import logger from "../../utils/logger.js";
import { DEFAULT_CURRENCY, EXCLUDED_ORDER_STATUSES, hasModel, mrrByCurrency, round2, safe as safeMetric, tenantBaseCurrencyMap } from "./metrics.js";

export const CACHE_TTL_MS = 30_000;
// A forced refresh is honoured at most once per this window (per process);
// otherwise the cached summary is served — the aggregations are heavy.
export const REFRESH_MIN_INTERVAL_MS = 10_000;
// Redis calls race against this so a down broker cannot hang the page.
const QUEUE_TIMEOUT_MS = 2_500;
const STUCK_SETUP_MS = 15 * 60 * 1000;
const STAFF_ROLES = ["admin", "manager", "staff"];
// Order statuses that never count toward commerce figures.

let cache = { data: null, at: 0 };
let lastForcedAt = 0;

const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const safe = (errors, key, fn, fallback) => safeMetric(errors, key, fn, fallback, "overview");

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ─── Stores ─────────────────────────────────────────────────────────────────

async function platformMetrics(errors) {
  const Tenant = mongoose.model("Tenant");
  const zero = { total: 0, active: 0, onboarding: 0, pending: 0, suspended: 0, closed: 0, archived: 0, new7d: 0, new30d: 0, usersTotal: 0 };
  const byState = await safe(errors, "stores.byState", async () => {
    const rows = await Tenant.aggregate([
      {
        // Prefer the explicit lifecycle state; derive it for legacy rows.
        $project: {
          state: {
            $ifNull: [
              "$lifecycle.state",
              {
                $switch: {
                  branches: [
                    { case: { $ne: [{ $ifNull: ["$deletedAt", null] }, null] }, then: "archived" },
                    { case: { $ne: [{ $ifNull: ["$deletionScheduledAt", null] }, null] }, then: "closed" },
                    { case: { $eq: ["$subscriptionStatus", "suspended"] }, then: "suspended" },
                    { case: { $eq: ["$subscriptionStatus", "cancelled"] }, then: "closed" },
                    { case: { $ne: ["$setupStatus.status", "completed"] }, then: "onboarding" },
                  ],
                  default: "active",
                },
              },
            ],
          },
        },
      },
      { $group: { _id: "$state", n: { $sum: 1 } } },
    ]);
    const out = {};
    for (const r of rows) out[r._id] = r.n;
    return out;
  }, {});
  const [new7d, new30d, usersTotal] = await Promise.all([
    safe(errors, "stores.new7d", () => Tenant.countDocuments({ createdAt: { $gte: daysAgo(7) } }), 0),
    safe(errors, "stores.new30d", () => Tenant.countDocuments({ createdAt: { $gte: daysAgo(30) } }), 0),
    safe(errors, "stores.usersTotal", () =>
      mongoose.model("User").countDocuments({ roles: { $in: STAFF_ROLES }, isActive: true }), 0),
  ]);
  const total = Object.values(byState).reduce((a, b) => a + b, 0);
  return {
    ...zero,
    total,
    active: byState.active || 0,
    onboarding: byState.onboarding || 0,
    pending: byState.pending || 0,
    suspended: byState.suspended || 0,
    closed: byState.closed || 0,
    archived: byState.archived || 0,
    new7d,
    new30d,
    usersTotal,
  };
}

// ─── Commerce ───────────────────────────────────────────────────────────────

async function commerceMetrics(errors) {
  const Order = mongoose.model("Order");
  const base = { status: { $nin: EXCLUDED_ORDER_STATUSES } };
  const count = (key, extra) => safe(errors, `commerce.${key}`, () => Order.countDocuments({ ...base, ...extra }), 0);

  const [ordersToday, orders7d, orders30d, pending, cancelled, refunded, byCurrency30d] = await Promise.all([
    count("ordersToday", { createdAt: { $gte: startOfToday() } }),
    count("orders7d", { createdAt: { $gte: daysAgo(7) } }),
    count("orders30d", { createdAt: { $gte: daysAgo(30) } }),
    count("pending", { status: "Pending" }),
    count("cancelled30d", { status: "Cancelled", createdAt: { $gte: daysAgo(30) } }),
    count("refunded30d", { paymentStatus: { $in: ["Refunded", "Partially Refunded"] }, createdAt: { $gte: daysAgo(30) } }),
    safe(errors, "commerce.gmv30d", async () => {
      // Same currency source as Analytics: the order's own baseCurrency,
      // falling back to the tenant's base currency for orders written before
      // it was stamped (resolved once per tenant, not per order).
      const rows = await Order.aggregate([
        { $match: { ...base, status: { $nin: [...EXCLUDED_ORDER_STATUSES, "Cancelled"] }, createdAt: { $gte: daysAgo(30) } } },
        {
          $group: {
            _id: { currency: "$baseCurrency", tenantId: { $cond: [{ $ifNull: ["$baseCurrency", false] }, null, "$tenantId"] } },
            gmv: { $sum: { $ifNull: ["$totalAmount", 0] } },
            orders: { $sum: 1 },
          },
        },
      ]);
      const fallback = await tenantBaseCurrencyMap([...new Set(rows.filter((r) => r._id.tenantId).map((r) => r._id.tenantId))]);
      const by = {};
      for (const r of rows) {
        const currency = r._id.currency || fallback.get(String(r._id.tenantId)) || DEFAULT_CURRENCY;
        const acc = (by[currency] = by[currency] || { currency, gmv: 0, orders: 0 });
        acc.gmv += r.gmv;
        acc.orders += r.orders;
      }
      return Object.values(by)
        .sort((a, b) => b.gmv - a.gmv)
        .map((r) => ({ currency: r.currency, gmv: round2(r.gmv), orders: r.orders, aov: r.orders ? round2(r.gmv / r.orders) : 0 }));
    }, []),
  ]);
  return { ordersToday, orders7d, orders30d, pending, cancelled30d: cancelled, refunded30d: refunded, gmv30dByCurrency: byCurrency30d };
}

// ─── Revenue (platform billing) ─────────────────────────────────────────────

async function revenueMetrics(errors) {
  const out = { mrrByCurrency: [], commissionThisPeriodByCurrency: [], overdueStatements: 0, overdueByCurrency: [], trialStores: 0, available: false };
  if (!hasModel("BillingStatement") || !hasModel("PlatformFeeEvent")) return out;
  out.available = true;
  const Tenant = mongoose.model("Tenant");
  const periodKey = new Date().toISOString().slice(0, 7);

  const [mrr, commission, overdue, trialStores] = await Promise.all([
    // Active stores on a plan with a base fee (shared with Analytics so both
    // pages agree). Yearly plans contribute 1/12.
    safe(errors, "revenue.mrr", () => mrrByCurrency(), []),
    safe(errors, "revenue.commission", async () => {
      const rows = await mongoose.model("PlatformFeeEvent").aggregate([
        { $match: { periodKey, type: { $in: ["commission", "reversal"] } } },
        { $group: { _id: "$feeCurrency", amount: { $sum: "$feeAmount" }, events: { $sum: 1 } } },
        { $sort: { amount: -1 } },
      ]);
      return rows.map((r) => ({ currency: r._id, amount: round2(r.amount), events: r.events }));
    }, []),
    safe(errors, "revenue.overdue", async () => {
      const rows = await mongoose.model("BillingStatement").aggregate([
        { $match: { status: "overdue" } },
        { $group: { _id: "$currency", amount: { $sum: "$balance" }, count: { $sum: 1 } } },
      ]);
      return rows.map((r) => ({ currency: r._id, amount: round2(r.amount), count: r.count }));
    }, []),
    safe(errors, "revenue.trialStores", () => Tenant.countDocuments({ subscriptionPlan: "trial", isActive: true, deletedAt: null }), 0),
  ]);
  out.mrrByCurrency = mrr;
  out.commissionThisPeriodByCurrency = commission;
  out.overdueByCurrency = overdue;
  out.overdueStatements = overdue.reduce((a, r) => a + r.count, 0);
  out.trialStores = trialStores;
  return out;
}

// ─── Operations ─────────────────────────────────────────────────────────────

async function operationsMetrics(errors) {
  const Tenant = mongoose.model("Tenant");
  const [failedJobsByQueue, failedWebhooks, stuckSetups, failedSetups, domainProblems, overdueStatements] = await Promise.all([
    safe(errors, "ops.failedJobs", async () => {
      const names = Object.values(QUEUE_NAMES);
      // Short-circuit when the shared Redis connection is not ready — every
      // queue call would otherwise sit in the offline queue until timeout.
      let redisStatus = "unknown";
      try {
        redisStatus = getQueueConnection().status;
      } catch {
        redisStatus = "error";
      }
      if (redisStatus !== "ready") {
        logger.warn("overview: redis not ready, skipping queue counts", { status: redisStatus });
        return names.map((queue) => ({ queue, failed: 0, waiting: 0, delayed: 0, error: "unavailable" }));
      }
      return Promise.all(
        names.map(async (name) => {
          try {
            const counts = await withTimeout(
              getQueue(name).getJobCounts("failed", "waiting", "delayed"),
              QUEUE_TIMEOUT_MS,
              `queue ${name}`
            );
            return { queue: name, failed: counts.failed || 0, waiting: counts.waiting || 0, delayed: counts.delayed || 0 };
          } catch (err) {
            logger.warn("overview: queue counts unavailable", { queue: name, error: err.message });
            return { queue: name, failed: 0, waiting: 0, delayed: 0, error: "unavailable" };
          }
        })
      );
    }, []),
    safe(errors, "ops.failedWebhooks", () =>
      hasModel("WebhookDelivery") ? mongoose.model("WebhookDelivery").countDocuments({ status: "failed" }) : 0, 0),
    safe(errors, "ops.stuckSetups", () =>
      Tenant.countDocuments({ "setupStatus.status": "in_progress", "setupStatus.startedAt": { $lt: new Date(Date.now() - STUCK_SETUP_MS) } }), 0),
    safe(errors, "ops.failedSetups", () => Tenant.countDocuments({ "setupStatus.status": "failed", deletedAt: null }), 0),
    safe(errors, "ops.domainProblems", () =>
      mongoose.model("Domain").countDocuments({ status: { $in: [DOMAIN_STATUSES.SSL_FAILED, DOMAIN_STATUSES.DNS_MISCONFIGURED] } }), 0),
    safe(errors, "ops.overdueStatements", () =>
      hasModel("BillingStatement") ? mongoose.model("BillingStatement").countDocuments({ status: "overdue" }) : 0, 0),
  ]);
  const failedJobs = failedJobsByQueue.reduce((a, q) => a + (q.failed || 0), 0);
  const queueBacklog = failedJobsByQueue.reduce((a, q) => a + (q.waiting || 0) + (q.delayed || 0), 0);
  const queuesUnavailable = failedJobsByQueue.filter((q) => q.error).length;
  return { failedJobs, queueBacklog, queuesUnavailable, failedJobsByQueue, failedWebhooks, stuckSetups, failedSetups, domainProblems, overdueStatements };
}

// ─── Alerts (pure) ──────────────────────────────────────────────────────────

/**
 * Derive the actionable alert list from the operations/revenue numbers.
 * Pure so it is unit-testable; only non-zero conditions produce an alert.
 * Ordered critical → warning → info.
 */
export function deriveAlerts({ operations = {}, revenue = {}, platform = {} } = {}) {
  const alerts = [];
  const push = (severity, title, count, href) => {
    if (!count) return;
    alerts.push({ severity, title, count, href });
  };
  const ops = operations;
  push("critical", "Queues unavailable (Redis)", ops.queuesUnavailable, "/queues");
  push("critical", "Stores with failed setup", ops.failedSetups, "/tenants?setup=failed");
  push("critical", "Failed background jobs", ops.failedJobs,
    `/queues?queue=${(ops.failedJobsByQueue || []).find((q) => q.failed > 0)?.queue || ""}`);
  push("warning", "Stores stuck in setup > 15 min", ops.stuckSetups, "/tenants?setup=in_progress");
  push("warning", "Domains with SSL/DNS problems", ops.domainProblems, "/tenants");
  push("warning", "Failed webhook deliveries", ops.failedWebhooks, "/tenants");
  push("warning", "Overdue billing statements", revenue.overdueStatements, "/billing?status=overdue");
  push("info", "Queue backlog (waiting + delayed jobs)", ops.queueBacklog, "/queues");
  push("info", "Suspended stores", platform.suspended, "/tenants?lifecycle=suspended");
  const rank = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ─── Entry point ────────────────────────────────────────────────────────────

export async function getOverviewSummary({ force = false } = {}) {
  const now = Date.now();
  const fresh = cache.data && now - cache.at < CACHE_TTL_MS;
  const forceAllowed = force && now - lastForcedAt >= REFRESH_MIN_INTERVAL_MS;
  if (cache.data && fresh && !forceAllowed) return cache.data;
  if (force && forceAllowed) lastForcedAt = now;
  const errors = [];
  const [platform, commerce, revenue, operations] = await Promise.all([
    platformMetrics(errors),
    commerceMetrics(errors),
    revenueMetrics(errors),
    operationsMetrics(errors),
  ]);
  const data = {
    platform,
    commerce,
    revenue,
    operations,
    alerts: deriveAlerts({ operations, revenue, platform }),
    errors,
    generatedAt: new Date().toISOString(),
    cacheTtlSeconds: CACHE_TTL_MS / 1000,
  };
  cache = { data, at: Date.now() };
  return data;
}

export function invalidateOverviewCache() {
  cache = { data: null, at: 0 };
  lastForcedAt = 0;
}

/**
 * Strip billing figures for operators without billing.read. Pure: returns a
 * new object; the shared cache entry is never mutated.
 */
export function redactRevenue(summary) {
  if (!summary) return summary;
  return {
    ...summary,
    revenue: null,
    alerts: (summary.alerts || []).filter((a) => a.href !== "/billing?status=overdue"),
  };
}
