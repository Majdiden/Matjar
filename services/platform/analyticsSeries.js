/**
 * Pure helpers for platform analytics: time bucketing, series alignment,
 * cohort retention maths and histogram buckets. No DB, no dates from the
 * system clock (callers pass them in) — so everything here is unit-testable.
 *
 * All bucket keys are UTC ISO date strings: "YYYY-MM-DD" for day buckets,
 * the Monday "YYYY-MM-DD" for week buckets, "YYYY-MM" for month buckets.
 */

const DAY_MS = 24 * 3600 * 1000;

function utcStartOfDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Monday 00:00 UTC of the week containing `d`. */
function utcStartOfWeek(d) {
  const day = utcStartOfDay(d);
  const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - dow * DAY_MS);
}

function utcStartOfMonth(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function bucketStart(date, granularity) {
  const d = new Date(date);
  if (granularity === "month") return utcStartOfMonth(d);
  if (granularity === "week") return utcStartOfWeek(d);
  return utcStartOfDay(d);
}

export function bucketKey(date, granularity) {
  const start = bucketStart(date, granularity);
  const iso = start.toISOString();
  return granularity === "month" ? iso.slice(0, 7) : iso.slice(0, 10);
}

function nextBucket(start, granularity) {
  if (granularity === "month") return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  if (granularity === "week") return new Date(start.getTime() + 7 * DAY_MS);
  return new Date(start.getTime() + DAY_MS);
}

/**
 * Every bucket key from `from` to `to` inclusive, in order. Bounded by the
 * validator's 400-day range (≤ 401 day buckets).
 */
export function bucketKeys(from, to, granularity) {
  const keys = [];
  let cursor = bucketStart(from, granularity);
  const end = bucketStart(to, granularity);
  while (cursor <= end) {
    keys.push(bucketKey(cursor, granularity));
    cursor = nextBucket(cursor, granularity);
  }
  return keys;
}

/**
 * The Mongo `$dateToString` format that produces the same keys as
 * `bucketKey`, for grouping inside an aggregation. Week keys are derived
 * from `$dateTrunc` (unit: week, startOfWeek: monday) by the caller.
 */
export function mongoDateFormat(granularity) {
  return granularity === "month" ? "%Y-%m" : "%Y-%m-%d";
}

/**
 * Align sparse `{ key, ...values }` rows onto the full bucket list, filling
 * missing buckets with `zero`. Returns `[{ key, ...values }]` in order.
 */
export function alignSeries(keys, rows, valueFields, zero = 0) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return keys.map((key) => {
    const r = byKey.get(key) || {};
    const out = { key };
    for (const f of valueFields) out[f] = r[f] ?? zero;
    return out;
  });
}

/**
 * Month key `n` months after `monthKey` ("YYYY-MM").
 */
export function addMonths(monthKey, n) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Cohort retention. `stores` is `[{ createdMonth: "YYYY-MM", activeUntil: Date|null, everActive: boolean }]`
 * where `activeUntil` is when the store stopped being active (closed/
 * archived/suspended) or null if still active. A store counts as retained at
 * month +k if it was ever activated and was still active at the START of
 * month (cohort + k). Only the last `maxCohorts` cohorts (by month) are
 * returned, oldest first; months with no stores are omitted.
 *
 * Returns `[{ cohort, size, activated, retained: [m1, m2, m3], retainedPct: [..] }]`.
 */
export function cohortRetention(stores, { now, maxCohorts = 12, horizons = [1, 2, 3] } = {}) {
  const nowKey = now.toISOString().slice(0, 7);
  const cohorts = new Map();
  for (const s of stores) {
    if (!cohorts.has(s.createdMonth)) cohorts.set(s.createdMonth, []);
    cohorts.get(s.createdMonth).push(s);
  }
  const keys = [...cohorts.keys()].sort().slice(-maxCohorts);
  return keys.map((cohort) => {
    const members = cohorts.get(cohort);
    const activated = members.filter((s) => s.everActive).length;
    const retained = horizons.map((k) => {
      const horizonKey = addMonths(cohort, k);
      // A horizon that has not fully elapsed yet is reported as null.
      if (horizonKey > nowKey) return null;
      // Retained at +k means still active at the START of month (cohort + k)
      // (i.e. survived the whole of month cohort + k - 1).
      const [hy, hm] = horizonKey.split("-").map(Number);
      const horizonStart = new Date(Date.UTC(hy, hm - 1, 1));
      return members.filter((s) => s.everActive && (!s.activeUntil || new Date(s.activeUntil) >= horizonStart)).length;
    });
    return {
      cohort,
      size: members.length,
      activated,
      retained,
      retainedPct: retained.map((r) => (r == null || !activated ? null : Math.round((r / activated) * 1000) / 10)),
    };
  });
}

/**
 * Histogram of numeric values into the given ascending edges. The last bucket
 * is open-ended. Returns `[{ label, min, max, count }]`.
 */
export function histogram(values, edges) {
  const buckets = edges.map((min, i) => ({ min, max: edges[i + 1] ?? null, count: 0 }));
  for (const v of values) {
    const n = Number(v) || 0;
    let idx = buckets.length - 1;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].max == null || n < buckets[i].max) {
        idx = i;
        break;
      }
    }
    buckets[idx].count += 1;
  }
  return buckets.map((b) => ({
    label: b.max == null ? `${b.min}+` : b.max - b.min === 1 ? `${b.min}` : `${b.min}–${b.max - 1}`,
    min: b.min,
    max: b.max,
    count: b.count,
  }));
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
