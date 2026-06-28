/**
 * Storefront API Client
 * Shared across all themes — communicates with the headless backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const STOREFRONT_BASE = import.meta.env.VITE_STOREFRONT_URL || '/storefront';

// ─── Theme preview mode ──────────────────────────────────────────
//
// When the dashboard opens the storefront with `?previewTheme=<slug>`, the
// backend serves that theme's bundle and returns EPHEMERAL demo data (never
// the merchant's real catalog, nothing written to the DB). We capture the flag
// ONCE at module load: client-side navigation may drop the query param from the
// address bar, but preview must stay sticky for the whole session so every
// subsequent API call keeps returning demo data (and cart/checkout stay
// short-circuited — demo products don't exist in the DB).
const PREVIEW_THEME_SLUG: string | null = (() => {
  if (typeof window === 'undefined') return null;
  try {
    const slug = new URLSearchParams(window.location.search).get('previewTheme');
    return slug && slug.trim() ? slug.trim() : null;
  } catch {
    return null;
  }
})();

/** True when the storefront is being rendered as a theme preview. */
export function isPreviewMode(): boolean {
  return PREVIEW_THEME_SLUG !== null;
}

/** The slug of the theme being previewed, or null when not in preview mode. */
export function previewThemeSlug(): string | null {
  return PREVIEW_THEME_SLUG;
}

/** Append `previewTheme=<slug>` to a storefront URL while in preview mode. */
function withPreview(url: string): string {
  if (!PREVIEW_THEME_SLUG) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}previewTheme=${encodeURIComponent(PREVIEW_THEME_SLUG)}`;
}

/**
 * Surface a "preview mode — purchasing is disabled" notice. Cart/checkout flows
 * short-circuit in preview (demo products aren't in the DB), and this lets the
 * shared Toast layer show feedback even though the CartProvider sits ABOVE the
 * ToastProvider in the tree (so it can't call `useToast`). Falls back to the
 * console when no toast layer is mounted.
 */
export function notifyPreviewDisabled(message: string): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('storefront:toast', { detail: { message, type: 'info' } })
    );
    return;
  }
  // eslint-disable-next-line no-console
  console.info(`[preview] ${message}`);
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('customer_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // `credentials: 'include'` is required for the guest-cart session
  // cookie to round-trip on cross-origin requests (custom domain →
  // api subdomain). For same-origin it's a no-op.
  const res = await fetch(url, { credentials: 'include', ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    const details = Array.isArray(data.errors)
      ? data.errors
          .map((err: any) => {
            if (typeof err === 'string') return err;
            const field = err?.field ? `${err.field}: ` : '';
            return `${field}${err?.message || JSON.stringify(err)}`;
          })
          .join('; ')
      : '';
    throw new Error(
      [data.message || `Request failed: ${res.status}`, details]
        .filter(Boolean)
        .join(' — ')
    );
  }

  return data;
}

// ─── Storefront (public) ─────────────────────────────────────────

export const storefrontApi = {
  /**
   * Store metadata, theme customization, branding.
   *
   * If the current page URL carries a `?preview=<token>` query param
   * (dashboard editor preview iframe), forward it to the backend so
   * the response contains the draft customization instead of the
   * published one. Shoppers never hit this path — tokens are 32-byte
   * CSPRNG secrets scoped to a single tenant's draft.
   */
  getStoreInfo: () => {
    let url = `${STOREFRONT_BASE}/store-info`;
    if (typeof window !== 'undefined') {
      const preview = new URLSearchParams(window.location.search).get('preview');
      if (preview) url += `?preview=${encodeURIComponent(preview)}`;
    }
    return request<any>(withPreview(url));
  },

  /** Product listing with filters */
  getProducts: (params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).reduce((a, [k, v]) => ({ ...a, [k]: String(v) }), {} as Record<string, string>)
    ).toString() : '';
    return request<any>(withPreview(`${STOREFRONT_BASE}/products${qs}`));
  },

  /** Featured products */
  getFeaturedProducts: (limit = 8) =>
    request<any>(withPreview(`${STOREFRONT_BASE}/products/featured?limit=${limit}`)),

  /** Single product by slug */
  getProduct: (slug: string) =>
    request<any>(withPreview(`${STOREFRONT_BASE}/products/${slug}`)),

  /** All categories */
  getCategories: () =>
    request<any>(withPreview(`${STOREFRONT_BASE}/categories`)),

  /** Category with products */
  getCategory: (slug: string, params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).reduce((a, [k, v]) => ({ ...a, [k]: String(v) }), {} as Record<string, string>)
    ).toString() : '';
    return request<any>(withPreview(`${STOREFRONT_BASE}/categories/${slug}${qs}`));
  },

  /** All collections */
  getCollections: () =>
    request<any>(withPreview(`${STOREFRONT_BASE}/collections`)),

  /** Collection with products (supports sort, page, limit) */
  getCollection: (handle: string, params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).reduce((a, [k, v]) => ({ ...a, [k]: String(v) }), {} as Record<string, string>)
    ).toString() : '';
    return request<any>(withPreview(`${STOREFRONT_BASE}/collections/${handle}${qs}`));
  },
};

// ─── Cart ────────────────────────────────────────────────────────

export const cartApi = {
  get: () =>
    request<any>(`${API_BASE}/cart`),

  addItem: (productId: string, quantity = 1, variantId?: string) =>
    request<any>(`${API_BASE}/cart/add`, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, variantId }),
    }),

  updateItem: (productId: string, quantity: number, variantId?: string) =>
    request<any>(`${API_BASE}/cart/update`, {
      method: 'PUT',
      body: JSON.stringify({ productId, quantity, variantId }),
    }),

  removeItem: (productId: string, variantId?: string) =>
    request<any>(`${API_BASE}/cart/remove`, {
      method: 'DELETE',
      body: JSON.stringify({ productId, variantId }),
    }),

  clear: () =>
    request<any>(`${API_BASE}/cart/clear`, { method: 'DELETE' }),
};

// ─── Auth (customer) ─────────────────────────────────────────────
// These hit the storefront-scoped endpoints — tenant is resolved from
// the request hostname, so no `domain` field is needed in the body.

export const authApi = {
  login: (email: string, password: string) =>
    request<any>(`${STOREFRONT_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { name: string; email: string; password: string; phone?: string }) =>
    request<any>(`${STOREFRONT_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => request<any>(`${STOREFRONT_BASE}/auth/me`),

  updateMe: (data: {
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    acceptsMarketing?: boolean;
  }) =>
    request<any>(`${STOREFRONT_BASE}/auth/me`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addAddress: (address: {
    label?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    isDefault?: boolean;
  }) =>
    request<any>(`${STOREFRONT_BASE}/auth/me/addresses`, {
      method: 'POST',
      body: JSON.stringify(address),
    }),

  updateAddress: (
    addressId: string,
    patch: Partial<{
      label: string;
      firstName: string;
      lastName: string;
      phone: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      isDefault: boolean;
    }>
  ) =>
    request<any>(`${STOREFRONT_BASE}/auth/me/addresses/${addressId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteAddress: (addressId: string) =>
    request<any>(`${STOREFRONT_BASE}/auth/me/addresses/${addressId}`, {
      method: 'DELETE',
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<any>(`${STOREFRONT_BASE}/auth/me/password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  deleteAccount: () =>
    request<any>(`${STOREFRONT_BASE}/auth/me`, { method: 'DELETE' }),

  // GDPR Article 15 — download a JSON dump of everything we store.
  exportMyData: async (): Promise<Blob> => {
    const token = typeof localStorage !== 'undefined'
      ? localStorage.getItem('storefront_token') || localStorage.getItem('auth_token')
      : null;
    const res = await fetch(`${STOREFRONT_BASE}/auth/me/export`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    return res.blob();
  },

  // GDPR Article 17 — right to erasure. Requires password confirmation.
  anonymize: (password: string) =>
    request<any>(`${STOREFRONT_BASE}/auth/me/anonymize`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};

// ─── Checkout (live pricing) ─────────────────────────────────────

export const checkoutApi = {
  quote: (data: {
    shippingAddress?: Record<string, string | undefined>;
    discountCode?: string;
  }) =>
    request<any>(`${STOREFRONT_BASE}/checkout/quote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Orders ──────────────────────────────────────────────────────

export const ordersApi = {
  myOrders: () => request<any>(`${API_BASE}/orders/my-orders`),

  get: (id: string) => request<any>(`${API_BASE}/orders/${id}`),

  /**
   * Cancel an order. Customers can only cancel their own orders, and only
   * while the order is still in Pending or Processing status — the backend
   * enforces both rules. Releases preorder holds and restores stock.
   */
  cancel: (id: string) =>
    request<any>(`${API_BASE}/orders/${id}/cancel`, { method: 'POST' }),

  /**
   * Public order lookup used by the customer-facing tracking page.
   * Logged-in customers don't need guest credentials. Guests pass the email
   * used at checkout; tokenized confirmation links also pass `token`.
   */
  track: (id: string, email?: string, token?: string) => {
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (token) params.set('token', token);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<any>(`${STOREFRONT_BASE}/orders/${id}${qs}`);
  },

  create: (data: {
    items?: Array<{ productId: string; quantity: number; variantId?: string }>;
    shippingAddress: Record<string, string | undefined>;
    billingAddress?: Record<string, string | undefined>;
    paymentMethod: string;
    paymentMethodCode?: string;
    paymentDetails?: Record<string, any>;
    notes?: string;
    discountCode?: string;
    giftCardCode?: string;
    giftCardId?: string;
    shippingMethod?: { id?: string; name?: string; price?: number };
    customerEmail?: string;
    customerPhone?: string;
    acceptsMarketing?: boolean;
    saveAddress?: boolean;
    idempotencyKey?: string;
  }) =>
    // Use the guest-friendly storefront route (optionalAuth) so shoppers
    // without an account can place orders. /api/orders uses authenticate
    // and would return "No token provided" for guests.
    request<any>(`${STOREFRONT_BASE}/orders`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Contact ─────────────────────────────────────────────────────

export const contactApi = {
  /**
   * Submit a contact-form message. Logged-in customers don't need to pass
   * name/email — the bearer token attaches their user record server-side.
   */
  send: (data: { name?: string; email?: string; subject: string; message: string }) =>
    request<any>(`${STOREFRONT_BASE}/contact`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Reviews ─────────────────────────────────────────────────────

export const reviewsApi = {
  /**
   * Submit a product review. Requires the customer to be signed in
   * (token attached automatically by `request`). The server tags the
   * review as a verified purchase if the customer has any Delivered
   * order containing the product.
   */
  create: (data: { productId: string; rating: number; title?: string; comment: string }) =>
    request<any>(`${STOREFRONT_BASE}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * List the signed-in customer's own reviews. Used by the Reviews tab
   * on the account page so customers can see everything they've posted.
   */
  mine: () => request<any>(`${STOREFRONT_BASE}/reviews/mine`),
};

// ─── Wishlist ────────────────────────────────────────────────────

export const wishlistApi = {
  get: () => request<any>(`${API_BASE}/wishlist`),

  toggle: (productId: string) =>
    request<any>(`${API_BASE}/wishlist/toggle`, {
      method: 'POST',
      body: JSON.stringify({ productId }),
    }),
};

// ─── Discounts ───────────────────────────────────────────────────
// Storefront-facing discount validation. The server reads the cart
// from the customer's session — we never trust client-supplied totals.

export const discountApi = {
  validate: (code: string) =>
    request<any>(`${API_BASE}/discounts/validate`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
};

// ─── Gift cards ──────────────────────────────────────────────────
// Storefront-facing gift-card lookup + redemption. Lookup validates
// the code and returns the remaining balance; redeem atomically
// decrements that balance against an order.

export const giftCardApi = {
  lookup: (code: string) =>
    request<any>(`${STOREFRONT_BASE}/giftcards/lookup`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  redeem: (code: string, amount: number, orderId?: string) =>
    request<any>(`${STOREFRONT_BASE}/giftcards/redeem`, {
      method: 'POST',
      body: JSON.stringify({ code, amount, orderId }),
    }),

  myCards: () =>
    request<any>(`${STOREFRONT_BASE}/me/giftcards`, { method: 'GET' }),
};

// ─── Payment methods ─────────────────────────────────────────────
// Public list of the tenant's currently enabled payment methods, including
// any dynamic customer-facing form fields (bank transfer receipt, etc.).
// Secrets (API keys) live under `config` on the admin-side document and
// are never returned here.

export interface PaymentMethodField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'file' | 'select' | 'email' | 'tel';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  accept?: string;
  maxSize?: number;
}

export interface PaymentMethodManualProvider {
  code: string;
  label: string;
  logo?: string;
  accountNumber?: string;
  beneficiaryName?: string;
  phone?: string;
  instructions?: string;
}

export interface PaymentMethodPublic {
  code: string;
  type: 'gateway' | 'manual' | 'cod';
  label: string;
  description?: string;
  providerLogos?: string[];
  icon?: string;
  instructions?: string;
  customerFields?: PaymentMethodField[];
  providers?: PaymentMethodManualProvider[];
  order?: number;
}

export const paymentMethodsApi = {
  list: () => request<any>(`${STOREFRONT_BASE}/payment-methods`),
};

// ─── Markets ─────────────────────────────────────────────────────
// Resolve the active market for the visitor (currency, locale, tax
// behaviour). The /resolve endpoint inspects the request country
// header / IP and returns the matching market or the default.

export const marketsApi = {
  list: () => request<any>(`${API_BASE}/markets`),
  resolve: () => request<any>(`${API_BASE}/markets/resolve`),
};
