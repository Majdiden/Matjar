/**
 * Theme SDK — Commerce Types
 *
 * Shared type definitions for all commerce entities.
 * These match the shapes returned by the storefront API.
 */

export interface ProductImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

/** Single option axis on a variant-enabled product, e.g. Color/Size. */
export interface ProductOption {
  name: string;
  values: string[];
}

/** Pre-order configuration on a product or variant. */
export interface PreorderConfig {
  enabled?: boolean;
  /**
   * Date the merchant expects to ship pre-orders. Backend canonical name
   * is `expectedShipDate`; some older/alternate payloads used `shipByDate`.
   * Both are tolerated by the preorder helper.
   */
  expectedShipDate?: string | null;
  shipByDate?: string | null;
  maxUnits?: number | null;
  unitsReserved?: number;
  maxPerCustomer?: number | null;
  chargePolicy?: 'now' | 'on_ship';
  /** Optional deposit percentage (0–100). Informational label only. */
  depositPct?: number | null;
  /** Optional pre-order discount percentage (0–100). Applied to displayed price. */
  discountPct?: number | null;
  /** Free-form merchant note (e.g. cancellation policy). */
  policyNote?: string | null;
}

export interface ProductVariant {
  _id: string;
  sku?: string;
  barcode?: string;
  /** Concrete option values, e.g. [{name:"Color",value:"Red"},{name:"Size",value:"M"}] */
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

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  category?: string | Category;
  categories?: string[];
  tags?: string[];
  sku?: string;
  stock: number;
  hasVariants?: boolean;
  options?: ProductOption[];
  variants?: ProductVariant[];
  preorder?: PreorderConfig;
  rating?: number;
  reviewCount?: number;
  status: 'active' | 'draft' | 'archived';
  isFeatured?: boolean;
  attributes?: Record<string, string | string[]>;
  seo?: {
    title?: string;
    description?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent?: string | Category;
  children?: Category[];
  productCount?: number;
  level?: number;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  lineTotal: number;
  isPreorder?: boolean;
  preorderExpectedShipDate?: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    images: string[];
    price: number;
    compareAtPrice?: number;
    stock: number;
  } | null;
  variant?: {
    id: string;
    name: string;
    sku?: string;
    options?: { name: string; value: string }[];
  } | null;
}

export interface Cart {
  id: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  total: number;
  discount?: {
    code: string;
    amount: number;
    type: 'percentage' | 'fixed';
  };
  savings: number;
}

export interface Review {
  _id: string;
  user: { name: string; avatar?: string };
  rating: number;
  title?: string;
  comment: string;
  isVerified?: boolean;
  createdAt: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  items: Array<{
    product: Pick<Product, '_id' | 'name' | 'slug' | 'images' | 'price'>;
    quantity: number;
    price: number;
    lineTotal: number;
  }>;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress?: Address;
  billingAddress?: Address;
  createdAt: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
}

/** Arabic-first bilingual text from the brand kit; English is optional. */
export interface BrandText {
  ar?: string;
  en?: string;
}

/**
 * Brand kit (PBI 10) — facts the merchant gave about their business, the
 * same on every theme (`store.brand`, built by services/storefrontStoreInfo.js).
 * Only keys the merchant set are present; the whole object is null when
 * nothing is set, so a theme falls back to its own defaults.
 */
export interface BrandKit {
  tagline?: BrandText;
  /** Absolute https URL or a root-relative "/uploads/..." path. */
  coverImage?: string;
  /** "#rrggbb", lowercase. */
  color?: string;
  /** E.164, e.g. "+249912345678". */
  whatsapp?: string;
  city?: BrandText;
  hours?: BrandText;
}

export interface StoreInfo {
  name: string;
  description?: string;
  logo?: string;
  favicon?: string;
  currency: string;
  theme?: string;
  themeCustomization?: {
    settings?: {
      colors?: Record<string, string>;
      typography?: Record<string, string>;
      layout?: Record<string, string>;
    };
    sections?: Array<{
      id: string;
      type: string;
      settings: Record<string, any>;
      blocks?: Array<{ id: string; type: string; settings: Record<string, any> }>;
    }>;
    customCSS?: string;
  };
  socialLinks?: Record<string, string>;
  contactInfo?: Record<string, string>;
  brand?: BrandKit | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface WishlistItem {
  _id: string;
  product: Product;
  addedAt: string;
}
