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
  scopes?: string[];
  availableScopes?: string[];
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
  if (token) {
    config.headers = config.headers || {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
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
    const msg =
      (err.response?.data as { message?: string } | undefined)?.message ||
      err.message ||
      'Request failed';
    return Promise.reject(new Error(msg));
  }
);

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
  domains?: { subdomain?: string; customDomain?: string; primary?: string };
  subscriptionPlan?: string;
  subscriptionStatus?: SubscriptionStatus;
  suspendedAt?: string | null;
  deletionScheduledAt?: string | null;
  deletedAt?: string | null;
  setupStatus?: { status?: string };
  createdAt: string;
}

export interface Pagination {
  total: number;
  page: number;
  pages: number;
}

export const api = {
  login: async (email: string, password: string) => {
    const res = await http.post('/login', { email, password });
    return res.data.data as { token: string; user: PlatformUser };
  },
  me: async () => {
    const res = await http.get('/me');
    return res.data.data as PlatformUser;
  },
  tenants: {
    list: async (params: { page?: number; limit?: number; status?: string; q?: string } = {}) => {
      const res = await http.get('/tenants', { params });
      return res.data.data as { tenants: TenantListRow[]; pagination: Pagination };
    },
    stats: async () => {
      const res = await http.get('/tenants-stats');
      return res.data.data as {
        total: number;
        byStatus: Record<string, number>;
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
    suspend: async (tenantId: string, reason?: string) => {
      const res = await http.post(`/tenants/${tenantId}/suspend`, { reason });
      return res.data.data;
    },
    unsuspend: async (tenantId: string) => {
      const res = await http.post(`/tenants/${tenantId}/unsuspend`);
      return res.data.data;
    },
    scheduleDeletion: async (tenantId: string, graceDays?: number) => {
      const res = await http.post(`/tenants/${tenantId}/schedule-deletion`, { graceDays });
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
