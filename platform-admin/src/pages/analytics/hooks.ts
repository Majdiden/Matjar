import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GRANULARITIES, type Granularity, type RangeQuery } from '../../lib/api-analytics';
import { formatAmount } from '../../lib/api-billing';
import { allowed } from '../../lib/list-helpers';
import { PLATFORM_SCOPES } from '../../lib/api';

// ─── Range (URL-synced, validated) ─────────────────────────────────────────

export const DAY = 24 * 3600 * 1000;
// The API allows 400 days and treats a date-only `to` as the end of that day,
// so the widest date-only window the client may send is 399 days.
const MAX_RANGE_DAYS = 399;
export const ISO_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const toDay = (d: Date) => d.toISOString().slice(0, 10);
const defaultFrom = () => toDay(new Date(Date.now() - 30 * DAY));
export const defaultTo = () => toDay(new Date());

export interface Range {
  from: string;
  to: string;
  granularity: Granularity;
}

/** Parse + validate the range from the URL; invalid values fall back silently. */
export function useRange(): [Range, (patch: Partial<Range>) => void] {
  const [sp, setSp] = useSearchParams();
  const range = useMemo<Range>(() => {
    let from = sp.get('from') || '';
    let to = sp.get('to') || '';
    if (!ISO_DAY.test(from)) from = defaultFrom();
    if (!ISO_DAY.test(to)) to = defaultTo();
    if (from > to) [from, to] = [to, from];
    const span = (new Date(to).getTime() - new Date(from).getTime()) / DAY;
    if (span > MAX_RANGE_DAYS) from = toDay(new Date(new Date(to).getTime() - MAX_RANGE_DAYS * DAY));
    const granularity = (allowed(sp.get('granularity'), GRANULARITIES) || (span > 120 ? 'month' : span > 35 ? 'week' : 'day')) as Granularity;
    return { from, to, granularity };
  }, [sp]);
  const update = useCallback(
    (patch: Partial<Range>) => {
      const next = new URLSearchParams(sp);
      for (const [k, v] of Object.entries({ ...range, ...patch })) next.set(k, v);
      setSp(next, { replace: true });
    },
    [sp, setSp, range],
  );
  return [range, update];
}

// ─── Sub-navigation between the four analytics pages ───────────────────────

export const ANALYTICS_TABS: { to: string; label: string; scope?: (typeof PLATFORM_SCOPES)[keyof typeof PLATFORM_SCOPES] }[] = [
  { to: '/analytics/platform', label: 'Platform' },
  { to: '/analytics/commerce', label: 'Commerce' },
  { to: '/analytics/revenue', label: 'Revenue', scope: PLATFORM_SCOPES.BILLING_READ },
  { to: '/analytics/usage', label: 'Usage' },
];

export const money = (amount: number, currency: string) => formatAmount(amount, currency);

/** Fetch hook shared by the four pages: reloads when the range changes. `enabled: false` never fires the request. */
export function useAnalytics<T>(fetcher: (q: RangeQuery) => Promise<T>, range: Range, extra: Record<string, string | undefined> = {}, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const extraKey = JSON.stringify(extra);
  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher({ from: range.from, to: range.to, granularity: range.granularity, ...(JSON.parse(extraKey) as Record<string, string>) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [fetcher, range.from, range.to, range.granularity, extraKey, enabled]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, loading, error, reload: load };
}

export const formatKey = (key: string) => (key.length === 7 ? key : key.slice(5));
