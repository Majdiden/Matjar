// ─── Types ───────────────────────────────────────────────────────
export type {
  ThemeManifest,
  SectionDefinition,
  SectionInstance,
  SectionSetting,
  BlockDefinition,
  BlockInstance,
  MergedThemeSettings,
  ThemeColors,
  ThemeTypography,
} from './types/theme';

export type {
  Product,
  ProductVariant,
  ProductImage,
  Category,
  Cart,
  CartItem,
  Review,
  Order,
  Address,
  StoreInfo,
  Pagination,
  WishlistItem,
} from './types/commerce';

export type {
  ProductCardProps,
  ProductCardImageProps,
  ProductCardPriceProps,
  ProductCardTitleProps,
  ProductCardActionsProps,
  CarouselProps,
  CarouselSlideProps,
  FilterGroup,
  FilterOption,
  ActiveFilter,
  FilterPanelProps,
  SearchResult,
  SearchBarProps,
  MegaMenuCategory,
  MegaMenuProps,
  BreadcrumbItem,
  BreadcrumbsProps,
} from './types/components';

// ─── Theme System ────────────────────────────────────────────────
export { defineTheme } from './theme/defineTheme';
export { defineSection } from './theme/defineSection';
export { ThemeProvider, useTheme, useThemeSettings, useThemeSetting, useColorMode, useSectionEnabled, useSectionBlocks } from './theme/ThemeProvider';

// ─── API ─────────────────────────────────────────────────────────
export {
  storefrontApi,
  cartApi,
  authApi,
  wishlistApi,
  ordersApi,
  reviewsApi,
  discountApi,
  marketsApi,
  checkoutApi,
  contactApi,
} from './api/client';

// ─── Contexts ────────────────────────────────────────────────────
export { CartProvider, useCart } from './contexts/CartContext';
export { StoreProvider, useStore } from './contexts/StoreContext';

// ─── Hooks ───────────────────────────────────────────────────────
export {
  useProducts,
  useFeaturedProducts,
  useProduct,
  useCategories,
  useCategory,
} from './hooks/useProducts';
export { useMyOrders, useOrder } from './hooks/useOrders';
export { useWishlist } from './hooks/useWishlist';
export { useSubmitReview } from './hooks/useReviews';
export { useDiscount } from './hooks/useDiscount';
export { useMarket } from './hooks/useMarket';

// ─── Primitives ──────────────────────────────────────────────────
export { Modal } from './components/primitives/Modal';
export { Drawer } from './components/primitives/Drawer';
export { Carousel, CarouselSlide } from './components/primitives/Carousel';
export { Tabs } from './components/primitives/Tabs';
export { Accordion } from './components/primitives/Accordion';
export { ToastProvider, useToast } from './components/primitives/Toast';
export { Skeleton } from './components/primitives/Skeleton';
export { ConfirmProvider, useConfirm } from './components/primitives/ConfirmDialog';
export type { ConfirmOptions } from './components/primitives/ConfirmDialog';

// ─── Commerce Components ────────────────────────────────────────
export { ProductCard } from './components/commerce/ProductCard';
export { PriceDisplay } from './components/commerce/PriceDisplay';
export { QuantitySelector } from './components/commerce/QuantitySelector';
export { RatingStars } from './components/commerce/RatingStars';
export { ColorSwatch } from './components/commerce/ColorSwatch';
export { SizeSwatch } from './components/commerce/SizeSwatch';
export { WishlistButton } from './components/commerce/WishlistButton';
export { ImageZoom } from './components/commerce/ImageZoom';
export { ProductCompare, CompareProvider, useCompare } from './components/commerce/ProductCompare';
export { Reviews, ReviewForm } from './components/commerce/Reviews';
export type { ReviewItem } from './components/commerce/Reviews';
export { CurrencySelector } from './components/commerce/CurrencySelector';
export { PreorderBadge } from './components/commerce/PreorderBadge';
export { getPreorderState, getCtaLabel } from './utils/preorder';
export type { PreorderMode, PreorderState } from './utils/preorder';

// ─── Navigation ──────────────────────────────────────────────────
export { MegaMenu } from './components/navigation/MegaMenu';
export { Breadcrumbs } from './components/navigation/Breadcrumbs';
export { SearchBar } from './components/navigation/SearchBar';
export { Pagination } from './components/navigation/Pagination';
export { MobileBottomNav } from './components/navigation/MobileBottomNav';

// ─── Discovery ───────────────────────────────────────────────────
export { FilterPanel } from './components/discovery/FilterPanel';
export { GridListToggle } from './components/discovery/GridListToggle';
export { QuickView } from './components/discovery/QuickView';

// ─── Marketing ───────────────────────────────────────────────────
export { AnnouncementBar } from './components/marketing/AnnouncementBar';
export { NewsletterPopup } from './components/marketing/NewsletterPopup';
export { CountdownTimer } from './components/marketing/CountdownTimer';
export { SocialShare } from './components/marketing/SocialShare';

// ─── Utility Hooks ───────────────────────────────────────────────
export { useViewport } from './hooks/useViewport';
export { useIntersectionObserver } from './hooks/useIntersectionObserver';
export { useLocalStorage } from './hooks/useLocalStorage';

// ─── Utils ───────────────────────────────────────────────────────
export { cn } from './utils/cn';
export { formatCurrency, calculateDiscount } from './utils/formatCurrency';

// ─── Legacy (backward compat) ────────────────────────────────────
export { default as CartDrawer } from './components/CartDrawer';

// ─── App SDK (createThemeApp / mountTheme) ──────────────────────
export { createThemeApp } from './app/createThemeApp';
export type { CreateThemeAppOptions, ThemePages, ThemeAppComponent, ExtraRoute } from './app/createThemeApp';
export { mountTheme } from './app/mountTheme';
