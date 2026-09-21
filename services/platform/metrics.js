/**
 * Helpers shared by the platform Overview and Analytics services so the two
 * pages compute the same figures the same way (MRR in particular).
 */
import mongoose from "mongoose";
import logger from "../../utils/logger.js";
import { round2 } from "./analyticsSeries.js";

export { round2 };

export const DEFAULT_CURRENCY = "SDG";
export const AGG_OPTS = { allowDiskUse: true };

/**
 * Run one metric; on failure log server-side, push an opaque marker into
 * `errors` and return `fallback`. Driver/Redis messages can leak topology or
 * credentials, so the client only ever sees "unavailable".
 */
export async function safe(errors, key, fn, fallback, scope = "metrics") {
  try {
    return await fn();
  } catch (err) {
    logger.warn(`${scope}: metric unavailable`, { metric: key, error: err?.message || String(err) });
    errors.push({ metric: key, error: "unavailable" });
    return fallback;
  }
}

/** Orders that never count as commerce activity (not real orders). */
export const EXCLUDED_ORDER_STATUSES = ["Draft", "Archived"];

export function hasModel(name) {
  return mongoose.modelNames().includes(name);
}

/** Tenant base currency expression (settings.currencies.base → settings.currency → SDG). */
export const TENANT_CURRENCY_EXPR = {
  $ifNull: ["$settings.currencies.base", { $ifNull: ["$settings.currency", DEFAULT_CURRENCY] }],
};

/**
 * Base currency of each tenant id → Map<idString, currency>. One query for
 * the whole set; used to resolve orders written before `baseCurrency` was
 * stamped on them.
 */
export async function tenantBaseCurrencyMap(ids) {
  const map = new Map();
  if (!ids.length) return map;
  const rows = await mongoose.model("Tenant").aggregate(
    [{ $match: { _id: { $in: ids } } }, { $project: { c: TENANT_CURRENCY_EXPR } }],
    AGG_OPTS
  );
  for (const r of rows) map.set(String(r._id), r.c || DEFAULT_CURRENCY);
  return map;
}

/**
 * One row per tenant on a plan with a base fee: `{ _id, createdAt, currency,
 * monthly }`. Yearly plans contribute 1/12. Limited to active tenants
 * `isActive: true` stores that are not suspended/cancelled — the definition
 * both Overview and Analytics use.
 */
export async function mrrTenantRows() {
  const match = { deletedAt: null, isActive: true, subscriptionStatus: { $nin: ["suspended", "cancelled"] } };
  return mongoose.model("Tenant").aggregate(
    [
      { $match: match },
      { $lookup: { from: "subscriptionplans", localField: "subscriptionPlan", foreignField: "key", as: "plan" } },
      { $unwind: "$plan" },
      {
        $project: {
          createdAt: 1,
          currency: { $ifNull: ["$plan.pricing.baseFee.currency", { $ifNull: ["$plan.currency", DEFAULT_CURRENCY] }] },
          amount: { $ifNull: ["$plan.pricing.baseFee.amount", { $ifNull: ["$plan.price", 0] }] },
          interval: { $ifNull: ["$plan.pricing.baseFee.interval", { $ifNull: ["$plan.interval", "month"] }] },
        },
      },
      { $project: { createdAt: 1, currency: 1, monthly: { $cond: [{ $eq: ["$interval", "year"] }, { $divide: ["$amount", 12] }, "$amount"] } } },
      { $match: { monthly: { $gt: 0 } } },
    ],
    AGG_OPTS
  );
}

/** Current MRR per currency: `[{ currency, mrr, stores }]`, largest first. */
export async function mrrByCurrency() {
  const rows = await mrrTenantRows();
  return groupMrr(rows);
}

export function groupMrr(rows) {
  const by = {};
  for (const r of rows) {
    by[r.currency] = by[r.currency] || { currency: r.currency, mrr: 0, stores: 0 };
    by[r.currency].mrr += r.monthly;
    by[r.currency].stores += 1;
  }
  return Object.values(by)
    .map((r) => ({ ...r, mrr: round2(r.mrr) }))
    .sort((a, b) => b.mrr - a.mrr);
}
