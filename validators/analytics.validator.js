import { z } from "zod";

/**
 * Zod schemas for the platform analytics endpoints. Every range is bounded
 * (≤ 400 days) so a single request can never scan years of orders, and the
 * granularity is an enum the bucketing helper understands.
 */
export const MAX_RANGE_DAYS = 400;
export const GRANULARITIES = ["day", "week", "month"];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = z.coerce.date();
// A date-only `to` (what the admin UI sends) means "through the end of that
// UTC day", not midnight at its start — otherwise today's orders vanish.
const isoDateEnd = z.preprocess((v) => (typeof v === "string" && DATE_ONLY.test(v) ? `${v}T23:59:59.999Z` : v), z.coerce.date());
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);

const rangeQuery = z
  .object({
    from: isoDate.optional(),
    to: isoDateEnd.optional(),
    granularity: z.enum(GRANULARITIES).default("day"),
  })
  .transform((q) => {
    // Default window: last 30 days ending now, floored to the minute so
    // back-to-back default requests share one cache entry.
    const to = q.to ?? new Date(Math.floor(Date.now() / 60000) * 60000);
    const from = q.from ?? new Date(to.getTime() - 30 * 24 * 3600 * 1000);
    return { ...q, from, to };
  })
  .refine((q) => q.from <= q.to, { message: "from must be before to" })
  .refine((q) => (q.to - q.from) / 86400000 <= MAX_RANGE_DAYS, {
    message: `Range must be at most ${MAX_RANGE_DAYS} days`,
  });

export const platformAnalyticsSchema = z.object({ query: rangeQuery });
export const revenueAnalyticsSchema = z.object({ query: rangeQuery });
export const commerceAnalyticsSchema = z.object({
  query: rangeQuery.and(z.object({ currency: currency.optional() })),
});
// Usage analytics reads the latest snapshot per tenant; the range is accepted
// for API symmetry but only bounds which snapshots are considered "latest".
export const usageAnalyticsSchema = z.object({ query: rangeQuery });
