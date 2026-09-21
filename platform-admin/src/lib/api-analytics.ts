import { http } from './api';

/**
 * Typed client for /api/platform/analytics. All series are aligned to the
 * full bucket list (zero-filled); money is per currency, never summed across.
 */
export type Granularity = 'day' | 'week' | 'month';
export const GRANULARITIES: readonly Granularity[] = ['day', 'week', 'month'] as const;

export interface RangeQuery {
  from?: string; // ISO date
  to?: string;
  granularity?: Granularity;
}
export interface RangeInfo {
  from: string;
  to: string;
  granularity: Granularity;
  currency?: string | null;
}
export interface MetricError {
  metric: string;
  error: string;
}

export interface PlatformPoint {
  key: string;
  created: number;
  activated: number;
  closed: number;
  suspended: number;
}
export interface Cohort {
  cohort: string;
  size: number;
  activated: number;
  retained: (number | null)[];
  retainedPct: (number | null)[];
}
export interface PlatformAnalytics {
  range: RangeInfo;
  series: PlatformPoint[];
  totals: { created: number; activated: number; closed: number; suspended: number };
  planDistribution: { plans: { planKey: string; name: string; family: string; stores: number }[]; byFamily: { family: string; stores: number }[] };
  lifecycleDistribution: { state: string; stores: number }[];
  cohorts: Cohort[];
  errors: MetricError[];
  generatedAt: string;
}

export interface CommercePoint {
  key: string;
  orders: number;
  gmv: number;
  aov: number;
}
export interface CommerceCurrency {
  currency: string;
  series: CommercePoint[];
  totals: { orders: number; gmv: number; aov: number };
}
export interface CommerceAnalytics {
  range: RangeInfo;
  byCurrency: CommerceCurrency[];
  outcomes: { total: number; paid: number; cancelled: number; refunded: number };
  topStores: { tenantId: string; name: string; slug?: string; orders: number; gmv: number; currency: string }[];
  errors: MetricError[];
  generatedAt: string;
}

export interface RevenueAnalytics {
  range: RangeInfo;
  available: boolean;
  mrr: {
    approximation: string;
    byCurrency: { currency: string; series: { key: string; mrr: number; stores: number }[]; current: { mrr: number; stores: number } }[];
  };
  commissionByCurrency: { currency: string; series: { key: string; amount: number; events: number }[]; total: number }[];
  statements: { key: string; issued: number; paid: number; partially_paid: number; overdue: number; waived: number; void: number }[];
  errors: MetricError[];
  generatedAt: string;
}

export type UsageMetric = 'products' | 'staff' | 'ordersThisMonth' | 'storageMB';
export interface HistogramBucket {
  label: string;
  min: number;
  max: number | null;
  count: number;
}
export interface UsageAnalytics {
  range: { from: string; to: string };
  available: boolean;
  tenants: number;
  snapshotAsOf: string | null;
  totals: Partial<Record<UsageMetric, number>>;
  distributions: Partial<Record<UsageMetric, HistogramBucket[]>>;
  top: Partial<Record<UsageMetric, { tenantId: string; name: string; slug?: string; value: number }[]>>;
  errors: MetricError[];
  generatedAt: string;
}

const clean = (q: object) =>
  Object.fromEntries(Object.entries(q as Record<string, string | undefined>).filter(([, v]) => v != null && v !== ''));

export const analyticsApi = {
  platform: async (q: RangeQuery = {}) => {
    const res = await http.get('/analytics/platform', { params: clean(q) });
    return res.data.data as PlatformAnalytics;
  },
  commerce: async (q: RangeQuery & { currency?: string } = {}) => {
    const res = await http.get('/analytics/commerce', { params: clean(q) });
    return res.data.data as CommerceAnalytics;
  },
  revenue: async (q: RangeQuery = {}) => {
    const res = await http.get('/analytics/revenue', { params: clean(q) });
    return res.data.data as RevenueAnalytics;
  },
  usage: async (q: RangeQuery = {}) => {
    const res = await http.get('/analytics/usage', { params: clean(q) });
    return res.data.data as UsageAnalytics;
  },
};
