/**
 * Theme SDK — Shared Component Prop Types
 */

import type { Product, Category, CartItem } from './commerce';

// ─── Common ──────────────────────────────────────────────────────

export interface BaseProps {
  className?: string;
  children?: React.ReactNode;
}

// ─── Product Card (Compound) ─────────────────────────────────────

export interface ProductCardProps extends BaseProps {
  product: Product;
  layout?: 'grid' | 'list';
  /** Called when quick view is triggered */
  onQuickView?: (product: Product) => void;
}

export interface ProductCardImageProps extends BaseProps {
  /** Show sale/new/out-of-stock badges */
  showBadge?: boolean;
  /** Aspect ratio class (default: aspect-square) */
  aspectRatio?: string;
  /** Show quick view button on hover */
  showQuickView?: boolean;
  /** Show wishlist button */
  showWishlist?: boolean;
}

export interface ProductCardPriceProps extends BaseProps {
  /** Show compare-at price with strikethrough */
  showCompareAt?: boolean;
  /** Show discount percentage badge */
  showDiscount?: boolean;
}

export interface ProductCardTitleProps extends BaseProps {
  /** Truncate to N lines (default: 1) */
  lines?: number;
}

export interface ProductCardActionsProps extends BaseProps {
  /** Show add to cart button */
  showAddToCart?: boolean;
  /** Show quantity selector instead of simple button */
  showQuantity?: boolean;
}

// ─── Carousel ────────────────────────────────────────────────────

export interface CarouselProps extends BaseProps {
  /** Auto-play interval in ms (0 = disabled) */
  autoPlay?: number;
  /** Show navigation arrows */
  showArrows?: boolean;
  /** Show dot indicators */
  showDots?: boolean;
  /** Enable swipe gestures */
  swipeable?: boolean;
  /** Loop back to start */
  loop?: boolean;
  /** Items visible at once per breakpoint */
  slidesPerView?: number | { sm?: number; md?: number; lg?: number; xl?: number };
  /** Gap between slides in px */
  gap?: number;
  /** Pause autoplay on hover */
  pauseOnHover?: boolean;
}

export interface CarouselSlideProps extends BaseProps {
  index?: number;
}

// ─── Filter Panel ────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterGroup {
  id: string;
  label: string;
  type: 'checkbox' | 'radio' | 'range' | 'color';
  options?: FilterOption[];
  min?: number;
  max?: number;
  step?: number;
}

export interface ActiveFilter {
  groupId: string;
  value: string | [number, number];
  label: string;
}

export interface FilterPanelProps extends BaseProps {
  groups: FilterGroup[];
  active: ActiveFilter[];
  onChange: (filters: ActiveFilter[]) => void;
  onClear: () => void;
}

// ─── Search ──────────────────────────────────────────────────────

export interface SearchResult {
  type: 'product' | 'category' | 'page';
  id: string;
  title: string;
  url: string;
  image?: string;
  price?: number;
  subtitle?: string;
}

export interface SearchBarProps extends BaseProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  results?: SearchResult[];
  loading?: boolean;
  onSelect?: (result: SearchResult) => void;
}

// ─── Navigation ──────────────────────────────────────────────────

export interface MegaMenuCategory {
  name: string;
  slug: string;
  image?: string;
  children?: Array<{
    name: string;
    slug: string;
  }>;
  featured?: Product[];
}

export interface MegaMenuProps extends BaseProps {
  categories: MegaMenuCategory[];
}

// ─── Breadcrumb ──────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps extends BaseProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
}
