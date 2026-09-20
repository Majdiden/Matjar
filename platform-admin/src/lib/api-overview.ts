import { http } from './api';

export interface CurrencyRow {
  currency: string;
  gmv?: number;
  orders?: number;
  aov?: number;
  mrr?: number;
  stores?: number;
  amount?: number;
  events?: number;
  count?: number;
}

export interface OverviewAlert {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  count: number;
  href: string;
}

export interface OverviewSummary {
  platform: {
    total: number;
    active: number;
    onboarding: number;
    pending: number;
    suspended: number;
    closed: number;
    archived: number;
    new7d: number;
    new30d: number;
    usersTotal: number;
  };
  commerce: {
    ordersToday: number;
    orders7d: number;
    orders30d: number;
    pending: number;
    cancelled30d: number;
    refunded30d: number;
    gmv30dByCurrency: CurrencyRow[];
  };
  /** null when the operator lacks billing.read */
  revenue: null | {
    available: boolean;
    mrrByCurrency: CurrencyRow[];
    commissionThisPeriodByCurrency: CurrencyRow[];
    overdueStatements: number;
    overdueByCurrency: CurrencyRow[];
    trialStores: number;
  };
  operations: {
    failedJobs: number;
    queueBacklog: number;
    queuesUnavailable: number;
    failedJobsByQueue: Array<{ queue: string; failed: number; waiting: number; delayed: number; error?: string }>;
    failedWebhooks: number;
    stuckSetups: number;
    failedSetups: number;
    domainProblems: number;
    overdueStatements: number;
  };
  alerts: OverviewAlert[];
  errors: Array<{ metric: string; error: string }>;
  generatedAt: string;
  cacheTtlSeconds: number;
}

export const overviewApi = {
  summary: async (refresh = false) => {
    const res = await http.get('/overview/summary', { params: refresh ? { refresh: 1 } : undefined });
    return res.data.data as OverviewSummary;
  },
};
