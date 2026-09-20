/**
 * Access programs, per-tenant feature/limit overrides, usage and the
 * configuration inspector (Phase B, workstream B1).
 */
import { http } from './api';

const d = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export type ProgramStatus = 'draft' | 'active' | 'closed';
export type LayerSource = 'default' | 'global' | 'plan' | 'program' | 'tenant' | 'none';

export interface LimitOverrides {
  maxProducts: number | null;
  maxStaff: number | null;
  maxOrdersPerMonth: number | null;
  maxStorageMB: number | null;
}
export const LIMIT_KEYS: (keyof LimitOverrides)[] = ['maxProducts', 'maxStaff', 'maxOrdersPerMonth', 'maxStorageMB'];
export const LIMIT_LABELS: Record<keyof LimitOverrides, string> = {
  maxProducts: 'Products',
  maxStaff: 'Staff',
  maxOrdersPerMonth: 'Orders / month',
  maxStorageMB: 'Storage (MB)',
};

export interface AccessProgram {
  _id: string;
  key: string;
  name: string;
  description: string;
  status: ProgramStatus;
  eligibility: { countries: string[]; planKeys: string[] };
  featureOverrides: Array<{ key: string; value: boolean }>;
  limitOverrides: LimitOverrides;
  startsAt: string | null;
  endsAt: string | null;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramInput {
  key?: string;
  name?: string;
  description?: string;
  status?: ProgramStatus;
  eligibility?: { countries?: string[]; planKeys?: string[] };
  featureOverrides?: Array<{ key: string; value: boolean }>;
  limitOverrides?: Partial<LimitOverrides>;
  startsAt?: string | null;
  endsAt?: string | null;
  reason?: string;
}

export interface ProgramMember {
  tenantId: string;
  name: string;
  slug: string;
  email: string;
  subscriptionPlan: string;
  lifecycle: string | null;
  deleted: boolean;
}

export interface Pagination {
  total: number;
  page: number;
  pages: number;
}

export interface TenantFeatureOverride {
  _id: string;
  key: string;
  value: boolean;
  reason: string;
  createdAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  active: boolean;
}

export interface ConfigRow {
  key: string;
  label: string;
  group: string;
  default: unknown;
  plan: unknown;
  program: unknown;
  tenant: unknown;
  effective: unknown;
  source: LayerSource;
  global?: boolean | null;
  programKey?: string | null;
  description?: string;
  policyName?: string | null;
  all?: Array<{ code: string; label: string; enabled: boolean }>;
}

export interface TenantConfig {
  tenant: { id: string; name: string; slug: string; plan: string; programs: string[]; lifecycle: string | null };
  generatedAt: string;
  settings: ConfigRow[];
  flags: ConfigRow[];
  limits: ConfigRow[];
  limitOverridesReason: string | null;
  pricing: ConfigRow[];
}

export interface UsageResource {
  key: keyof LimitOverrides;
  usageKey: string;
  used: number | null;
  limit: number | null;
  source: LayerSource;
  layers: { plan: number | null; program: number | null; programKey: string | null; tenant: number | null };
  pct: number | null;
  over: boolean;
}

export interface TenantUsage {
  tenantId: string;
  at: string | null;
  resources: UsageResource[];
  limitOverridesReason: string | null;
  history: Array<{ at: string; products: number; staff: number; ordersThisMonth: number; storageMB: number; source: string }>;
}

export interface FlagOverrideCounts {
  [flagKey: string]: { programsOn: string[]; programsOff: string[]; tenantsOn: number; tenantsOff: number };
}

export const programsApi = {
  list: (params: { page?: number; limit?: number; status?: ProgramStatus; q?: string } = {}) =>
    d<{ programs: AccessProgram[]; pagination: Pagination }>(http.get('/programs', { params })),
  get: (id: string) => d<AccessProgram>(http.get(`/programs/${id}`)),
  create: (input: ProgramInput) => d<AccessProgram>(http.post('/programs', input)),
  update: (id: string, input: ProgramInput) => d<AccessProgram>(http.patch(`/programs/${id}`, input)),
  close: (id: string, reason: string) => d<AccessProgram>(http.post(`/programs/${id}/close`, { reason })),
  members: (id: string, params: { page?: number; limit?: number } = {}) =>
    d<{ members: ProgramMember[]; pagination: Pagination }>(http.get(`/programs/${id}/members`, { params })),
  addMember: (id: string, tenantId: string, reason: string) =>
    d<{ programKey: string }>(http.post(`/programs/${id}/members`, { tenantId, reason })),
  removeMember: (id: string, tenantId: string, reason: string) =>
    d<{ programKey: string }>(http.delete(`/programs/${id}/members/${tenantId}`, { data: { reason } })),
};

export const tenantConfigApi = {
  config: (tenantId: string) => d<TenantConfig>(http.get(`/tenants/${tenantId}/config`)),
  overrides: (tenantId: string, includeRevoked = false) =>
    d<TenantFeatureOverride[]>(http.get(`/tenants/${tenantId}/feature-overrides`, { params: includeRevoked ? { includeRevoked: 1 } : {} })),
  createOverride: (tenantId: string, input: { key: string; value: boolean; reason: string; endsAt?: string | null }) =>
    d<{ override: TenantFeatureOverride; replaced: TenantFeatureOverride | null }>(http.post(`/tenants/${tenantId}/feature-overrides`, input)),
  revokeOverride: (tenantId: string, overrideId: string, reason: string) =>
    d<TenantFeatureOverride>(http.post(`/tenants/${tenantId}/feature-overrides/${overrideId}/revoke`, { reason })),
  usage: (tenantId: string) => d<TenantUsage>(http.get(`/tenants/${tenantId}/usage`)),
  refreshUsage: (tenantId: string) => d<TenantUsage>(http.post(`/usage/refresh/${tenantId}`)),
  setLimitOverrides: (tenantId: string, limitOverrides: Partial<LimitOverrides>, reason: string) =>
    d<TenantUsage>(http.put(`/tenants/${tenantId}/limit-overrides`, { limitOverrides, reason })),
};

/** Human label for a layer source badge. */
export function sourceLabel(s: LayerSource | string): string {
  switch (s) {
    case 'default': return 'Default';
    case 'global': return 'Global';
    case 'plan': return 'Plan';
    case 'program': return 'Program';
    case 'tenant': return 'Store override';
    case 'none': return 'None';
    default: return String(s);
  }
}

export function sourceVariant(s: LayerSource | string): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' {
  switch (s) {
    case 'tenant': return 'warning';
    case 'program': return 'default';
    case 'plan': return 'secondary';
    case 'global': return 'success';
    default: return 'outline';
  }
}

export function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'On' : 'Off';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('amount' in o && 'currency' in o) return `${o.currency} ${Number(o.amount).toLocaleString()}${o.interval ? `/${o.interval}` : ''}`;
    if ('endsAt' in o) return `until ${new Date(String(o.endsAt)).toLocaleDateString()}`;
    return JSON.stringify(o);
  }
  return String(v);
}
