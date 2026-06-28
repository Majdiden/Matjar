import { defineTheme } from '@shared/theme/defineTheme';
import { defineSection } from '@shared/theme/defineSection';
import type { SectionDefinition } from '@shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero Banner',
  description: 'Bold full-bleed dark hero with diagonal red accent and uppercase typography',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow_text', type: 'text', label: 'Eyebrow Text', default: '', info: 'Small uppercase label above the heading' },
    { id: 'heading_line1', type: 'text', label: 'Heading Line 1', default: '' },
    { id: 'heading_line2', type: 'text', label: 'Heading Line 2 (accented)', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'primary_button_text', type: 'text', label: 'Primary Button Text', default: '' },
    { id: 'primary_button_url', type: 'url', label: 'Primary Button URL', default: '/products' },
    { id: 'secondary_button_text', type: 'text', label: 'Secondary Button Text', default: '' },
    { id: 'secondary_button_url', type: 'url', label: 'Secondary Button URL', default: '/products' },
    { id: 'background_color', type: 'color', label: 'Background Color', default: '#111827' },
    { id: 'show_diagonal_accent', type: 'checkbox', label: 'Show Diagonal Accent', default: true },
    { id: 'show_bottom_bar', type: 'checkbox', label: 'Show Bottom Red Bar', default: true },
    { id: 'background_image', type: 'image', label: 'Background Image', info: 'Optional — dark color is used if empty' },
  ],
});

export const categoriesSection: SectionDefinition = defineSection({
  type: 'categories',
  name: 'Shop by Sport',
  description: 'Category grid with action-shot overlays and hover border highlight',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 4, min: 2, max: 8 },
    { id: 'card_height', type: 'number', label: 'Card Height (px)', default: 192, min: 120, max: 320 },
    { id: 'columns', type: 'select', label: 'Columns', default: '4', options: [
      { value: '2', label: '2 Columns' },
      { value: '3', label: '3 Columns' },
      { value: '4', label: '4 Columns' },
    ]},
    { id: 'show_shop_now_label', type: 'checkbox', label: 'Show "Shop Now" on Hover', default: true },
    { id: 'shop_now_text', type: 'text', label: '"Shop Now" Label Text', default: '' },
  ],
});

export const featuredProductsSection: SectionDefinition = defineSection({
  type: 'featured-products',
  name: 'Top Picks',
  description: 'Featured products grid on a light background with red accent hover',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 2, max: 16 },
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
    { id: 'show_add_to_cart', type: 'checkbox', label: 'Show Add to Cart', default: true },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: '' },
    { id: 'columns', type: 'select', label: 'Columns', default: '4', options: [
      { value: '2', label: '2 Columns' },
      { value: '3', label: '3 Columns' },
      { value: '4', label: '4 Columns' },
    ]},
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: '' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
  ],
});

export const ctaBannerSection: SectionDefinition = defineSection({
  type: 'cta-banner',
  name: 'CTA Banner',
  description: 'Full-width red call-to-action banner with headline, body copy, and button',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'button_url', type: 'url', label: 'Button URL', default: '/products' },
    { id: 'background_color', type: 'color', label: 'Background Color', default: '#dc2626' },
    { id: 'button_bg_color', type: 'color', label: 'Button Background Color', default: '#ffffff' },
    { id: 'button_text_color', type: 'color', label: 'Button Text Color', default: '#dc2626' },
  ],
});

export const performanceGearCarouselSection: SectionDefinition = defineSection({
  type: 'performance-gear',
  name: 'Performance Gear Carousel',
  description: 'Horizontal carousel showcasing performance-focused products',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 4, max: 16 },
    { id: 'slides_per_view', type: 'number', label: 'Slides Per View', default: 4, min: 2, max: 6 },
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play', default: true },
    { id: 'autoplay_interval', type: 'number', label: 'Auto-play Interval (ms)', default: 5000, min: 2000, max: 10000 },
    { id: 'show_arrows', type: 'checkbox', label: 'Show Arrows', default: true },
    { id: 'show_dots', type: 'checkbox', label: 'Show Dots', default: true },
    { id: 'loop', type: 'checkbox', label: 'Loop', default: true },
    { id: 'pause_on_hover', type: 'checkbox', label: 'Pause on Hover', default: true },
  ],
});

export const trustBadgesSection: SectionDefinition = defineSection({
  type: 'trust-badges',
  name: 'Trust Badges',
  description: 'Three-column feature badges highlighting returns, pro gear, and delivery',
  target: 'body',
  limit: 1,
  blocks: [
    {
      type: 'badge',
      name: 'Trust Badge',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'description', type: 'text', label: 'Description', default: '' },
        { id: 'icon', type: 'select', label: 'Icon', default: 'lightning', options: [
          { value: 'lightning', label: 'Lightning / Fast Delivery' },
          { value: 'returns', label: 'Returns' },
          { value: 'pro', label: 'Pro Badge / Certified' },
        ]},
      ],
    },
  ],
  defaultBlocks: [
    { id: 'badge-1', type: 'badge', settings: { title: 'Free Returns', description: '30-day no-questions-asked returns', icon: 'returns' } },
    { id: 'badge-2', type: 'badge', settings: { title: 'Pro Gear', description: 'Used by professional athletes worldwide', icon: 'pro' } },
    { id: 'badge-3', type: 'badge', settings: { title: 'Fast Delivery', description: 'Express shipping on all orders', icon: 'lightning' } },
  ],
});

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'sportzone',
  name: 'SportZone',
  version: '1.0.0',
  description: 'A bold, high-energy theme for sports and fitness stores. Features uppercase typography, a dark hero, red accents, and an action-shot category grid.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['sports', 'general'],

  colors: {
    primary: '#dc2626',
    secondary: '#b91c1c',
    accent: '#ef4444',
    background: '#ffffff',
    foreground: '#111827',
    muted: '#6b7280',
    border: '#e5e7eb',
    error: '#dc2626',
    success: '#10b981',
  },

  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFontFamily: 'Inter, system-ui, sans-serif',
    baseFontSize: '16px',
    lineHeight: '1.5',
  },

  layout: {
    maxWidth: '1280px',
    headerStyle: 'dark',
    footerStyle: 'standard',
  },

  designTokens: {
    motion: {
      durationFast: '100ms',
      durationBase: '180ms',
      durationSlow: '340ms',
      easeStandard: 'cubic-bezier(0.45, 0, 0.15, 1)',
      easeEntrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
      hoverLift: 'translateY(-5px)',
    },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
    { id: 'announcement_bg', type: 'color', label: 'Announcement Background', default: '#dc2626' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'border_radius', type: 'range', label: 'Card Border Radius', min: 0, max: 16, step: 2, default: 4, unit: 'px', info: 'SportZone uses sharper corners by default' },
    { id: 'uppercase_headings', type: 'checkbox', label: 'Uppercase Headings', default: true },
  ],

  sections: [
    heroSection,
    categoriesSection,
    featuredProductsSection,
    ctaBannerSection,
    performanceGearCarouselSection,
    trustBadgesSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'categories', type: 'categories', settings: {} },
      { id: 'featured-products', type: 'featured-products', settings: {} },
      { id: 'cta-banner', type: 'cta-banner', settings: {} },
      { id: 'performance-gear', type: 'performance-gear', settings: {} },
      { id: 'trust-badges', type: 'trust-badges', settings: {}, blocks: [
        { id: 'badge-1', type: 'badge', settings: { title: 'Free Returns', description: '30-day no-questions-asked returns', icon: 'returns' } },
        { id: 'badge-2', type: 'badge', settings: { title: 'Pro Gear', description: 'Used by professional athletes worldwide', icon: 'pro' } },
        { id: 'badge-3', type: 'badge', settings: { title: 'Fast Delivery', description: 'Express shipping on all orders', icon: 'lightning' } },
      ]},
    ],
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
});

export default manifest;
