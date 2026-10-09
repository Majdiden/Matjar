import { http, cleanParams as clean, type Pagination, type BadgeVariant } from './api';

/** Storefront operations: Domain registry, theme catalog, health. Mounted at /api/platform/storefront. */

export type DomainStatus =
  | 'pending_dns' | 'ownership_verified' | 'dns_verified' | 'provisioning_ssl'
  | 'active' | 'ssl_failed' | 'dns_misconfigured' | 'disabled';
export type DomainKind = 'platform_subdomain' | 'custom_apex' | 'custom_subdomain';

export const DOMAIN_STATUSES: DomainStatus[] = [
  'active', 'pending_dns', 'ownership_verified', 'dns_verified', 'provisioning_ssl', 'ssl_failed', 'dns_misconfigured', 'disabled',
];

export interface DomainRow {
  _id: string;
  tenantId: string;
  tenant?: { name?: string; slug?: string };
  hostname: string;
  kind: DomainKind;
  status: DomainStatus;
  isPrimary: boolean;
  dns?: { targetType?: string | null; expectedTarget?: string | null; lastResolved?: string | null; lastCheckedAt?: string | null; error?: string | null };
  ssl?: { provider?: string | null; status?: string | null; issuedAt?: string | null; expiresAt?: string | null; lastAttemptAt?: string | null; error?: string | null };
  verification?: { checkedAt?: string | null; verifiedAt?: string | null; failureReason?: string | null };
  disabledAt?: string | null;
  disabledReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThemeCategoryOption { key: string; label: string; labelAr: string; active?: boolean }
/** Platform-managed theme category (backend services/themeCategories.js). */
export interface ThemeCategory {
  key: string;
  name: { en: string; ar: string };
  icon?: string;
  aliases?: string[];
  order: number;
  active: boolean;
  themeCount: number;
  /** "general": cannot be deactivated or deleted. */
  protected?: boolean;
  updatedBy?: string | null;
  updatedAt?: string;
}
export interface ThemeCategoryInput {
  key?: string;
  name?: { en?: string; ar?: string };
  icon?: string;
  aliases?: string[];
  active?: boolean;
  reason?: string;
}
export interface ThemeDetailsPatch {
  name?: string | null;
  description?: string | null;
  previewImage?: string | null;
  categories?: string[] | null;
  tags?: string[] | null;
  reason?: string;
}

export interface ThemeRow {
  _id: string;
  name: string;
  slug: string;
  version: string;
  manifestVersion?: string | null;
  description?: string;
  status: 'active' | 'inactive' | 'development';
  isDefault?: boolean;
  previewImage?: string;
  categories?: string[];
  /** Effective category keys (explicit assignment, or derived from the manifest). */
  categoryKeys?: string[];
  /** True when the owner assigned the categories; false = automatic. */
  categoryKeysManaged?: boolean;
  tags?: string[];
  overrides?: { name?: string | null; description?: string | null; previewImage?: string | null; categories?: string[] | null; tags?: string[] | null; updatedBy?: string | null; updatedAt?: string | null };
  statistics?: { installCount?: number; activeInstalls?: number };
  catalogSync?: { missingSince?: string | null; lastSyncedAt?: string | null };
  storesUsing: number;
  updatedAt?: string;
}

export interface ThemeStoreRow {
  _id: string;
  name: string;
  slug: string;
  email?: string;
  lifecycle?: { state?: string };
  subscriptionPlan?: string;
  domains?: { subdomain?: { fullDomain?: string } };
  themeCustomization?: { published?: { version?: number }; lastPublishedAt?: string | null };
  createdAt: string;
}

export interface HealthCheck { status: 'ok' | 'error' | 'skipped'; httpStatus?: number | null; ms?: number | null; error?: string | null; url?: string | null }
export interface HealthRow {
  _id?: string;
  tenantId: string;
  tenant?: { name?: string; slug?: string };
  host: string;
  baseUrl: string;
  checkedAt: string;
  checks: { home: HealthCheck; product: HealthCheck; cart: HealthCheck };
  ssl: { ok: boolean | null; expiresAt?: string | null; error?: string | null };
  overall: 'ok' | 'degraded' | 'error' | 'unknown';
  source?: 'cron' | 'manual';
  theme?: { slug?: string | null; version?: string | null };
}

export const storefrontApi = {
  domains: {
    list: async (params: { status?: string; tenantId?: string; q?: string; kind?: string; page?: number; limit?: number }) => {
      const res = await http.get('/storefront/domains', { params: clean(params) });
      return res.data.data as { domains: DomainRow[]; pagination: Pagination; counts: Record<string, number> };
    },
    retry: async (id: string, reason?: string) => {
      const res = await http.post(`/storefront/domains/${id}/retry-verification`, clean({ reason }));
      return res.data.data as DomainRow;
    },
    setPrimary: async (id: string, reason?: string) => {
      const res = await http.post(`/storefront/domains/${id}/set-primary`, clean({ reason }));
      return res.data.data as DomainRow;
    },
    remove: async (id: string, reason: string) => {
      const res = await http.delete(`/storefront/domains/${id}`, { data: { reason } });
      return res.data.data as { id: string };
    },
  },
  themes: {
    list: async () => {
      const res = await http.get('/storefront/themes');
      return { rows: res.data.data as ThemeRow[], categoryOptions: (res.data.meta?.categoryOptions ?? []) as ThemeCategoryOption[] };
    },
    /** null on a field clears the override (back to the manifest value). */
    updateDetails: async (id: string, patch: ThemeDetailsPatch) => {
      const res = await http.patch(`/storefront/themes/${id}`, patch);
      return res.data.data as ThemeRow;
    },
    uploadCover: async (id: string, file: File) => {
      const fd = new FormData();
      fd.append('image', file);
      const res = await http.post(`/storefront/themes/${id}/cover`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return res.data.data as ThemeRow;
    },
    stores: async (slug: string, params: { page?: number; limit?: number } = {}) => {
      const res = await http.get(`/storefront/themes/${encodeURIComponent(slug)}/stores`, { params: clean(params) });
      return res.data.data as { tenants: ThemeStoreRow[]; pagination: Pagination };
    },
    setStatus: async (id: string, status: ThemeRow['status'], reason?: string) => {
      const res = await http.patch(`/storefront/themes/${id}/status`, clean({ status, reason }));
      return res.data.data as { slug: string; name: string; status: string };
    },
    /** null = automatic (derived from the theme's manifest categories). */
    setCategories: async (id: string, categoryKeys: string[] | null, reason?: string) => {
      const res = await http.put(`/storefront/themes/${id}/categories`, { categoryKeys, ...(reason ? { reason } : {}) });
      return res.data.data as ThemeRow;
    },
  },
  themeCategories: {
    list: async () => {
      const res = await http.get('/storefront/theme-categories');
      return res.data.data.categories as ThemeCategory[];
    },
    create: async (input: ThemeCategoryInput & { key: string; name: { en: string; ar: string } }) => {
      const res = await http.post('/storefront/theme-categories', clean(input));
      return res.data.data as ThemeCategory;
    },
    update: async (key: string, patch: ThemeCategoryInput & { order?: number }) => {
      const res = await http.patch(`/storefront/theme-categories/${encodeURIComponent(key)}`, clean(patch));
      return res.data.data as ThemeCategory;
    },
    reorder: async (keys: string[]) => {
      const res = await http.put('/storefront/theme-categories/order', { keys });
      return res.data.data.categories as ThemeCategory[];
    },
    remove: async (key: string, reason?: string) => {
      const res = await http.delete(`/storefront/theme-categories/${encodeURIComponent(key)}`, { data: clean({ reason }) });
      return res.data.data as { key: string; themesUpdated: number };
    },
  },
  health: {
    list: async (params: { overall?: string; tenantId?: string; page?: number; limit?: number }) => {
      const res = await http.get('/storefront/health', { params: clean(params) });
      return res.data.data as { results: HealthRow[]; pagination: Pagination };
    },
    get: async (tenantId: string) => {
      const res = await http.get(`/storefront/health/${tenantId}`);
      return res.data.data as HealthRow | null;
    },
    check: async (tenantId: string) => {
      const res = await http.post(`/storefront/health/${tenantId}/check`);
      return res.data.data as HealthRow;
    },
  },
};

/** Storefront URL for a host, matching TenantDetail's link derivation. */
export function storefrontUrl(host?: string | null): string | null {
  if (!host) return null;
  const isLocal = host.endsWith('.localhost') || host === 'localhost' || /\.localhost:\d+$/.test(host);
  if (isLocal) return `http://${/:\d+$/.test(host) ? host : `${host}:3000`}`;
  return `https://${host}`;
}

export const DOMAIN_TONE: Record<string, BadgeVariant> = {
  active: 'success', ssl_failed: 'destructive', dns_misconfigured: 'destructive', disabled: 'outline',
  provisioning_ssl: 'warning', dns_verified: 'warning', ownership_verified: 'secondary', pending_dns: 'secondary',
};
export const OVERALL_TONE: Record<string, BadgeVariant> = { ok: 'success', degraded: 'warning', error: 'destructive', unknown: 'outline' };
