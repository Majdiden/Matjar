/**
 * Techhub section registry.
 *
 * Combines the SDK's DEFAULT_SECTION_REGISTRY with the techhub-specific
 * sections defined in this directory. Pass the result to
 * `<SectionRenderer registry={TECHHUB_SECTION_REGISTRY} />` so the
 * theme-local section types resolve alongside the built-ins.
 */
import { DEFAULT_SECTION_REGISTRY, type SectionComponent } from '@matjar/theme-shared/components/sections';
import { HeroShowcaseSection } from './HeroShowcase';
import { CategorySidebarSection } from './CategorySidebar';
import { PromoBannerGridSection } from './PromoBannerGrid';
import { TabbedProductGridSection } from './TabbedProductGrid';
import { FeaturesStripSection } from './FeaturesStrip';
import { CategoryIconsSection } from './CategoryIcons';
import {
  TonmartFeaturedProductsSection,
  TonmartNewArrivalsSection,
  TonmartProductGridSection,
} from './TonmartProductFeeds';

export const TECHHUB_SECTION_REGISTRY: Record<string, SectionComponent> = {
  ...DEFAULT_SECTION_REGISTRY,
  // Override universal product-feed sections so merchant-added product
  // grids render with the TONMART-style TonmartProductCard rather than
  // the generic shared ProductCard.
  'featured-products': TonmartFeaturedProductsSection,
  'new-arrivals': TonmartNewArrivalsSection,
  'product-grid': TonmartProductGridSection,
  // Techhub-specific sections
  'hero-showcase': HeroShowcaseSection,
  'category-sidebar': CategorySidebarSection,
  'promo-banner-grid': PromoBannerGridSection,
  'tabbed-product-grid': TabbedProductGridSection,
  'features-strip': FeaturesStripSection,
  'category-icons': CategoryIconsSection,
};
