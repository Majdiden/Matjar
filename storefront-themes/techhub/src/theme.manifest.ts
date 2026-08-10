import { defineTheme } from '@matjar/theme-shared/theme/defineTheme';
import { defineSection } from '@matjar/theme-shared/theme/defineSection';
import type { SectionDefinition, SectionInstance } from '@matjar/theme-shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

/**
 * Hero Showcase — TONMART-style tripartite hero. Left rail is a live
 * "Browse all collection" category list, center is a dark spotlight
 * promo panel with a featured product, right is a compact flash-deal
 * card driven by the store's on-sale feed.
 */
export const heroShowcaseSection: SectionDefinition = defineSection({
  type: 'hero-showcase',
  name: 'Hero Showcase',
  icon: 'LayoutTemplate',
  category: 'content',
  description: 'Tripartite hero: category rail + dark product spotlight + flash-deal card',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'sidebar_heading', type: 'text', label: 'Sidebar Heading', default: '' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 10, min: 4, max: 14 },
    { id: 'hotline_label', type: 'text', label: 'Hotline Label', default: '' },
    { id: 'hotline_phone', type: 'text', label: 'Hotline Phone', default: '' },
    { id: 'shipping_strip', type: 'text', label: 'Shipping Strip', default: '' },
    { id: 'eyebrow', type: 'text', label: 'Spotlight Eyebrow', default: '' },
    { id: 'heading_line1', type: 'text', label: 'Spotlight Heading Line 1', default: '' },
    { id: 'heading_line2', type: 'text', label: 'Spotlight Heading Line 2', default: '' },
    { id: 'primary_button_text', type: 'text', label: 'Primary Button Text', default: '' },
    { id: 'primary_button_url', type: 'url', label: 'Primary Button URL', default: '/products' },
    { id: 'flash_deal_label', type: 'text', label: 'Flash Deal Label', default: '' },
    { id: 'flash_enabled', type: 'checkbox', label: 'Show Flash Deal', default: true },
    { id: 'flash_source', type: 'select', label: 'Flash Deal Source', default: 'on_sale', options: [
      { value: 'on_sale', label: 'On sale' },
      { value: 'featured', label: 'Featured' },
      { value: 'newest', label: 'Newest arrivals' },
    ] },
    { id: 'product_source', type: 'select', label: 'Spotlight Source', default: 'featured', options: [
      { value: 'featured', label: 'Featured products' },
      { value: 'newest', label: 'Newest arrivals' },
    ]},
    { id: 'slide_count', type: 'number', label: 'Spotlight Slides', default: 3, min: 1, max: 8 },
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play Spotlight', default: true },
    { id: 'autoplay_interval', type: 'number', label: 'Auto-play Interval (ms)', default: 5000, min: 2000, max: 12000 },
  ],
});

/**
 * Features Strip — three-column service-promise bar (shipping, payment,
 * warranty). A subtle dividerless row meant to sit just under the hero.
 */
export const featuresStripSection: SectionDefinition = defineSection({
  type: 'features-strip',
  name: 'Features Strip',
  icon: 'Sparkles',
  category: 'marketing',
  description: 'Three-column service-promise bar (shipping / payment / warranty)',
  target: 'body',
  settings: [],
  blocks: [
    {
      type: 'feature',
      name: 'Feature',
      limit: 6,
      settings: [
        { id: 'icon', type: 'select', label: 'Icon', default: 'truck', options: [
          { value: 'truck', label: 'Truck' },
          { value: 'shield', label: 'Shield' },
          { value: 'headset', label: 'Headset' },
          { value: 'refresh', label: 'Refresh' },
          { value: 'card', label: 'Card' },
        ]},
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'subtitle', type: 'text', label: 'Subtitle', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'feat-1', type: 'feature', settings: { icon: 'truck', title: 'Free US Shipping', subtitle: 'For US customers on orders above $200' } },
    { id: 'feat-2', type: 'feature', settings: { icon: 'card', title: 'Secure Payment', subtitle: 'We accept Visa, AmEx, Paypal and more' } },
    { id: 'feat-3', type: 'feature', settings: { icon: 'shield', title: '1 Year Warranty', subtitle: 'All of our products are made with care' } },
  ],
});

/**
 * Promo Banner Grid — three equal promo cards (TONMART-style). Each card
 * is a light-gray panel with a product image, category label, and a
 * "SHOP NOW" CTA.
 */
export const promoBannerGridSection: SectionDefinition = defineSection({
  type: 'promo-banner-grid',
  name: 'Promo Banner Grid',
  icon: 'Image',
  category: 'marketing',
  description: 'Three equal promo cards with product imagery and CTAs',
  target: 'body',
  settings: [
    { id: 'columns', type: 'select', label: 'Columns', default: '3', options: [
      { value: '2', label: '2 Columns' },
      { value: '3', label: '3 Columns' },
      { value: '4', label: '4 Columns' },
    ]},
  ],
  blocks: [
    {
      type: 'promo',
      name: 'Promo Tile',
      settings: [
        { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'subtitle', type: 'text', label: 'Subtitle', default: '' },
        { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
        { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
        { id: 'image', type: 'image', label: 'Image' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'promo-1', type: 'promo', settings: { title: 'PC GAMING', subtitle: 'PREMIUM PERFORMANCE', cta_text: 'SHOP NOW', cta_url: '/products' } },
    { id: 'promo-2', type: 'promo', settings: { title: 'GOPRO SESSION', subtitle: 'HERO 4 SESSION', cta_text: 'SHOP NOW', cta_url: '/products' } },
    { id: 'promo-3', type: 'promo', settings: { title: 'GAMING MOUSE', subtitle: 'ULTRA LIGHTWEIGHT', cta_text: 'SHOP NOW', cta_url: '/products' } },
  ],
});

/**
 * Tabbed Product Grid — "Featured Products" grid with pill tabs for
 * switching between curated feeds (All, Best Seller, Top Rated, On Sale).
 */
export const tabbedProductGridSection: SectionDefinition = defineSection({
  type: 'tabbed-product-grid',
  name: 'Tabbed Product Grid',
  icon: 'Grid3x3',
  category: 'commerce',
  description: 'Featured products grid with pill-tab filters',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Products Per Tab', default: 10, min: 4, max: 24 },
    { id: 'columns', type: 'select', label: 'Columns', default: '5', options: [
      { value: '3', label: '3 Columns' },
      { value: '4', label: '4 Columns' },
      { value: '5', label: '5 Columns' },
    ]},
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
    { id: 'show_add_to_cart', type: 'checkbox', label: 'Show Add to Cart', default: true },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Text', default: '' },
  ],
});

/**
 * Category Icons — 6-column row of circular category tiles with icon
 * imagery and a label underneath. Acts as a secondary discovery block.
 */
export const categoryIconsSection: SectionDefinition = defineSection({
  type: 'category-icons',
  name: 'Category Icons',
  icon: 'FolderTree',
  category: 'commerce',
  description: 'Row of circular category tiles with icon imagery',
  target: 'body',
  settings: [
    { id: 'columns', type: 'number', label: 'Columns', default: 6, min: 4, max: 8 },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 6, min: 4, max: 12 },
  ],
});

/**
 * Category Sidebar — two-column mega-nav block: vertical category list
 * on the left, product preview for the hovered category on the right.
 */
export const categorySidebarSection: SectionDefinition = defineSection({
  type: 'category-sidebar',
  name: 'Category Sidebar',
  icon: 'PanelLeft',
  category: 'commerce',
  description: 'Vertical category nav with live product preview panel',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 8, min: 3, max: 12 },
    { id: 'view_all_text', type: 'text', label: 'View All Text', default: '' },
  ],
});

// ─── Home Variants ───────────────────────────────────────────────

const showcaseVariant: SectionInstance[] = [
  { id: 'home-showcase-hero', type: 'hero-showcase', settings: {} },
  { id: 'home-showcase-features', type: 'features-strip', settings: {} },
  { id: 'home-showcase-promos', type: 'promo-banner-grid', settings: {} },
  { id: 'home-showcase-tabs', type: 'tabbed-product-grid', settings: {} },
  { id: 'home-showcase-category-icons', type: 'category-icons', settings: {} },
  { id: 'home-showcase-newsletter', type: 'newsletter', settings: {} },
];

const megaVariant: SectionInstance[] = [
  { id: 'home-mega-hero', type: 'hero-showcase', settings: {} },
  { id: 'home-mega-features', type: 'features-strip', settings: {} },
  { id: 'home-mega-categories', type: 'category-sidebar', settings: {} },
  { id: 'home-mega-featured', type: 'tabbed-product-grid', settings: { heading: 'POPULAR RIGHT NOW' } },
  { id: 'home-mega-trust', type: 'trust-badges', settings: {} },
];

const editorialVariant: SectionInstance[] = [
  { id: 'home-editorial-promos', type: 'promo-banner-grid', settings: {} },
  { id: 'home-editorial-hero', type: 'hero-showcase', settings: {} },
  { id: 'home-editorial-tabs', type: 'tabbed-product-grid', settings: { heading: 'SHOP THE EDIT', columns: '4' } },
  { id: 'home-editorial-category-icons', type: 'category-icons', settings: {} },
  { id: 'home-editorial-newsletter', type: 'newsletter', settings: {} },
];

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'techhub',
  name: 'TechHub',
  version: '3.0.0',
  previewImage: '/preview.jpg',
  description: 'A high-tech theme for electronics and gadget stores. Tripartite hero, pill-tab product grids, editorial promo rows and category icons — with optional dark mode.',
  author: { name: 'Matjar', website: 'https://matjar.to' },
  categories: ['electronics', 'general'],

  // Light palette — white background with a bright green accent.
  colors: {
    primary: '#22c55e',
    secondary: '#16a34a',
    accent: '#4ade80',
    background: '#ffffff',
    foreground: '#0f172a',
    muted: '#64748b',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
  },
  // Dark palette — same green accent over deep near-black.
  colorsDark: {
    background: '#0d1117',
    foreground: '#f1f5f9',
    muted: '#94a3b8',
    border: '#1e293b',
  },

  typography: {
    fontFamily: "Inter, 'Cairo', system-ui, sans-serif",
    headingFontFamily: "Inter, 'Cairo', system-ui, sans-serif",
    baseFontSize: '16px',
    lineHeight: '1.6',
  },

  fonts: [
    { label: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
    { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
    { label: "Cairo", value: "'Cairo', sans-serif" },
  ],

  layout: {
    maxWidth: '1280px',
  },

  designTokens: {
    motion: {
      durationFast: '120ms',
      durationBase: '210ms',
      durationSlow: '360ms',
      easeEntrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
      hoverLift: 'translateY(-4px) scale(1.01)',
    },
  },

  settings: [
    { id: 'color_mode', type: 'select', label: 'Color Mode', default: 'light', options: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ]},
    { id: 'home_variant', type: 'select', label: 'Home Layout', default: 'showcase', options: [
      { value: 'showcase', label: 'Showcase — flagship tripartite hero' },
      { value: 'mega', label: 'Mega — catalog-first with sidebar nav' },
      { value: 'editorial', label: 'Editorial — promo-led magazine layout' },
    ]},
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'border_radius', type: 'range', label: 'Card Border Radius', min: 0, max: 24, step: 2, default: 8, unit: 'px' },
  ],

  sections: [
    heroShowcaseSection,
    featuresStripSection,
    promoBannerGridSection,
    tabbedProductGridSection,
    categoryIconsSection,
    categorySidebarSection,
  ],

  templates: {
    index: showcaseVariant,
    // Finding #5: per-template section buckets. Empty arrays let
    // merchants compose layouts for these templates in the dashboard
    // Visual Editor. The storefront reads `sectionsByTemplate` from
    // the tenant's themeCustomization; manifest entries here just
    // surface the template in the page selector (listTemplates API).
    product: [],
    collection: [],
    cart: [],
    search: [],
    page: [],
  },

  homeVariants: {
    showcase: showcaseVariant,
    mega: megaVariant,
    editorial: editorialVariant,
  },
});

export default manifest;
