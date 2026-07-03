import { defineTheme } from '@matjar/theme-shared/theme/defineTheme';
import { defineSection } from '@matjar/theme-shared/theme/defineSection';
import type { SectionDefinition } from '@matjar/theme-shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero Banner',
  description: 'Full-width hero banner with gradient background, headline, and call-to-action buttons',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '', info: 'Main headline — falls back to store name if empty' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'badge_text', type: 'text', label: 'Badge Text', default: '' },
    { id: 'primary_button_text', type: 'text', label: 'Primary Button Text', default: '' },
    { id: 'primary_button_url', type: 'url', label: 'Primary Button URL', default: '/products' },
    { id: 'secondary_button_text', type: 'text', label: 'Secondary Button Text', default: '' },
    { id: 'secondary_button_url', type: 'url', label: 'Secondary Button URL', default: '/categories' },
    { id: 'background_image', type: 'image', label: 'Background Image', info: 'Optional — gradient is used if empty' },
    { id: 'overlay_opacity', type: 'range', label: 'Overlay Opacity', min: 0, max: 100, step: 5, default: 0, unit: '%' },
    { id: 'show_sale_slide', type: 'checkbox', label: 'Show Sale Slide', default: true },
    { id: 'sale_heading', type: 'text', label: 'Sale Heading', default: '' },
    { id: 'sale_subheading', type: 'text', label: 'Sale Subheading', default: '' },
    { id: 'sale_button_text', type: 'text', label: 'Sale Button Text', default: '' },
    { id: 'sale_button_url', type: 'url', label: 'Sale Button URL', default: '/products' },
    { id: 'show_countdown', type: 'checkbox', label: 'Show Countdown Timer', default: true },
    { id: 'countdown_days', type: 'number', label: 'Countdown Days', default: 3, min: 1, max: 30 },
  ],
});

export const categoriesSection: SectionDefinition = defineSection({
  type: 'categories',
  name: 'Category Grid',
  description: 'Display product categories in a responsive grid',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 6, min: 2, max: 12 },
    { id: 'show_product_count', type: 'checkbox', label: 'Show Product Count', default: true },
    { id: 'layout', type: 'select', label: 'Layout', default: 'grid', options: [
      { value: 'grid', label: 'Grid' },
      { value: 'carousel', label: 'Carousel' },
    ]},
  ],
});

export const featuredProductsSection: SectionDefinition = defineSection({
  type: 'featured-products',
  name: 'Featured Products',
  description: 'Showcase hand-picked featured products in a grid',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 2, max: 16 },
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
    { id: 'show_add_to_cart', type: 'checkbox', label: 'Show Add to Cart', default: true },
    { id: 'columns', type: 'select', label: 'Columns', default: '4', options: [
      { value: '2', label: '2 Columns' },
      { value: '3', label: '3 Columns' },
      { value: '4', label: '4 Columns' },
    ]},
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
  ],
});

export const trustBadgesSection: SectionDefinition = defineSection({
  type: 'trust-badges',
  name: 'Trust Badges',
  description: 'Highlight shipping, security, and return policies',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'show_section', type: 'checkbox', label: 'Show Section', default: true },
    { id: 'background_color', type: 'color', label: 'Background Color', default: '#f9fafb' },
    { id: 'accent_color', type: 'color', label: 'Icon Accent Color', default: '#2563eb' },
  ],
  blocks: [
    {
      type: 'badge',
      name: 'Trust Badge',
      settings: [
        { id: 'icon', type: 'select', label: 'Icon', default: 'shipping', options: [
          { value: 'shipping', label: 'Shipping' },
          { value: 'lock', label: 'Lock' },
          { value: 'return', label: 'Return' },
        ]},
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'description', type: 'text', label: 'Description', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'badge-1', type: 'badge', settings: { icon: 'shipping', title: 'Free Shipping', description: 'On orders over $50' } },
    { id: 'badge-2', type: 'badge', settings: { icon: 'lock', title: 'Secure Payment', description: '256-bit SSL encryption' } },
    { id: 'badge-3', type: 'badge', settings: { icon: 'return', title: 'Easy Returns', description: '30-day money back guarantee' } },
  ],
});

export const newArrivalsSection: SectionDefinition = defineSection({
  type: 'new-arrivals',
  name: 'New Arrivals',
  description: 'Carousel of recently added products',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 4, max: 16 },
    { id: 'show_add_to_cart', type: 'checkbox', label: 'Show Add to Cart', default: true },
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play', default: false },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products?sort=newest' },
  ],
});

export const newsletterSection: SectionDefinition = defineSection({
  type: 'newsletter',
  name: 'Newsletter Signup',
  description: 'Email subscription section with gradient background',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'placeholder', type: 'text', label: 'Input Placeholder', default: '' },
    { id: 'disclaimer', type: 'text', label: 'Disclaimer Text', default: '' },
    { id: 'use_gradient', type: 'checkbox', label: 'Use Theme Gradient', default: true },
    { id: 'background_color', type: 'color', label: 'Background Color', default: '#2563eb', info: 'Used when gradient is disabled' },
  ],
});

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest: ThemeManifest = defineTheme({
  slug: 'modern',
  name: 'Modern',
  version: '1.0.0',
  description: 'A clean, modern theme suitable for any type of store. Features a bold hero, category grid, and product showcases.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['general', 'electronics', 'fashion'],

  colors: {
    primary: '#2563eb',
    secondary: '#1e40af',
    accent: '#f59e0b',
    background: '#ffffff',
    foreground: '#1f2937',
    muted: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
  },

  typography: {
    fontFamily: "Inter, 'Tajawal', system-ui, sans-serif",
    headingFontFamily: "Inter, 'Tajawal', system-ui, sans-serif",
    baseFontSize: '16px',
    lineHeight: '1.6',
  },

  layout: {
    maxWidth: '1280px',
    headerStyle: 'standard',
    footerStyle: 'standard',
  },

  designTokens: {
    motion: {
      durationFast: '120ms',
      durationBase: '220ms',
      durationSlow: '380ms',
      easeEntrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
      hoverLift: 'translateY(-4px)',
    },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
    { id: 'announcement_bg', type: 'color', label: 'Announcement Background', default: '#1f2937' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'enable_compare', type: 'checkbox', label: 'Enable Product Compare', default: true },
    { id: 'border_radius', type: 'range', label: 'Border Radius', min: 0, max: 24, step: 2, default: 8, unit: 'px' },
  ],

  sections: [
    heroSection,
    categoriesSection,
    featuredProductsSection,
    trustBadgesSection,
    newArrivalsSection,
    newsletterSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'categories', type: 'categories', settings: {} },
      { id: 'featured-products', type: 'featured-products', settings: {} },
      { id: 'trust-badges', type: 'trust-badges', settings: {}, blocks: [
        { id: 'badge-1', type: 'badge', settings: { icon: 'shipping', title: 'Free Shipping', description: 'On orders over $50' } },
        { id: 'badge-2', type: 'badge', settings: { icon: 'lock', title: 'Secure Payment', description: '256-bit SSL encryption' } },
        { id: 'badge-3', type: 'badge', settings: { icon: 'return', title: 'Easy Returns', description: '30-day money back guarantee' } },
      ]},
      { id: 'new-arrivals', type: 'new-arrivals', settings: {} },
      { id: 'newsletter', type: 'newsletter', settings: {} },
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
