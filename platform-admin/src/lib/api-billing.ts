/**
 * Billing API client (platform admin). Contract: docs/plans/billing-api.md.
 *
 * All amounts from the API are MAJOR units in the stated currency (not
 * cents) — use `formatAmount`, never `formatMoney` from ./utils.
 */
import { http } from './api';

// ---------------------------------------------------------------- types

export type PlanFamily = 'commission' | 'subscription' | 'hybrid';
export type Interval = 'month' | 'year';

export interface Money {
  amount: number;
  currency: string;
  interval?: Interval;
}

export interface CommissionTier {
  upTo: number | null;
  percent: number;
  fixedPerOrder?: number;
}

export interface CommissionPolicy {
  _id: string;
  key: string;
  name: string;
  description?: string;
  isActive: boolean;
  basis: 'gmv' | 'order_count';
  gmvScope: 'delivered' | 'paid' | 'placed';
  recognitionEvent: 'delivered' | 'paid';
  period: 'calendar_month' | 'rolling_30d' | 'lifetime';
  tierMode: 'marginal' | 'bracket';
  tiers: CommissionTier[];
  perOrder: { minFee: number | null; maxFee: number | null };
  periodCap: number | null;
  paymentMethods: 'all' | string[];
  currency: string;
  rounding: 'nearest' | 'up' | 'down';
  precision: number;
  createdAt?: string;
  updatedAt?: string;
}

export type PolicyInput = Partial<
  Omit<CommissionPolicy, '_id' | 'createdAt' | 'updatedAt'>
>;

export interface PolicyPreview {
  feeAmount: number;
  tierIndex: number;
  percentApplied: number;
  basisPolicyAmount: number | null;
  feePolicyAmount: number | null;
  fxMissing: boolean;
  capped: boolean;
  breakdown: { tier: number; amount: number; percent: number }[];
}

export interface PlanLimits {
  maxProducts?: number | null;
  maxStaff?: number | null;
  maxOrdersPerMonth?: number | null;
  maxStorageMB?: number | null;
  maxApiRequestsPerDay?: number | null;
}

export interface PlanPricing {
  baseFee: Money;
  /** Removed server-side; kept optional for old rows only. Never rendered. */
  annualFee?: { amount: number | null };
  trialDays: number;
  commissionPolicyKey: string | null;
}

export interface PlanSwitching {
  allowSelfService: boolean;
  minimumTermDays: number;
}

export interface Plan {
  _id: string;
  key: string;
  name: string;
  description?: string;
  family: PlanFamily;
  pricing: PlanPricing;
  limits?: PlanLimits;
  entitlements?: string[];
  switching?: PlanSwitching;
  // Legacy mirror fields (still returned).
  price?: number;
  currency?: string;
  interval?: Interval;
  features?: string[];
  isActive: boolean;
  sortOrder: number;
  /** Tenants currently assigned to this plan (server-computed). */
  tenantCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanInput {
  key?: string;
  name?: string;
  description?: string;
  family?: PlanFamily;
  pricing?: {
    baseFee?: Partial<Money>;
    trialDays?: number;
    commissionPolicyKey?: string | null;
  };
  limits?: PlanLimits;
  entitlements?: string[];
  switching?: Partial<PlanSwitching>;
  isActive?: boolean;
  sortOrder?: number;
}

export type StatementStatus =
  | 'draft'
  | 'issued'
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'waived'
  | 'void';

export type PaymentMethod = 'bankak' | 'bank_transfer' | 'cash' | 'gateway' | 'other';

export interface StatementLine {
  type: 'subscription' | 'commission' | 'adjustment' | 'credit' | 'tax';
  description: string;
  amount: number;
  ref?: string | null;
}

export interface StatementPayment {
  _id?: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
  recordedBy?: string;
  recordedAt: string;
}

export interface Statement {
  _id: string;
  tenantId: string | { _id: string; name: string; slug: string; email?: string };
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  planKey?: string | null;
  planFamily?: PlanFamily | null;
  lines: StatementLine[];
  subtotal: number;
  credits: number;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: StatementStatus;
  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  payments: StatementPayment[];
  note?: string | null;
  createdAt: string;
}

export interface FeeEvent {
  _id: string;
  tenantId: string;
  type: 'commission' | 'reversal' | 'adjustment' | 'credit' | 'subscription';
  orderId?: string | null;
  orderNumber?: string | null;
  paymentMethod?: string | null;
  basisAmount: number;
  basisCurrency?: string | null;
  fxRateToPolicyCurrency?: number | null;
  feeAmount: number;
  feeCurrency: string;
  policyKey?: string | null;
  planKey?: string | null;
  tierIndex?: number | null;
  percentApplied?: number | null;
  pricingSource?: string | null;
  occurredAt: string;
  periodKey: string;
  statementId?: string | null;
  source: 'system' | 'operator';
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PricingOverride {
  _id: string;
  scope: 'tenant' | 'program';
  scopeId: string;
  baseFee?: { amount: number | null; currency: string | null; interval: Interval | null };
  commissionPolicyKey?: string | null;
  percentDelta?: number | null;
  feeHolidayUntil?: string | null;
  startsAt: string;
  endsAt?: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
  revokedAt?: string | null;
}

export interface PlanChange {
  _id: string;
  tenantId: string;
  fromPlan: string | null;
  toPlan: string;
  requestedBy: 'merchant' | 'operator';
  requestedAt: string;
  effectiveAt: string;
  appliedAt?: string | null;
  status: 'scheduled' | 'applied' | 'cancelled';
  reason?: string | null;
}

export interface EffectivePricing {
  planKey: string | null;
  planName: string | null;
  family: PlanFamily;
  baseFee: Money;
  trialEndsAt: string | null;
  inTrial: boolean;
  policy: CommissionPolicy | null;
  policyKey: string | null;
  percentDelta: number;
  feeHolidayUntil: string | null;
  inFeeHoliday: boolean;
  chargesCommission: boolean;
  chargesBaseFee: boolean;
  source: { baseFee: 'plan' | 'override'; commission: 'plan' | 'override' | 'default' | 'none' };
  /** All active overrides that contributed (merged per field, newest wins). */
  overrideIds: string[];
  /** Set when the wanted policy was inactive/missing and the platform default was used. */
  policyFallback?: { wanted: string; used: string } | null;
}

export interface PeriodTotals {
  periodKey: string;
  gmv: number;
  commission: number;
  adjustments: number;
  credits: number;
  currency: string | null;
  count: number;
}

export interface TenantEffective {
  pricing: EffectivePricing;
  currentPeriod: PeriodTotals;
  overrides: PricingOverride[];
  planChanges: PlanChange[];
}

export interface BillingSettings {
  defaultCommissionPolicyKey: string | null;
  statementDay: number;
  dueDays: number;
  graceDays: number;
  enforcement: { onOverdue: 'none' | 'warn' | 'read_only' | 'suspend' };
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pages: number;
}

// ---------------------------------------------------------------- helpers

/** Format a MAJOR-unit amount in its currency. */
export function formatAmount(amount?: number | null, currency = 'SDG'): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
  }
}

export function formatPercent(p?: number | null): string {
  if (p == null || Number.isNaN(p)) return '—';
  return `${Number(p).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

/** "5% → 3.5% → 2%" from a tier table. */
export function tierSummary(tiers?: CommissionTier[] | null): string {
  if (!tiers || tiers.length === 0) return '—';
  return tiers.map((t) => formatPercent(t.percent)).join(' → ');
}

/** Human summary of what a plan charges. */
export function planPriceSummary(plan: Plan, policies: CommissionPolicy[] = []): string {
  const fee = plan.pricing?.baseFee ?? { amount: plan.price ?? 0, currency: plan.currency ?? 'SDG', interval: plan.interval ?? 'month' };
  const policy = plan.pricing?.commissionPolicyKey
    ? policies.find((p) => p.key === plan.pricing.commissionPolicyKey)
    : null;
  const parts: string[] = [];
  if (plan.family !== 'commission' && (fee.amount ?? 0) >= 0) {
    parts.push(fee.amount ? `${formatAmount(fee.amount, fee.currency)}/${fee.interval ?? 'month'}` : 'Free');
  }
  if (plan.family !== 'subscription') {
    parts.push(policy ? `${tierSummary(policy.tiers)} of delivered sales` : `policy "${plan.pricing?.commissionPolicyKey ?? '?'}"`);
  }
  return parts.join(' + ') || '—';
}

export const FAMILY_LABEL: Record<PlanFamily, string> = {
  commission: 'Commission',
  subscription: 'Subscription',
  hybrid: 'Hybrid',
};

export const STATUS_LABEL: Record<StatementStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  paid: 'Paid',
  partially_paid: 'Partially paid',
  overdue: 'Overdue',
  waived: 'Waived',
  void: 'Void',
};

export function statementTenant(s: Statement): { id: string; name?: string; slug?: string } {
  if (typeof s.tenantId === 'string') return { id: s.tenantId };
  return { id: s.tenantId._id, name: s.tenantId.name, slug: s.tenantId.slug };
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bankak', label: 'Bankak' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'gateway', label: 'Gateway' },
  { value: 'other', label: 'Other' },
];

/** Current period key (YYYY-MM). Periods are UTC calendar months server-side. */
export function currentPeriodKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- client

const d = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const billingApi = {
  settings: {
    get: () => d<BillingSettings>(http.get('/billing/settings')),
    update: (patch: Partial<BillingSettings>) => d<BillingSettings>(http.put('/billing/settings', patch)),
  },
  policies: {
    list: () => d<CommissionPolicy[]>(http.get('/billing/policies')),
    create: (input: PolicyInput) => d<CommissionPolicy>(http.post('/billing/policies', input)),
    update: (id: string, input: PolicyInput) => d<CommissionPolicy>(http.patch(`/billing/policies/${id}`, input)),
    remove: (id: string) => d<{ id: string }>(http.delete(`/billing/policies/${id}`)),
    preview: (body: {
      policy: string | PolicyInput;
      periodBasisSoFar?: number;
      orderAmount: number;
      fxRateToPolicyCurrency?: number;
      percentDelta?: number;
    }) => d<PolicyPreview>(http.post('/billing/policies/preview', body)),
  },
  statements: {
    list: (params: { status?: string; tenantId?: string; periodKey?: string; page?: number; limit?: number } = {}) =>
      d<Paged<Statement>>(http.get('/billing/statements', { params })),
    get: (id: string) => d<Statement>(http.get(`/billing/statements/${id}`)),
    issue: (id: string) => d<Statement>(http.post(`/billing/statements/${id}/issue`)),
    recordPayment: (id: string, body: { amount: number; method: PaymentMethod; reference?: string; note?: string }) =>
      d<Statement>(http.post(`/billing/statements/${id}/payments`, body)),
    waive: (id: string, reason: string) => d<Statement>(http.post(`/billing/statements/${id}/waive`, { reason })),
    void: (id: string, reason: string) => d<Statement>(http.post(`/billing/statements/${id}/void`, { reason })),
    runPeriod: (periodKey?: string) =>
      d<{ periodKey: string; planChangesApplied: number; tenants: number; generated: number; issued: number; skippedEmpty?: number; overdue: number; errors: unknown[] }>(
        http.post('/billing/run-period', periodKey ? { periodKey } : {})
      ),
  },
  tenant: {
    effective: (tenantId: string) => d<TenantEffective>(http.get(`/billing/tenants/${tenantId}/effective`)),
    createOverride: (
      tenantId: string,
      body: {
        baseFee?: Partial<Money>;
        commissionPolicyKey?: string | null;
        percentDelta?: number;
        feeHolidayUntil?: string;
        startsAt?: string;
        endsAt?: string;
        reason: string;
      }
    ) => d<PricingOverride>(http.post(`/billing/tenants/${tenantId}/overrides`, body)),
    revokeOverride: (tenantId: string, id: string, reason: string) =>
      d<PricingOverride>(http.post(`/billing/tenants/${tenantId}/overrides/${id}/revoke`, { reason })),
    ledger: (tenantId: string, params: { periodKey?: string; page?: number; limit?: number } = {}) =>
      d<Paged<FeeEvent>>(http.get(`/billing/tenants/${tenantId}/ledger`, { params })),
    adjust: (tenantId: string, body: { amount: number; reason: string; periodKey?: string }) =>
      d<FeeEvent>(http.post(`/billing/tenants/${tenantId}/adjustments`, body)),
    statements: (tenantId: string) => d<Paged<Statement>>(http.get(`/billing/tenants/${tenantId}/statements`)),
    generateStatement: (tenantId: string, periodKey: string, force = false) =>
      d<{ statement: Statement; created: boolean; regenerated: boolean }>(
        http.post(`/billing/tenants/${tenantId}/statements/generate`, { periodKey, force })
      ),
    planChange: (tenantId: string, body: { toPlan: string; effectiveAt?: 'immediately' | 'next_period'; reason?: string }) =>
      d<{ change: PlanChange; tenant: unknown; applied: boolean }>(http.post(`/billing/tenants/${tenantId}/plan-change`, body)),
    cancelPlanChange: (tenantId: string) =>
      d<{ cancelled: number }>(http.post(`/billing/tenants/${tenantId}/plan-change/cancel`)),
  },
  plans: {
    list: () => d<Plan[]>(http.get('/plans')),
    create: (input: PlanInput) => d<Plan>(http.post('/plans', input)),
    update: (id: string, input: PlanInput) => d<Plan>(http.patch(`/plans/${id}`, input)),
    remove: (id: string) => d<{ id: string }>(http.delete(`/plans/${id}`)),
  },
};
