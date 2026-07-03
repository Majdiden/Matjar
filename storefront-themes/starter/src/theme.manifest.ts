import { defineTheme } from '@matjar/theme-shared/theme/defineTheme';
import { defineSection } from '@matjar/theme-shared/theme/defineSection';
import type { SectionDefinition } from '@matjar/theme-shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero',
  description: 'Simple centered text hero with a single call-to-action button',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'button_url', type: 'url', label: 'Button URL', default: '/products' },
  ],
});

export const featuredProductsSection: SectionDefinition = defineSection({
  type: 'featured-products',
  name: 'Featured Products',
  description: 'Clean product grid with a view-all link',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: '' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 6, min: 2, max: 12 },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Text', default: '' },
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
  ],
});

export const trustBadgesSection: SectionDefinition = defineSection({
  type: 'trust-badges',
  name: 'Trust Badges',
  description: 'Minimal three-column feature strip',
  target: 'body',
  limit: 1,
  settings: [],
  blocks: [
    {
      type: 'badge',
      name: 'Badge',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'description', type: 'text', label: 'Description', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'badge-1', type: 'badge', settings: { title: 'Free Shipping', description: 'On orders over $50' } },
    { id: 'badge-2', type: 'badge', settings: { title: 'Easy Returns', description: '30-day return policy' } },
    { id: 'badge-3', type: 'badge', settings: { title: 'Secure Checkout', description: 'Safe & encrypted' } },
  ],
});

export const categoriesSection: SectionDefinition = defineSection({
  type: 'categories',
  name: 'Categories',
  description: 'Simple horizontal list of category chips',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 12, min: 2, max: 30 },
  ],
});

export const newsletterSection: SectionDefinition = defineSection({
  type: 'newsletter',
  name: 'Newsletter',
  description: 'Simple email subscription row',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'placeholder', type: 'text', label: 'Input Placeholder', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
  ],
});

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'starter',
  name: 'Starter',
  version: '1.0.0',
  description: 'An ultra-minimal, unopinionated starter theme. Designed as a clean baseline for developers to build on — no decorative flourishes, just structure.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['general'],

  colors: {
    primary: '#2563eb',
    secondary: '#1d4ed8',
    accent: '#2563eb',
    background: '#ffffff',
    foreground: '#111827',
    muted: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
  },

  typography: {
    fontFamily: "Inter, 'Cairo', system-ui, sans-serif",
    headingFontFamily: "Inter, 'Cairo', system-ui, sans-serif",
    baseFontSize: '16px',
    lineHeight: '1.6',
  },

  layout: {
    maxWidth: '1152px',
    headerStyle: 'standard',
    footerStyle: 'standard',
  },

  designTokens: {
    motion: {
      durationFast: '150ms',
      durationBase: '250ms',
      durationSlow: '400ms',
      easeEntrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
      hoverLift: 'translateY(-4px)',
    },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: false },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
  ],

  sections: [
    heroSection,
    categoriesSection,
    featuredProductsSection,
    trustBadgesSection,
    newsletterSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'categories', type: 'categories', settings: {} },
      { id: 'featured-products', type: 'featured-products', settings: {} },
      { id: 'trust-badges', type: 'trust-badges', settings: {}, blocks: [
        { id: 'badge-1', type: 'badge', settings: { title: 'Free Shipping', description: 'On orders over $50' } },
        { id: 'badge-2', type: 'badge', settings: { title: 'Easy Returns', description: '30-day return policy' } },
        { id: 'badge-3', type: 'badge', settings: { title: 'Secure Checkout', description: 'Safe & encrypted' } },
      ]},
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
