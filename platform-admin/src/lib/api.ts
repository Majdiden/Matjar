import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'platform_admin_token';
const USER_KEY = 'platform_admin_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  platformAdmin?: boolean;
  // Named platform role (owner | admin | operations | support | finance | developer); null for legacy admins.
  role?: string | null;
  scopes?: string[];
  availableScopes?: string[];
  mfaEnabled?: boolean;
}

// --- Re-authentication -------------------------------------------------
// Destructive / privilege-changing calls need a fresh identity check. The
// server hands back a 5-minute token bound to the current session; we keep
// it IN MEMORY ONLY (never localStorage) and attach it as `X-Reauth` on the
// next protected request(s). `ReauthModal` obtains it.
let reauthToken: string | null = null;
let reauthExpiresAt = 0;
export function setReauthToken(token: string, expiresInSeconds: number) {
  reauthToken = token;
  // Keep a 20 s safety margin under the server's TTL.
  reauthExpiresAt = Date.now() + Math.max(0, expiresInSeconds - 20) * 1000;
}
export function hasFreshReauth(): boolean {
  return !!reauthToken && Date.now() < reauthExpiresAt;
}
export function clearReauth() {
  reauthToken = null;
  reauthExpiresAt = 0;
}
/** Thrown by the interceptor when the server asks for re-authentication. */
export const REAUTH_REQUIRED = 'REAUTH_REQUIRED';
/** Server code when the operator's role requires MFA and they have not enrolled. */
export const MFA_ENROLLMENT_REQUIRED = 'MFA_ENROLLMENT_REQUIRED';
// The AuthProvider's MfaEnrollmentGate subscribes to redirect the operator.
const mfaGateListeners = new Set<() => void>();
export function onMfaGate(fn: () => void): () => void {
  mfaGateListeners.add(fn);
  return () => {
    mfaGateListeners.delete(fn);
  };
}

// Mirrors backend PLATFORM_SCOPES. Used by the frontend to gate UI
// affordances (server still enforces). Keep in sync with
// middlewares/platformAdmin.js.
export const PLATFORM_SCOPES = {
  SUPPORT_READ: 'support.read',
  SUPPORT_IMPERSONATE: 'support.impersonate',
  TENANT_LIFECYCLE: 'tenant.lifecycle',
  TENANT_EXPORT: 'tenant.export',
  QUEUE_RETRY: 'queue.retry',
  BILLING_READ: 'billing.read',
  BILLING_WRITE: 'billing.write',
  AUDIT_READ: 'audit.read',
  PLATFORM_USERS: 'platform.users',
  TENANT_USERS: 'tenant.users',
  FLAGS_WRITE: 'flags.write',
} as const;
export type PlatformScope = (typeof PLATFORM_SCOPES)[keyof typeof PLATFORM_SCOPES];

export function hasScope(user: PlatformUser | null, scope: PlatformScope): boolean {
  if (!user) return false;
  return !!user.scopes?.includes(scope);
}

export function getStoredUser(): PlatformUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlatformUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: PlatformUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export const http = axios.create({
  baseURL: '/api/platform',
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  config.headers = config.headers || {};
  if (token) {
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  // Re-auth proof only rides on mutating requests; never on reads.
  const method = String(config.method || 'get').toLowerCase();
  if (method !== 'get' && method !== 'head' && hasFreshReauth() && reauthToken) {
    (config.headers as Record<string, string>)['X-Reauth'] = reauthToken;
  }
  return config;
});

// Vite's BASE_URL is `/platform/` in prod and `/` in dev. Strip the
// trailing slash so we can concatenate `/login` cleanly. We use full-page
// redirects (not react-router navigate) on 401 to guarantee a clean
// remount — the token/session state is nuked and we want a fresh boot.
const BASE_URL = import.meta.env.BASE_URL || '/';
const BASE_PREFIX = BASE_URL === '/' ? '' : BASE_URL.replace(/\/$/, '');

http.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ message?: string }>) => {
    if (err.response?.status === 401) {
      const wasAuthed = !!getToken();
      clearSession();
      const loginPath = `${BASE_PREFIX}/login`;
      if (wasAuthed && window.location.pathname !== loginPath) {
        window.location.href = `${loginPath}?expired=1`;
      }
    }
    const body = err.response?.data as { message?: string; code?: string } | undefined;
    const msg = body?.message || err.message || 'Request failed';
    const e = new Error(msg) as Error & { code?: string; status?: number };
    e.code = body?.code;
    e.status = err.response?.status;
    if (body?.code === REAUTH_REQUIRED) clearReauth();
    if (body?.code === MFA_ENROLLMENT_REQUIRED) mfaGateListeners.forEach((fn) => fn());
    return Promise.reject(e);
  }
);

/** Drop undefined / null / empty-string params before sending a query. */
export function cleanParams<T extends object>(o: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null));
}

/** Badge variants (mirror of components/ui/Badge.tsx) for tone maps kept in non-component modules. */
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

// --- Typed API surface ------------------------------------------------

export type SubscriptionStatus =
  | 'pending'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'deleted';

export interface TenantListRow {
  _id: string;
  name: string;
  slug: string;
  email: string;
  // Merchant contact phone (E.164) + the ISO-3166 alpha-2 it was entered for.
  phone?: string | null;
  phoneCountry?: string | null;
  domains?: { subdomain?: string; customDomain?: string; primary?: string };
  subscriptionPlan?: string;
  subscriptionStatus?: SubscriptionStatus;
  suspendedAt?: string | null;
  deletionScheduledAt?: string | null;
  deletedAt?: string | null;
  setupStatus?: { status?: string };
  lifecycle?: { state?: LifecycleState; reason?: string | null; changedAt?: string | null };
  createdAt: string;
}

export type LifecycleState = 'pending' | 'onboarding' | 'active' | 'suspended' | 'closed' | 'archived';
export const LIFECYCLE_STATES: LifecycleState[] = ['pending', 'onboarding', 'active', 'suspended', 'closed', 'archived'];

export interface Pagination {
  total: number;
  page: number;
  pages: number;
}

export interface SubscriptionPlan {
  _id: string;
  key: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits?: { maxProducts?: number | null; maxStaff?: number | null };
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

// Shape sent when creating/updating a plan. `key` is required on create,
// ignored on update (immutable identifier).
export type PlanInput = {
  key?: string;
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  interval?: 'month' | 'year';
  features?: string[];
  limits?: { maxProducts?: number | null; maxStaff?: number | null };
  isActive?: boolean;
  sortOrder?: number;
};

export interface FeatureFlagDef {
  key: string;
  type: 'boolean' | 'stringList';
  default: boolean | string[];
  group: string;
  label: string;
  description: string;
}
export interface FeaturesResponse {
  registry: FeatureFlagDef[];
  flags: Record<string, boolean | string[]>;
  themeSlugs: string[];
  // Phase B: where each flag is switched on/off below the global layer.
  overrides?: Record<string, { programsOn: string[]; programsOff: string[]; tenantsOn: number; tenantsOff: number }>;
}

// Dial codes offered on merchant signup / profile forms. `catalog` is the
// server's pickable list of well-known countries; `countries` is the
// operator's effective list (catalog picks + custom entries).
export interface PhoneCountryCatalogEntry {
  iso2: string;
  name: string;
  nameAr?: string;
  dialCode: string;
  minDigits: number;
  maxDigits: number;
}
export interface PhoneCountry extends PhoneCountryCatalogEntry {
  enabled: boolean;
}
export interface PhoneCountriesResponse {
  countries: PhoneCountry[];
  defaultCountry: string;
  catalog: PhoneCountryCatalogEntry[];
}

export interface SeedStarterResult {
  success: boolean;
  seeded: boolean;
  draft: boolean;
  source: 'theme' | 'sample' | null;
  categories: number;
  products: number;
  collections: number;
  pages: number;
  error?: string;
}

export type LoginResult =
  | { mfaRequired: true; mfaToken: string }
  | { mfaRequired?: false; token: string; user: PlatformUser };

export const api = {
  login: async (email: string, password: string) => {
    const res = await http.post('/login', { email, password });
    return res.data.data as LoginResult;
  },
  // Login step 2 (MFA). Public: no session exists yet.
  mfaVerify: async (mfaToken: string, code: string) => {
    const res = await http.post('/auth/mfa/verify', { mfaToken, code });
    return res.data.data as { token: string; user: PlatformUser; mfaMethod: 'totp' | 'recovery'; recoveryCodesRemaining?: number };
  },
  // Re-confirm identity (password when MFA is off, authenticator code when on).
  reauth: async (input: { password?: string; code?: string }) => {
    const res = await http.post('/auth/reauth', input);
    return res.data.data as { reauthToken: string; expiresInSeconds: number; method: string };
  },
  me: async () => {
    const res = await http.get('/me');
    return res.data.data as PlatformUser;
  },
  tenants: {
    list: async (params: { page?: number; limit?: number; status?: string; q?: string; lifecycle?: string } = {}) => {
      const res = await http.get('/tenants', { params });
      return res.data.data as { tenants: TenantListRow[]; pagination: Pagination };
    },
    stats: async () => {
      const res = await http.get('/tenants-stats');
      return res.data.data as {
        total: number;
        byStatus: Record<string, number>;
        byLifecycle: Record<string, number>;
        setupFailed: number;
        scheduledForDeletion: number;
      };
    },
    getStats: async (tenantId: string) => {
      const res = await http.get(`/tenants/${tenantId}/stats`);
      return res.data.data as {
        orders30d: number;
        revenue30d: number;
        failedWebhooks: number;
        pendingExports: number;
        usersTotal: number;
        productsTotal: number;
        recentAudit: Array<{
          _id: string;
          action: string;
          resource?: string;
          actorName?: string | null;
          createdAt: string;
        }>;
      };
    },
    get: async (tenantId: string) => {
      const res = await http.get(`/tenants/${tenantId}`);
      return res.data.data;
    },
    retrySetup: async (tenantId: string) => {
      const res = await http.post(`/tenants/${tenantId}/retry-setup`);
      return res.data.data;
    },
    // On-demand DRAFT starter content (auto-seeding at signup is behind the
    // `onboarding.starterContent` flag). No-op when the store already has
    // real products (`seeded: false`).
    seedStarterContent: async (tenantId: string) => {
      const res = await http.post(`/tenants/${tenantId}/seed-starter-content`);
      return res.data.data as SeedStarterResult;
    },
    suspend: async (tenantId: string, reason?: string) => {
      const res = await http.post(`/tenants/${tenantId}/suspend`, { reason });
      return res.data.data;
    },
    unsuspend: async (tenantId: string, reason?: string) => {
      const res = await http.post(`/tenants/${tenantId}/unsuspend`, { reason });
      return res.data.data;
    },
    scheduleDeletion: async (tenantId: string, graceDays?: number, reason?: string) => {
      const res = await http.post(`/tenants/${tenantId}/schedule-deletion`, { graceDays, reason });
      return res.data.data;
    },
    cancelDeletion: async (tenantId: string) => {
      const res = await http.post(`/tenants/${tenantId}/cancel-deletion`);
      return res.data.data;
    },
    purge: async (tenantId: string, force?: boolean) => {
      const res = await http.post(`/tenants/${tenantId}/purge`, { force });
      return res.data.data;
    },
    syncExport: async (tenantId: string) => {
      const res = await http.get(`/tenants/${tenantId}/export`);
      return res.data.data;
    },
    requestAsyncExport: async (tenantId: string) => {
      const res = await http.post(`/tenants/${tenantId}/exports`);
      return res.data.data as { exportId: string; status: string };
    },
    getExportStatus: async (tenantId: string, exportId: string) => {
      const res = await http.get(`/tenants/${tenantId}/exports/${exportId}`);
      return res.data.data;
    },
    // Streams the export file through the API (auth-checked) as a blob
    // and triggers a browser download. We never get a raw storage URL
    // on the client side — the proxy endpoint is the only way in.
    downloadExport: async (tenantId: string, exportId: string) => {
      const res = await http.get(
        `/tenants/${tenantId}/exports/${exportId}/download`,
        { responseType: 'blob' }
      );
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenant-${tenantId}-${exportId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    impersonate: async (tenantId: string, reason: string, ttlSeconds?: number) => {
      const res = await http.post(`/tenants/${tenantId}/impersonate`, { reason, ttlSeconds });
      return res.data.data as {
        token: string;
        tenantId: string;
        userId: string;
        userEmail: string;
        expiresIn: number;
      };
    },

    // --- Consent-based impersonation (owner must approve) ---
    // 1. Request access for a ticket → owner gets a real-time consent popup.
    requestImpersonation: async (tenantId: string, ticket: string) => {
      const res = await http.post(`/tenants/${tenantId}/impersonation/request`, { ticket });
      return res.data.data as {
        grantId: string;
        status: string;
        ticket: string;
        approvalExpiresAt?: string;
        storeName?: string;
      };
    },
    // 2. Poll the grant while waiting for the owner to approve/deny.
    pollImpersonation: async (tenantId: string, grantId: string) => {
      const res = await http.get(`/tenants/${tenantId}/impersonation/${grantId}`);
      return res.data.data as {
        grantId: string;
        status: string;
        ticket: string;
        sessionExpiresAt?: string;
        approvalExpiresAt?: string;
      };
    },
    // 2b. Phone fallback — owner reads the code, support submits it here.
    approveImpersonationByCode: async (tenantId: string, grantId: string, code: string) => {
      const res = await http.post(
        `/tenants/${tenantId}/impersonation/${grantId}/approve-code`,
        { code }
      );
      return res.data.data as { grantId: string; status: string; ticket: string };
    },
    // 3. Enter an approved grant → mints the impersonation token.
    enterImpersonation: async (tenantId: string, grantId: string) => {
      const res = await http.post(`/tenants/${tenantId}/impersonation/${grantId}/enter`, {});
      return res.data.data as {
        token: string;
        grantId: string;
        tenantId: string;
        userId: string;
        userEmail: string;
        ticket: string;
        expiresIn: number;
      };
    },
    // Cancel/exit a grant from the operator side.
    exitImpersonation: async (tenantId: string, grantId: string) => {
      const res = await http.post(`/tenants/${tenantId}/impersonation/${grantId}/exit`, {});
      return res.data.data as { grantId: string; status: string };
    },
    listOrders: async (
      tenantId: string,
      params: { page?: number; limit?: number; status?: string } = {}
    ) => {
      const res = await http.get(`/tenants/${tenantId}/orders`, { params });
      return res.data.data as { orders: unknown[]; pagination: Pagination };
    },
    getOrder: async (tenantId: string, orderId: string) => {
      const res = await http.get(`/tenants/${tenantId}/orders/${orderId}`);
      return res.data.data;
    },
    listPayments: async (tenantId: string) => {
      const res = await http.get(`/tenants/${tenantId}/payments`);
      return res.data.data as unknown[];
    },
    listFailedWebhooks: async (tenantId: string) => {
      const res = await http.get(`/tenants/${tenantId}/failed-webhooks`);
      return res.data.data as unknown[];
    },
    changePlan: async (tenantId: string, plan: string) => {
      const res = await http.patch(`/tenants/${tenantId}/plan`, { plan });
      return res.data.data as {
        tenantId: string;
        subscriptionPlan: string;
        subscriptionStartDate?: string;
        subscriptionEndDate?: string;
      };
    },
  },
  plans: {
    list: async () => {
      const res = await http.get('/plans');
      return res.data.data as SubscriptionPlan[];
    },
    create: async (input: PlanInput) => {
      const res = await http.post('/plans', input);
      return res.data.data as SubscriptionPlan;
    },
    update: async (id: string, input: PlanInput) => {
      const res = await http.patch(`/plans/${id}`, input);
      return res.data.data as SubscriptionPlan;
    },
    remove: async (id: string) => {
      const res = await http.delete(`/plans/${id}`);
      return res.data.data as { id: string };
    },
  },
  features: {
    get: async () => {
      const res = await http.get('/features');
      return res.data.data as FeaturesResponse;
    },
    update: async (updates: Array<{ key: string; value: boolean | string[] }>) => {
      // Flag ids ride as VALUES (not object keys): the API's mongo-sanitize
      // strips dots from request KEYS, which would mangle ids like
      // "payments.methods".
      const res = await http.put('/features', { updates });
      return res.data.data as { flags: Record<string, boolean | string[]> };
    },
  },
  phoneCountries: {
    get: async () => {
      const res = await http.get('/phone-countries');
      return res.data.data as PhoneCountriesResponse;
    },
    update: async (payload: { countries: PhoneCountry[]; defaultCountry: string }) => {
      const res = await http.put('/phone-countries', payload);
      return res.data.data as PhoneCountriesResponse;
    },
  },
  queues: {
    stats: async () => {
      const res = await http.get('/queues-stats');
      return res.data.data as Array<{
        name: string;
        error?: string;
        counts: Partial<
          Record<'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused', number>
        >;
      }>;
    },
    listFailed: async (queue: string, start = 0, limit = 50) => {
      const res = await http.get(`/queues/${queue}/failed`, { params: { start, limit } });
      return res.data.data as Array<{
        id: string | number;
        name: string;
        attemptsMade: number;
        failedReason?: string;
        data?: unknown;
        timestamp: number;
        finishedOn?: number;
      }>;
    },
    retry: async (queue: string, jobId: string | number) => {
      const res = await http.post(`/queues/${queue}/failed/${jobId}/retry`);
      return res.data.data;
    },
  },
};

// Queue names mirror backend `QUEUE_NAMES` values in services/jobs/queues.js.
export const QUEUES = [
  'store-setup',
  'email',
  'webhook-delivery',
  'domain-verification',
  'theme-build',
  'data-seed',
  'payment-reconciliation',
  'tenant-export',
  'tenant-lifecycle',
] as const;
export type QueueName = (typeof QUEUES)[number];
