import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { loginUrl, isOnLoginPage } from './authHandoff';

// API Base URL — always same-origin `/api`.
//
// On the app host (`app.<platformDomain>`) the backend resolves the tenant
// from the authenticated JWT (the Authorization header this client always
// sends), NOT the Host — so a same-origin `/api` base is exactly right: the
// tenant rides the token, not the subdomain. There is no longer any
// requirement that the API host equal a tenant subdomain.
//
// On legacy tenant subdomains the backend still resolves the tenant from the
// Host header, and a relative `/api` base preserves that host too. In dev,
// Vite runs on :5173 and proxies `/api` → `http://localhost:3000` with
// `changeOrigin: false` so the Host header reaches the backend intact.
// Hardcoding `localhost:3000` would bypass that proxy and trip the
// bare-localhost "Store not found" fallback.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login. Use the
      // basename-aware URL so on a store subdomain we land on the DASHBOARD
      // login (/dashboard/login), not the storefront's /login.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      if (!isOnLoginPage()) {
        window.location.href = loginUrl();
      }
    }
    return Promise.reject(error);
  }
);

// Shape of the errors Axios throws. We only care about the `response.data`
// envelope (server-sent error bodies) and `message` (network-layer errors)
// — the rest of AxiosError is irrelevant to the caller.
interface AxiosErrorLike {
  response?: { data?: unknown };
  message?: string;
}

function isAxiosErrorLike(err: unknown): err is AxiosErrorLike {
  return typeof err === 'object' && err !== null;
}

// Generic API call function
async function apiCall<T>(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  try {
    // axios `.get(url, config)` and `.delete(url, config)` only accept two
    // arguments — passing `data` as the second arg silently drops the
    // config (and therefore the `params`). For body-bearing verbs the
    // signature is `(url, data, config)`, so they need all three.
    let response: AxiosResponse<T>;
    if (method === 'get' || method === 'delete') {
      response = await apiClient[method]<T>(url, config);
    } else {
      response = await apiClient[method]<T>(url, data, config);
    }
    return response.data;
  } catch (error: unknown) {
    if (isAxiosErrorLike(error)) {
      throw error.response?.data ?? error.message ?? 'An error occurred';
    }
    throw error;
  }
}

// Idempotency helper — generates a client-side UUID per call and packs
// it into the Axios request config as the `Idempotency-Key` header. Used
// on mutating endpoints (payments, fulfillments, returns, refunds) where
// a double-click or network retry could otherwise create a duplicate
// side effect. The backend's IdempotencyRecord middleware (see
// middlewares/idempotency.js) replays the first response on collision.
function idempotentConfig(extra?: AxiosRequestConfig): AxiosRequestConfig {
  // `crypto.randomUUID()` is universally available in modern browsers;
  // the timestamp+random fallback exists so the code never crashes on
  // a misconfigured test/runtime env that strips the Web Crypto API.
  const cryptoLike = typeof crypto !== 'undefined' ? (crypto as Crypto & { randomUUID?: () => string }) : undefined;
  const uuid =
    cryptoLike && typeof cryptoLike.randomUUID === 'function'
      ? cryptoLike.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    ...(extra || {}),
    headers: {
      ...((extra && extra.headers) || {}),
      'Idempotency-Key': uuid,
    },
  };
}

// Payload shared by POST /orders/draft and PUT /orders/:id/draft (audit
// 5.2). Line prices are optional overrides; customer is either an existing
// user id or an inline guest contact; shipping is a configured method or a
// custom { name, price }; discount is MANUAL (not a discount code).
export interface DraftOrderPayload {
  items: Array<{ productId: string; variantId?: string; quantity: number; price?: number }>;
  customerId?: string;
  guestCustomer?: { email: string; firstName?: string; lastName?: string; phone?: string };
  shippingAddress?: Record<string, string | undefined>;
  billingAddress?: Record<string, string | undefined>;
  shippingMethod?: { id?: string; name: string; price: number } | null;
  discount?: { type: 'amount' | 'percentage'; value: number } | null;
  note?: string;
  tags?: string[];
}

// API client methods. Generic return type defaults to `unknown` — callers
// pick a concrete type (`api.get<MyResponse>(...)`) when they need it, or
// narrow with a type guard at the use site. We don't default to `any`
// because that silently erases type checking at every call site.
export const api = {
  // Generic methods
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    apiCall<T>('get', url, undefined, config),

  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiCall<T>('post', url, data, config),

  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiCall<T>('put', url, data, config),

  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiCall<T>('patch', url, data, config),

  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    apiCall<T>('delete', url, undefined, config),

  // Auth endpoints
  auth: {
    // Email-only login: the backend resolves the tenant from the email.
    // If the email owns multiple stores the backend returns
    // { requiresStoreSelection: true, data: { stores } } and the caller
    // re-invokes login with the chosen tenantId.
    login: (email: string, password: string, tenantId?: string) =>
      api.post('/auth/login', { email, password, ...(tenantId ? { tenantId } : {}) }),

    register: (data: {
      name: string;
      email: string;
      password: string;
      storeName?: string;
      subdomain?: string;
      subscriptionPlan?: string;
      themeSlug?: string;
      niche?: string;
      // Onboarding: false when the user skipped the theme step.
      themeSelected?: boolean;
      // Proof-of-email-verification token from verifyOtp().
      emailVerificationToken?: string;
    }) => api.post('/auth/register', data),

    // ─── Signup email-OTP verification ───────────────────────────────
    // Request a 4-digit code to the given email. Always resolves 200 with a
    // generic message. In dev (email disabled) the response carries `devCode`
    // so the flow is exercisable without a real inbox.
    requestOtp: (email: string, language?: string) =>
      api.post<{ responseObject?: { cooldownSeconds?: number; devCode?: string } }>(
        '/auth/otp/request',
        { email, ...(language ? { language } : {}) },
      ),
    // Verify a code; on success returns a short-lived verificationToken the
    // register call carries as proof.
    verifyOtp: (email: string, code: string) =>
      api.post<{ success?: boolean; message?: string; responseObject?: { verificationToken?: string } }>(
        '/auth/otp/verify',
        { email, code },
      ),

    // ─── WebAuthn / passkey (fingerprint / Face ID) ──────────────────
    webauthn: {
      // Enrollment (authenticated). Returns PublicKeyCredentialCreationOptions.
      registerOptions: () =>
        api.post<{ responseObject?: unknown }>('/auth/webauthn/register-options', {}),
      registerVerify: (response: unknown, name?: string) =>
        api.post('/auth/webauthn/register-verify', { response, ...(name ? { name } : {}) }),
      // Passwordless login (public). Options resolves the tenant/user from the
      // email and returns { hasCredentials, options?, flowId? }.
      authenticateOptions: (email: string, tenantId?: string) =>
        api.post<{ responseObject?: { hasCredentials?: boolean; options?: unknown; flowId?: string } }>(
          '/auth/webauthn/authenticate-options',
          { email, ...(tenantId ? { tenantId } : {}) },
        ),
      authenticateVerify: (flowId: string, response: unknown) =>
        api.post('/auth/webauthn/authenticate-verify', { flowId, response }),
      // Authenticated credential management for the Security page.
      listCredentials: () =>
        api.get<{ responseObject?: { passkeys?: Array<{
          id: string; name: string; deviceType?: string | null; backedUp?: boolean;
          createdAt?: string | null; lastUsedAt?: string | null;
        }> } }>('/auth/webauthn/credentials'),
      deleteCredential: (id: string) =>
        api.delete(`/auth/webauthn/credentials/${encodeURIComponent(id)}`),
    },

    // ─── Authenticated email verification (Security page) ────────────
    // Operate on the LOGGED-IN user's own email (no address argument). Request
    // sends a 4-digit code; confirm flips the durable emailVerified flag.
    emailVerifyRequest: () =>
      api.post<{ responseObject?: { email?: string; cooldownSeconds?: number; devCode?: string } }>(
        '/auth/email/verify-request',
        {},
      ),
    emailVerifyConfirm: (code: string) =>
      api.post<{ success?: boolean; message?: string; responseObject?: { emailVerified?: boolean } }>(
        '/auth/email/verify-confirm',
        { code },
      ),

    // Authenticated "add another store" under the current account — returns a
    // token for the new store so the client hands the user straight in.
    addStore: (data: {
      storeName: string;
      subdomain: string;
      themeSlug?: string;
      themeSelected?: boolean;
      niche?: string;
    }) => api.post('/auth/stores', data),

    // In-app store switcher. `myStores` lists every store the signed-in
    // email can access; `switchStore` re-issues a session bound to the chosen
    // tenant WITHOUT a host hop (the tenant rides the JWT).
    myStores: () =>
      api.get<{ responseObject?: { currentTenantId: string; stores: Array<{
        id: string; name: string; slug: string; domain: string; current: boolean;
      }> } }>('/auth/my-stores'),
    switchStore: (tenantId: string) =>
      api.post('/auth/switch-store', { tenantId }),

    // Public signup helper — true if the email already has a dashboard
    // account, so the UI can prompt "sign in to add a store" instead of
    // failing late at registration.
    checkEmail: (email: string) =>
      api.get<{ data?: { exists?: boolean } }>(`/auth/check-email?email=${encodeURIComponent(email)}`),

    logout: async () => {
      try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      window.location.href = loginUrl();
    },

    me: () => api.get('/auth/me'),

    refresh: (refreshToken: string) =>
      api.post('/auth/refresh', { refreshToken }),

    changePassword: (currentPassword: string, newPassword: string) =>
      api.post('/auth/change-password', { currentPassword, newPassword }),

    // Generic-success endpoint: always resolves 200 with a neutral message
    // regardless of whether the email matched anything. UI must not leak
    // that distinction to the user either.
    requestPasswordReset: (email: string) =>
      api.post('/auth/password-reset', { email }),

    confirmPasswordReset: (token: string, newPassword: string) =>
      api.post('/auth/password-reset/confirm', { token, newPassword }),
  },

  users: {
    me: () => api.get('/users/me'),
  },

  // Current-user scoped endpoints (notification preferences, etc.)
  me: {
    getNotificationPreferences: () => api.get('/users/me/notification-preferences'),
    updateNotificationPreferences: (preferences: Record<string, unknown>) =>
      api.put('/users/me/notification-preferences', preferences),
  },

  // Notifications (v2 — SSE-backed, per-type, per-channel)
  notifications: {
    list: (params?: {
      cursor?: string;
      limit?: number;
      unreadOnly?: boolean;
      types?: string[];
    }) => api.get('/notifications', { params }),
    unreadCount: () => api.get('/notifications/unread-count'),
    streamToken: () => api.get('/notifications/stream-token'),
    markRead: (id: string) => api.patch(`/notifications/${id}/read`),
    markAllRead: (before?: string) =>
      api.post('/notifications/read-all', before ? { before } : {}),
    dismiss: (id: string) => api.delete(`/notifications/${id}`),
    // Web Push (background delivery to the installed PWA).
    vapidPublicKey: () => api.get('/notifications/vapid-public-key'),
    pushSubscribe: (subscription: PushSubscriptionJSON, userAgent?: string) =>
      api.post('/notifications/push/subscribe', { subscription, userAgent }),
    pushUnsubscribe: (endpoint: string) =>
      api.post('/notifications/push/unsubscribe', { endpoint }),
  },

  // Consent-based support impersonation (owner side + impersonating session).
  impersonation: {
    // Drives the consent popup (owner), freeze overlay (owner), and support
    // banner (impersonating session). Returns viewerRole + pending + active.
    state: () =>
      api.get<{
        data?: {
          viewerRole: 'owner' | 'support';
          pending: Array<{
            grantId: string;
            ticket: string;
            supportName?: string;
            supportEmail?: string;
            code?: string;
            approvalExpiresAt?: string;
          }>;
          active: {
            grantId: string;
            ticket: string;
            supportName?: string;
            supportEmail?: string;
            sessionExpiresAt?: string;
            storeName?: string | null;
          } | null;
        };
      }>('/impersonation/state'),
    approve: (grantId: string) => api.post(`/impersonation/${grantId}/approve`),
    deny: (grantId: string) => api.post(`/impersonation/${grantId}/deny`),
    // Owner ends an active session (revoke — immediate).
    revoke: (grantId: string) => api.post(`/impersonation/${grantId}/revoke`),
    // Impersonating support session ends its own session (Exit impersonation).
    exitSelf: (grantId: string) => api.post(`/impersonation/${grantId}/exit-self`),
  },

  // Domain endpoints
  domains: {
    getInfo: () => api.get('/domains/info'),
    checkSubdomain: (subdomain: string) =>
      api.get(`/domains/check-subdomain?subdomain=${subdomain}`),
    checkCustomDomain: (domain: string) =>
      api.get(`/domains/check-custom-domain?domain=${domain}`),
    updateSubdomain: (subdomain: string) =>
      api.patch('/domains/subdomain', { subdomain }),
    addCustomDomain: (domain: string, verificationMethod?: string) =>
      api.post('/domains/custom', { domain, verificationMethod }),
    verifyCustomDomain: () => api.post('/domains/custom/verify'),
    removeCustomDomain: (domainId?: string) =>
      api.delete(domainId ? `/domains/custom/${encodeURIComponent(domainId)}` : '/domains/custom'),
    setPrimaryDomain: (primaryDomain: 'subdomain' | 'custom') =>
      api.patch('/domains/primary', { primaryDomain }),
    enableSSL: () => api.post('/domains/custom/ssl'),
    checkDNS: (domain: string) =>
      api.get(`/domains/dns-check?domain=${domain}`),
    getVerificationInstructions: () =>
      api.get('/domains/verification-instructions'),
  },

  // Product endpoints
  products: {
    getAll: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
    }) => api.get('/products', { params }),

    getById: (id: string) => api.get(`/products/${id}`),

    create: (data: unknown) => api.post('/products', data),

    update: (id: string, data: unknown) => api.put(`/products/${id}`, data),

    delete: (id: string) => api.delete(`/products/${id}`),
  },

  // Category endpoints
  categories: {
    getAll: () => api.get('/categories'),

    getById: (id: string) => api.get(`/categories/${id}`),

    create: (data: { name: string; description?: string; slug?: string }) =>
      api.post('/categories', data),

    update: (id: string, data: unknown) => api.put(`/categories/${id}`, data),

    delete: (id: string) => api.delete(`/categories/${id}`),
  },

  // Order endpoints
  orders: {
    getAll: (params?: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
      paymentStatus?: string;
      fulfillmentStatus?: string;
      tag?: string;
      from?: string;
      to?: string;
      /** Whitelisted server-side sort: createdAt | -createdAt | totalAmount | -totalAmount. */
      sort?: string;
    }) => api.get('/orders', { params }),

    // Single-aggregation list stats (audit 5.4.3). Summary figures respect
    // the same filter params as getAll; the 30-day comparison figures
    // (orders30d/ordersPrev30d/revenue30d/revenuePrev30d) are fixed rolling
    // windows and ignore filters. Draft orders are excluded server-side.
    getStats: (params?: {
      status?: string;
      search?: string;
      paymentStatus?: string;
      fulfillmentStatus?: string;
      tag?: string;
      from?: string;
      to?: string;
    }) => api.get('/orders/stats', { params }),

    // Server-side CSV export (audit 5.6.2) — streams the filtered list with
    // no row ceiling. Fetched as a blob (so the Bearer token is attached)
    // and downloaded client-side. Same filter params as getAll.
    exportCsv: (params?: {
      status?: string;
      search?: string;
      paymentStatus?: string;
      fulfillmentStatus?: string;
      tag?: string;
      from?: string;
      to?: string;
      sort?: string;
    }) => api.get('/orders/export.csv', { params, responseType: 'blob' }),

    getById: (id: string) => api.get(`/orders/${id}`),

    // Scoped line editing (audit 5.3) — replace the order's line items.
    // Server-guarded to unpaid + unfulfilled + Pending/Confirmed orders.
    editLines: (
      id: string,
      payload: { items: Array<{ productId: string; variantId?: string; quantity: number; price?: number }> },
    ) => api.put(`/orders/${id}/lines`, payload),

    // Resend a customer order-status email (audit 5.6.1). `template` is one
    // of the notifier's statuses (Pending/Processing/Shipped/Delivered/
    // Cancelled/Refunded). Audit-logged server-side.
    resendNotification: (id: string, template: string) =>
      api.post(`/orders/${id}/notifications/resend`, { template }),

    // Draft / manual orders (audit 5.2). Create + complete are guarded by
    // the Idempotency-Key middleware so a double-click can't produce two
    // drafts or double-decrement stock on completion.
    createDraft: (payload: DraftOrderPayload) =>
      api.post('/orders/draft', payload, idempotentConfig()),
    updateDraft: (id: string, payload: DraftOrderPayload) =>
      api.put(`/orders/${id}/draft`, payload),
    completeDraft: (id: string) =>
      api.post(`/orders/${id}/complete`, {}, idempotentConfig()),
    deleteDraft: (id: string) => api.delete(`/orders/${id}`),

    updateStatus: (id: string, status: string) =>
      api.patch(`/orders/${id}/status`, { status }),

    updateTracking: (id: string, trackingNumber: string, trackingCarrier?: string) =>
      api.patch(`/orders/${id}/tracking`, { trackingNumber, trackingCarrier }),

    cancel: (id: string) => api.post(`/orders/${id}/cancel`),

    // Payment actions — mark_paid / mark_failed / capture / void /
    // record_manual. Guarded server-side by the payment state machine;
    // requires orders.write. Added in PR3.
    paymentAction: (
      id: string,
      payload: {
        action: 'mark_paid' | 'mark_failed' | 'capture' | 'void' | 'record_manual';
        note?: string;
        amount?: number;
        reference?: string;
      }
    ) => api.post(`/orders/${id}/payment/action`, payload, idempotentConfig()),

    // Per-order fulfillments — list, create shipment, update shipment status
    getFulfillments: (id: string) => api.get(`/orders/${id}/fulfillments`),
    createFulfillment: (
      id: string,
      payload: {
        items: Array<{ orderLineId: string; quantity: number }>;
        trackingNumber?: string;
        trackingCarrier?: string;
        shippingCost?: number;
        notes?: string;
        markShipped?: boolean;
      }
    ) => api.post(`/orders/${id}/fulfillments`, payload, idempotentConfig()),
    updateFulfillmentStatus: (
      orderId: string,
      fulfillmentId: string,
      payload: { status: string; trackingNumber?: string; trackingCarrier?: string }
    ) => api.patch(`/orders/${orderId}/fulfillments/${fulfillmentId}/status`, payload),

    // Replacement orders — $0 duplicate of a subset of lines, linked to original.
    createReplacement: (
      orderId: string,
      payload: {
        items: Array<{ orderLineId: string; quantity: number }>;
        reason?: string;
        notes?: string;
      }
    ) => api.post(`/orders/${orderId}/replacements`, payload),

    // Returns (RMA) — lifecycle: Requested → Approved/Rejected → Received → Refunded.
    createReturn: (
      orderId: string,
      payload: {
        items: Array<{ orderLineId: string; quantity: number; reason?: string }>;
        reason?: string;
        notes?: string;
      }
    ) => api.post(`/orders/${orderId}/returns`, payload, idempotentConfig()),
    updateReturnStatus: (
      orderId: string,
      returnId: string,
      payload: { status: string; refundAmount?: number; note?: string }
    ) => api.patch(`/orders/${orderId}/returns/${returnId}/status`, payload),

    // Internal staff notes — not visible to customers.
    addNote: (id: string, body: string, pinned?: boolean) =>
      api.post(`/orders/${id}/notes`, { body, pinned: Boolean(pinned) }),
    deleteNote: (id: string, noteId: string) =>
      api.delete(`/orders/${id}/notes/${noteId}`),

    // Workflow tags — merchant-defined labels for triage/routing.
    addTags: (id: string, tags: string[]) =>
      api.post(`/orders/${id}/tags`, { tags }),
    removeTag: (id: string, tag: string) =>
      api.delete(`/orders/${id}/tags/${encodeURIComponent(tag)}`),

    // Customer context card (§8) — lifetime stats for the buyer on the
    // order. Returns { type, customerId, email, lifetimeOrderCount,
    // lifetimeSpend, previousRefunds, previousCancellations,
    // lastOrderDate, customerSince, marketingConsent }.
    customerContext: (id: string) =>
      api.get(`/orders/${id}/customer-context`),

    // Shipping/billing address editor (§9). Either or both addresses
    // may be provided; omitted addresses are left unchanged.
    updateAddresses: (
      id: string,
      payload: {
        shippingAddress?: Record<string, string | null | undefined>;
        billingAddress?: Record<string, string | null | undefined>;
      }
    ) => api.patch(`/orders/${id}/addresses`, payload),
  },

  // Theme endpoints
  themes: {
    getAll: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
    }) => api.get('/themes', { params }),

    getActive: () => api.get('/themes/active'),

    getById: (id: string) => api.get(`/themes/${id}`),

    getBySlug: (slug: string) => api.get(`/themes/slug/${slug}`),

    create: (data: unknown) => api.post('/themes', data),

    update: (id: string, data: unknown) => api.put(`/themes/${id}`, data),

    // NOTE: PATCH /themes/:id/settings was removed with the retirement of
    // the legacy Theme.settings blob (audit 1.2) — theme configuration
    // lives in the built manifest, not on catalog rows.

    install: (id: string) => api.post(`/themes/${id}/install`),

    uninstall: (id: string) => api.post(`/themes/${id}/uninstall`),
  },

  // Theme Customization endpoints
  themeCustomization: {
    get: () => api.get('/theme-customization'),

    getAvailableSections: () => api.get('/theme-customization/available-sections'),

    updateSettings: (settings: {
      colors?: Record<string, string>;
      typography?: Record<string, string>;
      layout?: Record<string, string>;
      /**
       * Manifest-level global settings bag (Shopify-style
       * theme.settings[]). Shape depends on the active theme's
       * manifest.settings[] declarations — each key must match a
       * declared setting id; unknown keys and out-of-range values are
       * rejected 400 by the backend.
       */
      theme?: Record<string, unknown>;
    }) => api.put('/theme-customization/settings', { settings }),

    /**
     * Update a single manifest-level global setting. Per-control save
     * so each dashboard toggle/color/range change is atomic; the
     * backend validates `key` against manifest.settings[] and types
     * `value` against the declared setting type.
     */
    updateThemeSetting: (key: string, value: unknown) =>
      api.patch(`/theme-customization/theme-settings/${encodeURIComponent(key)}`, { value }),

    /**
     * Helper: assemble the ?template= query param. Every section
     * mutation accepts a template id so the dashboard can compose
     * per-template layouts (home/product/collection/cart/search/page).
     * Defaults to "index" on the server; the dashboard sends it
     * explicitly so the network tab doubles as audit.
     */
    updateSections: (
      // Accepts the SDK SectionInstance shape: `disabled` is canonical,
      // `enabled` is legacy read-compat, `order` may be backfilled server-side.
      sections: Array<{
        id: string;
        type: string;
        enabled?: boolean;
        disabled?: boolean;
        order?: number;
        settings?: Record<string, unknown>;
        blocks?: unknown[];
      }>,
      opts: { template?: string } = {}
    ) => {
      const q = opts.template ? `?template=${encodeURIComponent(opts.template)}` : '';
      return api.put(`/theme-customization/sections${q}`, { sections });
    },

    addSection: (
      sectionType: string,
      settings?: Record<string, unknown>,
      position?: number,
      opts: { template?: string } = {}
    ) => {
      const q = opts.template ? `?template=${encodeURIComponent(opts.template)}` : '';
      return api.post(`/theme-customization/sections/add${q}`, { sectionType, settings, position });
    },

    removeSection: (sectionId: string, opts: { template?: string } = {}) => {
      const q = opts.template ? `?template=${encodeURIComponent(opts.template)}` : '';
      return api.delete(`/theme-customization/sections/${sectionId}${q}`);
    },

    updateSectionSettings: (
      sectionId: string,
      settings: Record<string, unknown>,
      blocks?: unknown[],
      opts: { template?: string } = {}
    ) => {
      const q = opts.template ? `?template=${encodeURIComponent(opts.template)}` : '';
      return api.patch(`/theme-customization/sections/${sectionId}/settings${q}`, { settings, blocks });
    },

    updateSectionElements: (
      sectionId: string,
      elements: unknown[],
      opts: { template?: string } = {}
    ) => {
      const q = opts.template ? `?template=${encodeURIComponent(opts.template)}` : '';
      return api.patch(`/theme-customization/sections/${sectionId}/elements${q}`, { elements });
    },

    duplicateSection: (sectionId: string, opts: { template?: string } = {}) => {
      const q = opts.template ? `?template=${encodeURIComponent(opts.template)}` : '';
      return api.post(`/theme-customization/sections/${sectionId}/duplicate${q}`);
    },

    toggleSection: (sectionId: string, enabled: boolean, opts: { template?: string } = {}) => {
      const q = opts.template ? `?template=${encodeURIComponent(opts.template)}` : '';
      return api.post(`/theme-customization/sections/${sectionId}/toggle${q}`, { enabled });
    },

    reorderSections: (sectionIds: string[], opts: { template?: string } = {}) => {
      const q = opts.template ? `?template=${encodeURIComponent(opts.template)}` : '';
      return api.post(`/theme-customization/sections/reorder${q}`, { sectionIds });
    },

    /**
     * List templates available for composition in the active theme.
     * Backed by GET /theme-customization/templates — returns the
     * platform allow-list annotated with whether the theme declares
     * manifest defaults for each template.
     */
    listTemplates: () => api.get('/theme-customization/templates'),

    updateCustomCSS: (css: string) =>
      api.put('/theme-customization/custom-css', { css }),

    generatePreview: (expiryMinutes?: number) =>
      api.post('/theme-customization/preview', { expiryMinutes }),

    publish: () => api.post('/theme-customization/publish'),

    reset: () => api.post('/theme-customization/reset'),

    // Theme manifest endpoints
    listThemes: () => api.get('/theme-customization/themes'),

    getManifest: (themeSlug: string) =>
      api.get(`/theme-customization/manifest/${themeSlug}`),

    getManifestSchema: (themeSlug: string) =>
      api.get(`/theme-customization/manifest/${themeSlug}/schema`),
  },

  // Store Setup endpoints — both calls take a one-time setup token issued
  // at registration. Without it the backend returns 404 (the same shape
  // it returns for an unknown tenant, on purpose), so the dashboard MUST
  // pass the token it received from /auth/register.
  storeSetup: {
    getStatus: (tenantId: string, token: string) =>
      api.get(`/store-setup/status/${tenantId}?token=${encodeURIComponent(token)}`),

    clearStatus: (tenantId: string, token: string) =>
      api.delete(`/store-setup/status/${tenantId}?token=${encodeURIComponent(token)}`),

    // Draft-starter status + owner preview URL (for the publish banner).
    starter: () =>
      api.get<{ responseObject?: { hasDraftStarter?: boolean; previewUrl?: string; themeSelected?: boolean; counts?: { products: number; collections: number; pages: number } } }>(
        '/store-setup/starter',
      ),

    // Publish the seeded draft starter content — take the store live.
    publishStarter: () => api.post<{ responseObject?: { products?: number; collections?: number; pages?: number } }>('/store-setup/publish-starter', {}),
  },

  // Upload endpoints
  upload: {
    productImages: (formData: FormData) => {
      return api.post('/upload/product', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    categoryImage: (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return api.post('/upload/category', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    logo: (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      return api.post('/upload/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    favicon: (file: File) => {
      const formData = new FormData();
      formData.append('favicon', file);
      return api.post('/upload/favicon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    providerLogo: (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('preset', 'logo');
      return api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    avatar: (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return api.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    genericImage: (file: File, preset?: string) => {
      const formData = new FormData();
      formData.append('image', file);
      if (preset) formData.append('preset', preset);
      return api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    // Media library upload (audit 6.6) — records an Asset with preset
    // "content" + the original filename, and returns the created row so
    // the caller can insert/select it without a re-fetch.
    contentImage: (file: File, alt?: string) => {
      const formData = new FormData();
      formData.append('image', file);
      if (alt) formData.append('alt', alt);
      return api.post('/upload/content', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    deleteImage: (imageUrl: string) =>
      api.delete('/upload/image', { data: { imageUrl } }),

    deleteImages: (imageUrls: string[]) =>
      api.delete('/upload/images', { data: { imageUrls } }),
  },
  // Analytics endpoints
  analytics: {
    getStats: (startDate: string, endDate: string) =>
      api.get('/analytics/stats', { params: { startDate, endDate } }),

    getSalesOverTime: (startDate: string, endDate: string) =>
      api.get('/analytics/sales-over-time', { params: { startDate, endDate } }),

    // Daily new customers/products — for the dashboard growth sparklines.
    getCountsOverTime: (startDate: string, endDate: string) =>
      api.get('/analytics/counts-over-time', { params: { startDate, endDate } }),

    getTopProducts: (limit: number = 5) =>
      api.get('/analytics/top-products', { params: { limit } }),
  },

  // Customer endpoints
  customers: {
    getAll: (params?: { page?: number; limit?: number; search?: string }) =>
      api.get('/customers', { params }),

    getById: (id: string) => api.get(`/customers/${id}`),

    update: (id: string, data: unknown) => api.patch(`/customers/${id}`, data),
  },

  // Review endpoints
  reviews: {
    getAll: (params?: { page?: number; limit?: number; status?: string; product?: string }) =>
      api.get('/reviews', { params }),

    approve: (id: string) => api.patch(`/reviews/${id}/approve`),

    reject: (id: string) => api.patch(`/reviews/${id}/reject`),

    delete: (id: string) => api.delete(`/reviews/${id}`),
  },

  // Inventory endpoints
  inventory: {
    getAll: (params?: { page?: number; limit?: number; lowStock?: number; search?: string }) =>
      api.get('/inventory', { params }),

    getLowStock: (threshold?: number) =>
      api.get('/inventory/low-stock', { params: { threshold } }),

    getByProduct: (productId: string) => api.get(`/inventory/${productId}`),

    update: (productId: string, data: unknown) => api.put(`/inventory/${productId}`, data),

    adjustStock: (productId: string, adjustment: number, reason?: string) =>
      api.post(`/inventory/${productId}/adjust`, { adjustment, reason }),
  },

  // Payment endpoints
  payments: {
    createIntent: (orderId: string) =>
      api.post('/payments/create-intent', { orderId }),

    refund: (
      orderId: string,
      amount?: number,
      opts?: { manual?: boolean; reason?: string; refundDetails?: Record<string, unknown> }
    ) =>
      api.post(
        '/payments/refund',
        {
          orderId,
          amount,
          manual: opts?.manual,
          reason: opts?.reason,
          refundDetails: opts?.refundDetails,
        },
        idempotentConfig()
      ),

    verifyManual: (orderId: string, opts?: { note?: string }) =>
      api.post('/payments/verify-manual', { orderId, note: opts?.note }),

    listForOrder: (orderId: string) =>
      api.get(`/payments/order/${orderId}`),
  },

  // Payment-method definitions (the tenant's configured COD / bank transfer /
  // stripe entries). Needed by the order details page to resolve the
  // customerFields schema for the order's selected method.
  paymentMethods: {
    list: () => api.get('/payment-methods'),
  },

  // Discount endpoints
  discounts: {
    getAll: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
      api.get('/discounts', { params }),
    create: (data: unknown) => api.post('/discounts', data),
    update: (id: string, data: unknown) => api.put(`/discounts/${id}`, data),
    delete: (id: string) => api.delete(`/discounts/${id}`),
    // Dry-run a code against the caller's current cart. Used by the
    // Discounts UI preview tool and by checkout preflight.
    validate: (code: string) => api.post('/discounts/validate', { code }),
  },

  // Merchant webhooks (event notifications to external services)
  webhooks: {
    getAll: () => api.get('/webhooks'),
    getById: (id: string) => api.get(`/webhooks/${id}`),
    create: (data: { url: string; description?: string; events: string[]; enabled?: boolean }) =>
      api.post('/webhooks', data),
    update: (id: string, data: Partial<{ url: string; description: string; events: string[]; enabled: boolean }>) =>
      api.put(`/webhooks/${id}`, data),
    toggle: (id: string, enabled: boolean) =>
      api.patch(`/webhooks/${id}`, { enabled }),
    delete: (id: string) => api.delete(`/webhooks/${id}`),
    test: (id: string) => api.post(`/webhooks/${id}/test`),
  },

  // Fulfillment endpoints
  fulfillments: {
    getAll: (params?: { page?: number; limit?: number; status?: string; orderId?: string }) =>
      api.get('/fulfillments', { params }),
    getById: (id: string) => api.get(`/fulfillments/${id}`),
    create: (data: unknown) => api.post('/fulfillments', data),
    update: (id: string, data: unknown) => api.put(`/fulfillments/${id}`, data),
    updateStatus: (id: string, status: string) =>
      api.patch(`/fulfillments/${id}/status`, { status }),
  },

  // Market endpoints
  markets: {
    getAll: () => api.get('/markets'),
    getById: (id: string) => api.get(`/markets/${id}`),
    create: (data: unknown) => api.post('/markets', data),
    update: (id: string, data: unknown) => api.put(`/markets/${id}`, data),
    delete: (id: string) => api.delete(`/markets/${id}`),
  },

  // Company (B2B) endpoints
  companies: {
    getAll: (params?: { page?: number; limit?: number; search?: string }) =>
      api.get('/companies', { params }),
    getById: (id: string) => api.get(`/companies/${id}`),
    create: (data: unknown) => api.post('/companies', data),
    update: (id: string, data: unknown) => api.put(`/companies/${id}`, data),
    delete: (id: string) => api.delete(`/companies/${id}`),
  },

  // Custom Fields (Metafields) endpoints
  customFields: {
    getAll: (params?: { resource?: string; resourceId?: string; namespace?: string }) =>
      api.get('/custom-fields', { params }),
    // Backend uses a single POST /custom-fields upsert endpoint —
    // create and update both route to it; _id presence discriminates.
    create: (data: Record<string, unknown>) => api.post('/custom-fields', data),
    update: (_id: string, data: Record<string, unknown>) =>
      api.post('/custom-fields', { ...data, _id }),
    delete: (id: string) => api.delete(`/custom-fields/${id}`),
  },

  // Audit Log endpoints
  auditLogs: {
    getAll: (params?: { page?: number; limit?: number; action?: string; actor?: string; resource?: string }) =>
      api.get('/audit-logs', { params }),
  },

  // Settings endpoints — mounted under /store-settings on the backend.
  settings: {
    update: (data: unknown) => api.put('/store-settings', data),

    // Shipping zones (granular CRUD avoids round-tripping the full settings blob)
    listShippingZones: () => api.get('/store-settings/shipping/zones'),
    createShippingZone: (zone: unknown) => api.post('/store-settings/shipping/zones', zone),
    updateShippingZone: (zoneId: string, zone: unknown) =>
      api.put(`/store-settings/shipping/zones/${zoneId}`, zone),
    deleteShippingZone: (zoneId: string) =>
      api.delete(`/store-settings/shipping/zones/${zoneId}`),

    // Tax rates
    listTaxRates: () => api.get('/store-settings/tax/rates'),
    createTaxRate: (rate: unknown) => api.post('/store-settings/tax/rates', rate),
    updateTaxRate: (rateId: string, rate: unknown) =>
      api.put(`/store-settings/tax/rates/${rateId}`, rate),
    deleteTaxRate: (rateId: string) =>
      api.delete(`/store-settings/tax/rates/${rateId}`),

    // Markets (per-row CRUD against the settings doc)
    listMarketsSettings: () => api.get('/store-settings/markets'),
    createMarketSettings: (market: unknown) => api.post('/store-settings/markets', market),
    updateMarketSettings: (id: string, market: unknown) =>
      api.put(`/store-settings/markets/${id}`, market),
    deleteMarketSettings: (id: string) =>
      api.delete(`/store-settings/markets/${id}`),

    // Currencies (base + FX rates table)
    updateCurrencies: (data: { base?: string; rates?: Record<string, number> }) =>
      api.put('/store-settings/currencies', data),

    // Order status notifications (per-status email templates)
    getNotifications: () => api.get('/store-settings/notifications'),
    updateNotifications: (data: unknown) => api.put('/store-settings/notifications', data),
  },

  // Customer segments (saved filters)
  customerSegments: {
    getAll: () => api.get('/customer-segments'),
    getById: (id: string) => api.get(`/customer-segments/${id}`),
    preview: (id: string) => api.get(`/customer-segments/${id}/preview`),
    previewFilters: (filters: unknown) => api.post('/customer-segments/preview', filters),
    create: (data: unknown) => api.post('/customer-segments', data),
    update: (id: string, data: unknown) => api.put(`/customer-segments/${id}`, data),
    delete: (id: string) => api.delete(`/customer-segments/${id}`),
  },

  // Theme customization version history & rollback
  themeVersions: {
    list: () => api.get('/theme-customization/versions'),
    get: (version: number | string) => api.get(`/theme-customization/versions/${version}`),
    rollback: (version: number | string) =>
      api.post(`/theme-customization/versions/${version}/rollback`),
  },

  // CMS-style static content pages (About, Contact, Privacy, …).
  // Linked to navigation menus via the menu item `page` type — the
  // picker in MenuForm fetches this list and stores the page _id on
  // the menu item's `resourceId`.
  pages: {
    list: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      published?: boolean | string;
      locale?: string;
    }) => api.get('/pages', { params }),
    get: (id: string) => api.get(`/pages/${id}`),
    getBySlug: (slug: string, locale?: string) =>
      api.get(`/storefront/pages/${encodeURIComponent(slug)}`, {
        params: locale ? { locale } : undefined,
      }),
    create: (data: {
      title: string;
      slug?: string;
      content?: string;
      metaTitle?: string;
      metaDescription?: string;
      locale?: string;
      isPublished?: boolean;
    }) => api.post('/pages', data),
    update: (id: string, data: Partial<{
      title: string;
      slug: string;
      content: string;
      metaTitle: string;
      metaDescription: string;
      locale: string;
      isPublished: boolean;
    }>) => api.put(`/pages/${id}`, data),
    delete: (id: string) => api.delete(`/pages/${id}`),
  },

  // Media library (audit 6.6). Browse/reuse uploaded assets. Uploads go
  // through api.upload.contentImage; deletion reuses api.upload.deleteImage.
  assets: {
    list: (params?: {
      page?: number;
      limit?: number;
      preset?: string;
      search?: string;
    }) => api.get('/assets', { params }),
    updateAlt: (id: string, alt: string) => api.patch(`/assets/${id}`, { alt }),
  },

  // URL redirects (audit 6.7). 301/302 mapping of old storefront paths.
  redirects: {
    list: (params?: { page?: number; limit?: number; search?: string }) =>
      api.get('/redirects', { params }),
    get: (id: string) => api.get(`/redirects/${id}`),
    create: (data: { fromPath: string; toPath: string; statusCode?: number }) =>
      api.post('/redirects', data),
    update: (id: string, data: Partial<{ fromPath: string; toPath: string; statusCode: number }>) =>
      api.put(`/redirects/${id}`, data),
    delete: (id: string) => api.delete(`/redirects/${id}`),
  },
};

export default apiClient;
