import { http, cleanParams as clean, type Pagination, type BadgeVariant } from './api';
import { formatAmount as formatBillingAmount } from './api-billing';

/** Cross-store commerce inspection (read-only). Mounted at /api/platform/commerce. */

export interface TenantRef { name?: string; slug?: string }

export interface OrderRow {
  _id: string;
  tenantId: string;
  tenant: TenantRef;
  orderNumber?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  paymentMethod?: string;
  totalAmount?: number;
  refundedAmount?: number;
  currency?: string | null;
  itemCount?: number;
  customer?: { name?: string; email?: string };
  shipTo?: { city?: string; country?: string };
  createdAt: string;
  updatedAt?: string;
}

export interface TimelineItem {
  at: string;
  label: string;
  actor?: string | null;
  details?: Record<string, unknown>;
}

export interface OrderLine {
  name: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  variantOptions: Array<{ name: string; value: string }>;
}

export interface OrderDetail {
  order: {
    _id: string;
    orderNumber: string | null;
    status: string | null;
    paymentStatus: string | null;
    fulfillmentStatus: string | null;
    paymentMethod: string | null;
    paymentMethodCode: string | null;
    totalAmount: number | null;
    subtotal: number | null;
    shippingCost: number | null;
    tax: number | null;
    discount: number | null;
    refundedAmount: number;
    baseCurrency: string | null;
    currency: string | null;
    trackingNumber: string | null;
    trackingCarrier: string | null;
    createdAt: string;
    updatedAt: string | null;
    customer: { name: string | null; email: string | null; phone: string | null };
    shipTo: { city: string | null; country: string | null };
    items: OrderLine[];
  };
  tenant: (TenantRef & { _id: string }) | null;
  timeline: TimelineItem[];
}

export interface ProductRow {
  _id: string;
  tenantId: string;
  tenant: TenantRef;
  currency?: string;
  name: string;
  slug: string;
  sku?: string;
  status: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  hasVariants?: boolean;
  variantCount?: number;
  variantStock?: number;
  trackInventory?: boolean;
  lowStockThreshold?: number;
  isDemo?: boolean;
  image?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductDetail {
  product: ProductRow & {
    images?: string[];
    category?: { _id: string; name: string; slug: string } | null;
    options?: Array<{ name: string; values: string[] }>;
    variants: Array<{ _id: string; sku?: string; optionValues?: Array<{ name: string; value: string }>; price?: number; compareAtPrice?: number; stock: number; image?: string }>;
    tags?: string[];
    featured?: boolean;
  };
  collections: Array<{ _id: string; title: string; handle: string; isPublished: boolean }>;
  tenant: (TenantRef & { _id: string }) | null;
}

export interface CustomerRow {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  customerType?: string;
  totalOrders?: number;
  totalSpent?: number;
  isActive?: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  lastOrder?: { at: string; orderNumber?: string } | null;
}

export interface InventoryRow {
  _id: string;
  tenantId: string;
  tenant: TenantRef;
  name: string;
  sku?: string;
  status: string;
  hasVariants?: boolean;
  onHand: number;
  lowStockThreshold?: number;
  variants: Array<{ _id: string; sku?: string; stock: number; optionValues?: Array<{ name: string; value: string }> }>;
  updatedAt?: string;
}

export interface OrderFilters {
  q?: string; tenantId?: string; status?: string; paymentStatus?: string; from?: string; to?: string;
  currency?: string; min?: number; max?: number; page?: number; limit?: number;
}

export const commerceApi = {
  orders: {
    list: async (params: OrderFilters) => {
      const res = await http.get('/commerce/orders', { params: clean(params) });
      return res.data.data as { orders: OrderRow[]; pagination: Pagination & { limit?: number } };
    },
    get: async (tenantId: string, orderId: string) => {
      const res = await http.get(`/commerce/orders/${tenantId}/${orderId}`);
      return res.data.data as OrderDetail;
    },
  },
  products: {
    list: async (params: { q?: string; tenantId?: string; status?: string; sku?: string; page?: number; limit?: number }) => {
      const res = await http.get('/commerce/products', { params: clean(params) });
      return res.data.data as { products: ProductRow[]; pagination: Pagination };
    },
    get: async (tenantId: string, productId: string) => {
      const res = await http.get(`/commerce/products/${tenantId}/${productId}`);
      return res.data.data as ProductDetail;
    },
  },
  customers: {
    list: async (params: { tenantId: string; q?: string; page?: number; limit?: number }) => {
      const res = await http.get('/commerce/customers', { params: clean(params) });
      return res.data.data as { customers: CustomerRow[]; tenant: { _id: string; name: string; slug: string; currency: string | null } | null; pagination: Pagination };
    },
  },
  inventory: {
    list: async (params: { tenantId?: string; lowStock?: boolean; negative?: boolean; q?: string; page?: number; limit?: number }) => {
      const res = await http.get('/commerce/inventory', { params: clean({ ...params, lowStock: params.lowStock ? 1 : undefined, negative: params.negative ? 1 : undefined }) });
      return res.data.data as { items: InventoryRow[]; pagination: Pagination };
    },
  },
};

/** Major-unit money for commerce screens; delegates to the billing formatter (null currency → SDG). */
export function formatAmount(amount?: number | null, currency?: string | null): string {
  return formatBillingAmount(amount, currency || 'SDG');
}

export const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded', 'Archived', 'Draft'] as const;
export const PAYMENT_STATUSES = ['Not Paid', 'Authorized', 'Paid', 'Partially Refunded', 'Refunded', 'Voided', 'Failed'] as const;
export const PRODUCT_STATUSES = ['active', 'draft', 'archived'] as const;

/** Badge tones for status pills (kept out of component files for fast-refresh). */
export const ORDER_TONE: Record<string, BadgeVariant> = {
  Delivered: 'success', Cancelled: 'destructive', Refunded: 'warning', Pending: 'secondary', Draft: 'outline',
};
export const PAYMENT_TONE: Record<string, BadgeVariant> = {
  Paid: 'success', Failed: 'destructive', Refunded: 'warning', 'Partially Refunded': 'warning', 'Not Paid': 'outline',
};
