// Auth types
export interface User {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  roles: string[];
  avatar?: string;
}

export interface AuthResponse {
  responseObject: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    email: string;
    name: string;
    tenantId?: string;
    tenantDomain?: string | null;
    tenantSlug?: string | null;
    roles: string[];
    user: User;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
  // Only supplied when resolving a store-picker handoff — the server
  // returns the tenant list when an email owns multiple stores and the
  // caller re-submits with one of those ids.
  tenantId?: string;
  // Keep the session on the current origin (skip the cross-host redirect to
  // the store subdomain). Used by the "add a store" picker flow.
  skipHostRedirect?: boolean;
}

export interface StoreChoice {
  id: string;
  name: string;
  slug: string;
  domain: string;
}

export interface StoreSelectionResponse {
  requiresStoreSelection: true;
  data: { stores: StoreChoice[] };
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  subdomain?: string;
  subscriptionPlan?: string;
}

// Domain types
export interface DomainInfo {
  subdomain: {
    name: string;
    fullDomain: string;
    isActive: boolean;
  };
  customDomain: {
    name: string;
    isVerified: boolean;
    verifiedAt?: string;
    sslEnabled: boolean;
    sslIssuedAt?: string;
  } | null;
  primaryDomain: 'subdomain' | 'custom';
  activeDomain: string;
  allDomains: string[];
  canUseCustomDomain: boolean;
  subscriptionPlan: string;
}

export interface VerificationInstructions {
  method: string;
  instructions: string[];
  record?: {
    type: string;
    name: string;
    value: string;
  };
  records?: Array<{
    type: string;
    name: string;
    value: string;
  }>;
}

// Product types
export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  salePrice?: number;
  // Strikethrough "was" price. When set and greater than price, the
  // storefront renders the discount badge and savings line.
  compareAtPrice?: number;
  sku: string;
  category: string | Category;
  images: string[];
  stock: number;
  // See schemas/store/product.js — these gate the inventory dashboard /
  // low-stock report. Optional on the wire because legacy tenants may not
  // have them yet (Mongoose default kicks in on next save).
  trackInventory?: boolean;
  lowStockThreshold?: number;
  status: 'draft' | 'active' | 'archived';
  featured: boolean;
  tags: string[];
  hasVariants?: boolean;
  options?: ProductOption[];
  variants?: ProductVariant[];
  preorder?: PreorderConfig;
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** A single option axis on a variant-enabled product (e.g. Color, Size). */
export interface ProductOption {
  name: string;
  values: string[];
}

/**
 * Pre-order configuration. Used at both product- and variant-level.
 * `unitsReserved` is a server-managed counter — never edited by hand.
 */
export interface PreorderConfig {
  enabled?: boolean;
  expectedShipDate?: string | null;
  maxUnits?: number | null;
  unitsReserved?: number;
  maxPerCustomer?: number | null;
  chargePolicy?: 'now' | 'on_ship';
}

/** A concrete variant — one row in the option matrix. */
export interface ProductVariant {
  /** Mongoose subdocument _id. Optional on the client until persisted. */
  _id?: string;
  sku?: string;
  barcode?: string;
  /** Concrete option pairs, e.g. [{name:"Color",value:"Red"},{name:"Size",value:"M"}] */
  optionValues: { name: string; value: string }[];
  /** Override of product.price. Undefined = inherit. */
  price?: number;
  compareAtPrice?: number;
  stock: number;
  image?: string;
  weight?: number;
  position?: number;
  preorder?: PreorderConfig;
}

export interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  price: number;
  salePrice?: number;
  sku: string;
  category: string;
  stock: number;
  status: 'draft' | 'active' | 'archived';
  featured: boolean;
  tags: string[];
  images?: string[];
  hasVariants?: boolean;
  options?: ProductOption[];
  variants?: ProductVariant[];
  preorder?: PreorderConfig;
}

// Category types
export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  parent?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryFormData {
  name: string;
  description?: string;
  slug?: string;
  parent?: string;
  image?: string;
  icon?: string;
}

// Order types
export interface Order {
  _id: string;
  orderNumber: string;
  user?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  guestCustomer?: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  customerSnapshot?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  products: OrderItem[];
  subtotal?: number;
  tax?: number;
  shipping?: number;
  shippingCost?: number;
  discount?: number;
  total?: number;
  totalAmount: number;
  giftCardRedemption?: {
    code?: string;
    codeLast4?: string;
    amount?: number;
    redeemedAt?: string;
  };
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  paymentMethod: string;
  paymentMethodCode?: string;
  shippingAddress: Address;
  billingAddress?: Address;
  shippingMethod?: {
    id: string;
    name: string;
    price: number;
  };
  trackingNumber?: string;
  trackingCarrier?: string;
  notes?: string;
  internalNotes?: Array<{
    _id: string;
    body: string;
    createdBy?: string;
    createdByName?: string;
    createdAt: string;
    updatedAt?: string;
    deletedAt?: string;
    pinned?: boolean;
  }>;
  tags?: string[];
  history?: OrderHistoryEntry[];
  returns?: OrderReturn[];
  replacementOf?: string;
  replacementOrders?: string[];
  createdAt: string;
  updatedAt: string;
}

export type OrderReturnStatus =
  | 'Requested'
  | 'Approved'
  | 'Rejected'
  | 'Received'
  | 'Refunded';

export interface OrderReturn {
  _id: string;
  status: OrderReturnStatus;
  items: Array<{
    orderLineId: string;
    quantity: number;
    reason?: string;
  }>;
  reason?: string;
  refundAmount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  history?: OrderHistoryEntry[];
}

export interface OrderHistoryEntry {
  event: string;
  status?: string;
  previousStatus?: string;
  note?: string;
  by?: string | { _id: string; name?: string };
  byName?: string;
  at: string;
}

export interface OrderItem {
  _id?: string;
  product: string | Product;
  name?: string;
  sku?: string;
  image?: string;
  quantity: number;
  price: number;
  total?: number;
  variantId?: string;
  variantOptions?: { name: string; value: string }[];
  isPreorder?: boolean;
  preorderExpectedShipDate?: string;
  fulfilledQuantity?: number;
  discountAllocation?: number;
  taxAllocation?: number;
  refundedQuantity?: number;
  returnedQuantity?: number;
}

export type OrderStatus =
  | 'Draft'
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Refunded'
  | 'Archived';
export type PaymentStatus =
  | 'Not Paid'
  | 'Authorized'
  | 'Paid'
  | 'Failed'
  | 'Refunded'
  | 'Partially Refunded'
  | 'Voided';
export type FulfillmentStatus =
  | 'Unfulfilled'
  | 'Partially Fulfilled'
  | 'Fulfilled'
  | 'Returned'
  | 'Cancelled';

export interface Address {
  firstName?: string;
  lastName?: string;
  name?: string;
  street?: string;
  addressLine1?: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  deliveryInstructions?: string;
}

// §8 — Customer context card payload returned by
// GET /api/orders/:id/customer-context.
export interface CustomerContext {
  type: 'guest' | 'customer';
  customerId: string | null;
  email: string | null;
  lifetimeOrderCount: number;
  lifetimeSpend: number;
  previousRefunds: number;
  previousCancellations: number;
  lastOrderDate: string | null;
  customerSince: string | null;
  marketingConsent: boolean | null;
}

// Theme types
export interface Theme {
  _id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  author: {
    name: string;
    email: string;
    website: string;
  };
  status: 'active' | 'inactive' | 'development';
  isDefault: boolean;
  previewImage?: string;
  screenshots: string[];
  // NOTE: the legacy `settings`/`features` catalog fields were retired
  // (audit 1.2) — a theme's configuration lives in its built manifest.
  templates: Record<string, string>;
  assets: {
    css: string[];
    js: string[];
    fonts: string[];
  };
  statistics: {
    installCount: number;
    activeInstalls: number;
    rating: number;
    reviewCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ThemeSettings {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    fontFamily: string;
    fontSize: string;
  };
  layout: {
    containerWidth: string;
    headerStyle: string;
    footerStyle: string;
  };
}

// Cart types
export interface Cart {
  _id: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export interface CartItem {
  product: string | Product;
  quantity: number;
  price: number;
  total: number;
}

// API Response types. Default payload is `unknown` so callers are forced
// to narrow at the use site — `any` would silently erase type checking
// everywhere `ApiResponse` is used without an explicit type argument.
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// Backend pagination is inconsistent across endpoints — products returns
// `responseObject.data`, orders returns `responseObject.orders`, categories
// returns `.data`, etc. Rather than baking the divergence into the type
// (and forcing every page to know which key to use) we keep `responseObject`
// permissive and let callers reach for the field they expect. `pagination`
// is the one field that's universal across endpoints.
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export type PaginatedResponse<T> = {
  success: boolean;
  responseObject: {
    pagination: PaginationMeta;
  } & {
    [key: string]: T[] | PaginationMeta;
  };
  error?: string;
};

// ─── Orders slice — payment / fulfillment auxiliaries ────────────────
// These shapes mirror what `/api/payments/order/:id`, the /fulfillments
// endpoint, and the PaymentMethod resource return. They're kept narrow
// to what the dashboard actually renders — extend as new fields surface.

/**
 * One entry in the Payment log for an order. Status discriminates between
 * a forward charge ("completed" / "pending" / "failed") and a refund
 * ("refunded"). Refund rows carry a negative-ish semantic — the UI uses
 * `status === 'refunded'` to flip the sign on display.
 */
export interface Payment {
  _id: string;
  orderId?: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | string;
  provider?: string;
  providerTransactionId?: string;
  paymentMethod?: string;
  eventId?: string;
  reason?: string;
  metadata?: {
    reason?: string;
    manual?: boolean;
    [k: string]: unknown;
  };
  createdAt: string;
  updatedAt?: string;
}

/** A dynamic customer-facing input declared by a PaymentMethod. */
export interface PaymentMethodField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'tel' | 'select' | 'file' | string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  accept?: string;
  maxSize?: number;
}

/** A merchant-configured payment method (COD, bank transfer, stripe, …). */
export interface PaymentMethodDefinition {
  _id?: string;
  code: string;
  label?: string;
  type?: 'cod' | 'manual' | 'stripe' | string;
  customerFields?: PaymentMethodField[];
}

/** Value stored for a submitted file field — either the raw data URL
 * shape the dashboard writes client-side, or a server-side reference. */
export interface PaymentFieldFileValue {
  name?: string;
  size?: number;
  type?: string;
  dataUrl?: string;
  data?: string;
}

export type PaymentFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | PaymentFieldFileValue;

/**
 * Subset of the Fulfillment document the order-details page needs.
 * Mirrors the schema in schemas/store/order.js (fulfillment subdoc).
 */
export interface OrderFulfillmentRef {
  _id: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled' | string;
  items: Array<{ orderLineId: string; quantity: number }>;
  trackingNumber?: string;
  trackingCarrier?: string;
  shippingCost?: number;
  notes?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  createdAt: string;
}

/** Extra fields the backend folds into the order document that aren't
 * part of the canonical `Order` type (either because they're computed
 * on read or only present for certain payment/fulfillment shapes). */
export interface OrderExtras {
  paymentIntentId?: string;
  paymentDetails?: Record<string, PaymentFieldValue>;
  fulfillments?: OrderFulfillmentRef[];
  baseCurrency?: string;
  taxBreakdown?: Array<{
    name: string;
    rate?: number;
    amount: number;
    productClass?: string;
  }>;
}

export type OrderWithExtras = Order & OrderExtras;
