/**
 * Platform analytics (admin console → Analytics).
 *
 * Aggregates over the shared collections, bounded by the validator (≤ 400
 * days) and always matched on indexed fields (createdAt / occurredAt /
 * periodKey / tenantId). Results are cached in-process for CACHE_TTL_MS keyed
 * on the exact query so the operator can flip between pages on a phone
 * without re-running the pipelines.
 *
 * Aggregates only — counts and sums per bucket / per currency. No per-tenant
 * PII leaves this module (top-store lists carry name + slug + count only).
 * Money is never summed across currencies (decision 2 in the plan).
 *
 * Every metric group is fail-soft (see `safe`): one broken pipeline blanks
 * that group and lands in `errors[]`, never the whole page.
 */
import mongoose from "mongoose";
import { bucketKeys, bucketKey, alignSeries, mongoDateFormat, cohortRetention, histogram } from "./analyticsSeries.js";
import { AGG_OPTS as aggOpts, DEFAULT_CURRENCY, EXCLUDED_ORDER_STATUSES, groupMrr, hasModel, mrrTenantRows, round2, safe as safeMetric, tenantBaseCurrencyMap } from "./metrics.js";

export const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE = 64;
const TOP_N = 10;

const cache = new Map();

function cacheKey(kind, q) {
  const currency = kind === "commerce" ? q.currency || "" : "";
  return `${kind}|${q.from.toISOString()}|${q.to.toISOString()}|${q.granularity}|${currency}`;
}
function cached(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  return null;
}
function remember(key, data) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, { data, at: Date.now() });
  return data;
}
const safe = (errors, key, fn, fallback) => safeMetric(errors, key, fn, fallback, "analytics");

/**
 * `$group` id expression that yields the same bucket key as `bucketKey()`.
 * Weeks truncate to the Monday first so `%Y-%m-%d` of the truncated date is
 * the week key.
 */
function bucketExpr(field, granularity) {
  const date =
    granularity === "week"
      ? { $dateTrunc: { date: `$${field}`, unit: "week", startOfWeek: "monday", timezone: "UTC" } }
      : `$${field}`;
  return { $dateToString: { format: mongoDateFormat(granularity), date, timezone: "UTC" } };
}

// ─── Platform (stores) ─────────────────────────────────────────────────────

export async function getPlatformAnalytics(q) {
  const key = cacheKey("platform", q);
  const hit = cached(key);
  if (hit) return hit;

  const errors = [];
  const keys = bucketKeys(q.from, q.to, q.granularity);
  const Tenant = mongoose.model("Tenant");
  const range = { $gte: q.from, $lte: q.to };

  const [created, transitions, planDistribution, lifecycleDistribution, cohorts] = await Promise.all([
    safe(errors, "platform.created", async () => {
      const rows = await Tenant.aggregate(
        [{ $match: { createdAt: range } }, { $group: { _id: bucketExpr("createdAt", q.granularity), n: { $sum: 1 } } }],
        aggOpts
      );
      return rows.map((r) => ({ key: r._id, created: r.n }));
    }, []),
    safe(errors, "platform.transitions", async () => {
      // Activation / closure events come from the lifecycle history array.
      const rows = await Tenant.aggregate(
        [
          { $match: { "lifecycle.history.changedAt": range } },
          { $project: { history: "$lifecycle.history" } },
          { $unwind: "$history" },
          { $match: { "history.changedAt": range, "history.state": { $in: ["active", "closed", "suspended"] } } },
          {
            $group: {
              _id: { bucket: bucketExpr("history.changedAt", q.granularity), state: "$history.state" },
              n: { $sum: 1 },
            },
          },
        ],
        aggOpts
      );
      const byKey = {};
      for (const r of rows) {
        const k = r._id.bucket;
        byKey[k] = byKey[k] || { key: k, activated: 0, closed: 0, suspended: 0 };
        if (r._id.state === "active") byKey[k].activated += r.n;
        else if (r._id.state === "suspended") byKey[k].suspended += r.n;
        else if (r._id.state === "closed") byKey[k].closed += r.n;
        // "archived" always follows "closed" for the same store, so counting
        // it too would count one closure twice.
      }
      return Object.values(byKey);
    }, []),
    safe(errors, "platform.plans", async () => {
      const rows = await Tenant.aggregate(
        [
          { $match: { deletedAt: null } },
          { $group: { _id: "$subscriptionPlan", stores: { $sum: 1 } } },
          { $lookup: { from: "subscriptionplans", localField: "_id", foreignField: "key", as: "plan" } },
          { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, planKey: "$_id", name: { $ifNull: ["$plan.name", "$_id"] }, family: { $ifNull: ["$plan.family", "unknown"] }, stores: 1 } },
          { $sort: { stores: -1 } },
        ],
        aggOpts
      );
      const byFamily = {};
      for (const r of rows) byFamily[r.family] = (byFamily[r.family] || 0) + r.stores;
      return { plans: rows, byFamily: Object.entries(byFamily).map(([family, stores]) => ({ family, stores })) };
    }, { plans: [], byFamily: [] }),
    safe(errors, "platform.lifecycle", async () => {
      const rows = await Tenant.aggregate(
        [{ $group: { _id: { $ifNull: ["$lifecycle.state", "legacy"] }, n: { $sum: 1 } } }],
        aggOpts
      );
      return rows.map((r) => ({ state: r._id, stores: r.n })).sort((a, b) => b.stores - a.stores);
    }, []),
    safe(errors, "platform.cohorts", async () => {
      // Last 12 creation months: when did each store first become active and
      // when (if ever) did it stop. Bounded: only tenants created in the window.
      // Simplification: a store is "active until" its LAST stop event; a gap
      // (suspended → reactivated → still active) is treated as continuously
      // active, and a store stopped and later reactivated counts until the
      // later stop only. Good enough for a retention table.
      const since = new Date(Date.UTC(q.to.getUTCFullYear(), q.to.getUTCMonth() - 12, 1));
      const rows = await Tenant.aggregate(
        [
          { $match: { createdAt: { $gte: since, $lte: q.to } } },
          {
            $project: {
              createdAt: 1,
              currentState: "$lifecycle.state",
              deletedAt: 1,
              deletionScheduledAt: 1,
              suspendedAt: 1,
              setupDone: { $eq: ["$setupStatus.status", "completed"] },
              activeAt: {
                $min: {
                  $map: {
                    input: { $filter: { input: { $ifNull: ["$lifecycle.history", []] }, as: "h", cond: { $eq: ["$$h.state", "active"] } } },
                    as: "h",
                    in: "$$h.changedAt",
                  },
                },
              },
              stoppedAt: {
                $max: {
                  $map: {
                    input: {
                      $filter: {
                        input: { $ifNull: ["$lifecycle.history", []] },
                        as: "h",
                        cond: { $in: ["$$h.state", ["closed", "archived", "suspended"]] },
                      },
                    },
                    as: "h",
                    in: "$$h.changedAt",
                  },
                },
              },
            },
          },
        ],
        aggOpts
      );
      const stores = rows.map((r) => {
        const everActive = !!r.activeAt || r.currentState === "active" || (!r.currentState && r.setupDone && !r.deletedAt);
        const stillActive = r.currentState === "active" || (!r.currentState && !r.deletedAt && !r.deletionScheduledAt && !r.suspendedAt);
        const activeUntil = stillActive ? null : r.stoppedAt || r.deletedAt || r.deletionScheduledAt || r.suspendedAt || null;
        return { createdMonth: bucketKey(r.createdAt, "month"), everActive, activeUntil };
      });
      return cohortRetention(stores, { now: q.to, maxCohorts: 12 });
    }, []),
  ]);

  const series = alignSeries(keys, mergeSeries(created, transitions), ["created", "activated", "closed", "suspended"]);
  return remember(key, {
    range: { from: q.from, to: q.to, granularity: q.granularity },
    series,
    totals: sumSeries(series, ["created", "activated", "closed", "suspended"]),
    planDistribution,
    lifecycleDistribution,
    cohorts,
    errors,
    generatedAt: new Date().toISOString(),
  });
}

function mergeSeries(...lists) {
  const byKey = new Map();
  for (const list of lists) for (const r of list) byKey.set(r.key, { ...(byKey.get(r.key) || {}), ...r });
  return [...byKey.values()];
}
function sumSeries(series, fields) {
  const out = {};
  for (const f of fields) out[f] = series.reduce((a, r) => a + (Number(r[f]) || 0), 0);
  return out;
}

// ─── Commerce ──────────────────────────────────────────────────────────────

export async function getCommerceAnalytics(q) {
  const key = cacheKey("commerce", q);
  const hit = cached(key);
  if (hit) return hit;

  const errors = [];
  const keys = bucketKeys(q.from, q.to, q.granularity);
  const Order = mongoose.model("Order");
  const base = { status: { $nin: EXCLUDED_ORDER_STATUSES }, createdAt: { $gte: q.from, $lte: q.to } };
  const sold = { ...base, status: { $nin: [...EXCLUDED_ORDER_STATUSES, "Cancelled"] } };

  const [byBucket, outcomes, topStores] = await Promise.all([
    safe(errors, "commerce.series", async () => {
      // Group by (bucket, order currency). Orders written before
      // `baseCurrency` was stamped fall back to the tenant's base currency,
      // resolved once per tenant afterwards — never per tenant×bucket.
      const rows = await Order.aggregate(
        [
          { $match: sold },
          {
            $group: {
              _id: { bucket: bucketExpr("createdAt", q.granularity), currency: "$baseCurrency", tenantId: { $cond: [{ $ifNull: ["$baseCurrency", false] }, null, "$tenantId"] } },
              orders: { $sum: 1 },
              gmv: { $sum: { $ifNull: ["$totalAmount", 0] } },
            },
          },
        ],
        aggOpts
      );
      const fallback = await tenantBaseCurrencyMap([...new Set(rows.filter((r) => r._id.tenantId).map((r) => r._id.tenantId))]);
      const byCurrency = {};
      for (const r of rows) {
        const currency = r._id.currency || fallback.get(String(r._id.tenantId)) || DEFAULT_CURRENCY;
        if (q.currency && currency !== q.currency) continue;
        const buckets = (byCurrency[currency] = byCurrency[currency] || {});
        const b = (buckets[r._id.bucket] = buckets[r._id.bucket] || { key: r._id.bucket, orders: 0, gmv: 0 });
        b.orders += r.orders;
        b.gmv += r.gmv;
      }
      return Object.entries(byCurrency)
        .map(([currency, buckets]) => {
          const raw = Object.values(buckets);
          const orders = raw.reduce((a, r) => a + r.orders, 0);
          const gmv = raw.reduce((a, r) => a + r.gmv, 0);
          const series = raw.map((r) => ({ key: r.key, orders: r.orders, gmv: round2(r.gmv), aov: r.orders ? round2(r.gmv / r.orders) : 0 }));
          return { currency, series: alignSeries(keys, series, ["orders", "gmv", "aov"]), totals: { orders, gmv: round2(gmv), aov: orders ? round2(gmv / orders) : 0 } };
        })
        .sort((a, b) => b.totals.orders - a.totals.orders);
    }, []),
    safe(errors, "commerce.outcomes", async () => {
      const [paid, cancelled, refunded, total] = await Promise.all([
        Order.countDocuments({ ...base, paymentStatus: "Paid" }),
        Order.countDocuments({ ...base, status: "Cancelled" }),
        Order.countDocuments({ ...base, paymentStatus: { $in: ["Refunded", "Partially Refunded"] } }),
        Order.countDocuments(base),
      ]);
      return { total, paid, cancelled, refunded };
    }, { total: 0, paid: 0, cancelled: 0, refunded: 0 }),
    safe(errors, "commerce.topStores", async () => {
      // Top N stores by orders; GMV per (store, currency) so a store whose
      // base currency changed mid-range is never summed across currencies.
      const rows = await Order.aggregate(
        [
          { $match: sold },
          { $group: { _id: { tenantId: "$tenantId", currency: "$baseCurrency" }, orders: { $sum: 1 }, gmv: { $sum: { $ifNull: ["$totalAmount", 0] } } } },
          { $sort: { orders: -1 } },
          { $limit: TOP_N },
          { $lookup: { from: "tenants", localField: "_id.tenantId", foreignField: "_id", as: "tenant", pipeline: [{ $project: { name: 1, slug: 1 } }] } },
          { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, tenantId: "$_id.tenantId", currency: "$_id.currency", name: { $ifNull: ["$tenant.name", "—"] }, slug: "$tenant.slug", orders: 1, gmv: 1 } },
        ],
        aggOpts
      );
      const fallback = await tenantBaseCurrencyMap([...new Set(rows.filter((r) => !r.currency).map((r) => r.tenantId))]);
      return rows.map((r) => ({ ...r, currency: r.currency || fallback.get(String(r.tenantId)) || DEFAULT_CURRENCY, gmv: round2(r.gmv) }));
    }, []),
  ]);

  return remember(key, {
    range: { from: q.from, to: q.to, granularity: q.granularity, currency: q.currency || null },
    byCurrency: byBucket,
    outcomes,
    topStores,
    errors,
    generatedAt: new Date().toISOString(),
  });
}

// ─── Revenue (platform billing) ────────────────────────────────────────────

/**
 * MRR approximation: the CURRENT plan assignment of every active tenant
 * (same definition as Overview, see metrics.mrrTenantRows) is treated as having been in force for every bucket in which the tenant
 * already existed (createdAt ≤ bucket end). Plan changes inside the window
 * are not replayed (PlanChange history exists but replaying it per bucket is
 * not worth the cost at this scale) — the series therefore shows how today's
 * subscription base would have looked, not historical MRR. Commission and
 * statement figures are exact (ledger rows).
 */
export async function getRevenueAnalytics(q) {
  const key = cacheKey("revenue", q);
  const hit = cached(key);
  if (hit) return hit;

  const errors = [];
  const keys = bucketKeys(q.from, q.to, q.granularity);
  const out = {
    range: { from: q.from, to: q.to, granularity: q.granularity },
    available: hasModel("PlatformFeeEvent") && hasModel("BillingStatement"),
    mrr: { approximation: "current-plan-assignment", byCurrency: [] },
    commissionByCurrency: [],
    statements: [],
    errors,
    generatedAt: new Date().toISOString(),
  };
  if (!out.available) return remember(key, out);

  const [mrrRows, commissionRows, statementRows] = await Promise.all([
    safe(errors, "revenue.mrr", async () => {
      // Same rows and same "active" definition as the Overview page.
      const rows = await mrrTenantRows();
      // Bucket ends are the start of the following bucket; a tenant counts in
      // a bucket when it was created before that bucket ended.
      const ends = keys.map((k, i) => (i + 1 < keys.length ? keys[i + 1] : null));
      const currencies = {};
      for (const t of rows) {
        const createdKey = bucketKey(t.createdAt, q.granularity);
        currencies[t.currency] = currencies[t.currency] || keys.map((k) => ({ key: k, mrr: 0, stores: 0 }));
        keys.forEach((k, i) => {
          if (createdKey <= k || (ends[i] && createdKey < ends[i])) {
            currencies[t.currency][i].mrr += t.monthly;
            currencies[t.currency][i].stores += 1;
          }
        });
      }
      const current = Object.fromEntries(groupMrr(rows).map((r) => [r.currency, r]));
      return Object.entries(currencies).map(([currency, series]) => ({
        currency,
        series: series.map((r) => ({ ...r, mrr: round2(r.mrr) })),
        current: { mrr: current[currency]?.mrr || 0, stores: current[currency]?.stores || 0 },
      }));
    }, []),
    safe(errors, "revenue.commission", async () => {
      const rows = await mongoose.model("PlatformFeeEvent").aggregate(
        [
          { $match: { occurredAt: { $gte: q.from, $lte: q.to }, type: { $in: ["commission", "reversal"] } } },
          { $group: { _id: { bucket: bucketExpr("occurredAt", q.granularity), currency: "$feeCurrency" }, amount: { $sum: "$feeAmount" }, events: { $sum: 1 } } },
        ],
        aggOpts
      );
      const currencies = {};
      for (const r of rows) {
        currencies[r._id.currency] = currencies[r._id.currency] || [];
        currencies[r._id.currency].push({ key: r._id.bucket, amount: r.amount, events: r.events });
      }
      return Object.entries(currencies).map(([currency, raw]) => ({
        currency,
        series: alignSeries(keys, raw.map((r) => ({ ...r, amount: round2(r.amount) })), ["amount", "events"]),
        total: round2(raw.reduce((a, r) => a + r.amount, 0)),
      }));
    }, []),
    safe(errors, "revenue.statements", async () => {
      // Statements are keyed by period month; bucket on periodKey → issuedAt
      // for day/week granularity we bucket on issuedAt (null → skipped).
      const rows = await mongoose.model("BillingStatement").aggregate(
        [
          { $match: { issuedAt: { $gte: q.from, $lte: q.to } } },
          { $group: { _id: { bucket: bucketExpr("issuedAt", q.granularity), status: "$status", currency: "$currency" }, n: { $sum: 1 }, amountDue: { $sum: "$amountDue" }, amountPaid: { $sum: "$amountPaid" } } },
        ],
        aggOpts
      );
      const byKey = {};
      for (const r of rows) {
        const k = r._id.bucket;
        byKey[k] = byKey[k] || { key: k, issued: 0, paid: 0, partially_paid: 0, overdue: 0, waived: 0, void: 0 };
        byKey[k].issued += r.n;
        if (byKey[k][r._id.status] != null) byKey[k][r._id.status] += r.n;
      }
      return alignSeries(keys, Object.values(byKey), ["issued", "paid", "partially_paid", "overdue", "waived", "void"]);
    }, []),
  ]);
  out.mrr.byCurrency = mrrRows;
  out.commissionByCurrency = commissionRows;
  out.statements = statementRows;
  return remember(key, out);
}

// ─── Usage ─────────────────────────────────────────────────────────────────

const USAGE_METRICS = ["products", "staff", "ordersThisMonth", "storageMB"];
const HISTOGRAM_EDGES = {
  products: [0, 10, 50, 100, 500, 1000],
  staff: [0, 1, 2, 3, 5, 10],
  ordersThisMonth: [0, 1, 10, 50, 100, 500],
  storageMB: [0, 10, 100, 500, 1000, 5000],
};

export async function getUsageAnalytics(q) {
  const key = cacheKey("usage", q);
  const hit = cached(key);
  if (hit) return hit;

  const errors = [];
  const out = {
    range: { from: q.from, to: q.to },
    available: hasModel("TenantUsageSnapshot"),
    tenants: 0,
    snapshotAsOf: null,
    totals: {},
    distributions: {},
    top: {},
    errors,
    generatedAt: new Date().toISOString(),
  };
  if (!out.available) return remember(key, out);

  const latest = await safe(errors, "usage.latest", async () => {
    // Latest snapshot per tenant taken inside the range, joined to the
    // tenant for name/slug only (top lists), never any other field.
    return mongoose.model("TenantUsageSnapshot").aggregate(
      [
        { $match: { at: { $gte: q.from, $lte: q.to } } },
        { $sort: { tenantId: 1, at: -1 } },
        { $group: { _id: "$tenantId", at: { $first: "$at" }, products: { $first: "$products" }, staff: { $first: "$staff" }, ordersThisMonth: { $first: "$ordersThisMonth" }, storageMB: { $first: "$storageMB" } } },
        { $lookup: { from: "tenants", localField: "_id", foreignField: "_id", as: "tenant", pipeline: [{ $project: { name: 1, slug: 1, deletedAt: 1 } }] } },
        { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
        { $match: { "tenant.deletedAt": null } },
        { $project: { _id: 0, tenantId: "$_id", at: 1, products: 1, staff: 1, ordersThisMonth: 1, storageMB: 1, name: "$tenant.name", slug: "$tenant.slug" } },
      ],
      aggOpts
    );
  }, []);

  out.tenants = latest.length;
  out.snapshotAsOf = latest.reduce((max, r) => (!max || r.at > max ? r.at : max), null);
  for (const m of USAGE_METRICS) {
    const values = latest.map((r) => Number(r[m]) || 0);
    out.totals[m] = round2(values.reduce((a, b) => a + b, 0));
    out.distributions[m] = histogram(values, HISTOGRAM_EDGES[m]);
    out.top[m] = [...latest]
      .sort((a, b) => (Number(b[m]) || 0) - (Number(a[m]) || 0))
      .slice(0, TOP_N)
      .filter((r) => (Number(r[m]) || 0) > 0)
      .map((r) => ({ tenantId: r.tenantId, name: r.name || "—", slug: r.slug, value: round2(r[m]) }));
  }
  return remember(key, out);
}
