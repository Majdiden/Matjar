import { defineTheme } from '@shared/theme/defineTheme';
import { defineSection } from '@shared/theme/defineSection';
import type { SectionDefinition } from '@shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero Banner',
  description: 'Dark full-width hero with gold accent badge, headline, and dual CTA buttons',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'badge_text', type: 'text', label: 'Badge Text', default: '' },
    { id: 'heading_line1', type: 'text', label: 'Heading Line 1', default: '' },
    { id: 'heading_line2', type: 'text', label: 'Heading Line 2', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'primary_button_text', type: 'text', label: 'Primary Button Text', default: '' },
    { id: 'primary_button_url', type: 'url', label: 'Primary Button URL', default: '/products' },
    { id: 'secondary_button_text', type: 'text', label: 'Secondary Button Text', default: '' },
    { id: 'secondary_button_url', type: 'url', label: 'Secondary Button URL', default: '/categories' },
    { id: 'background_color', type: 'color', label: 'Background Color', default: '#2d2d2d' },
  ],
});

export const categoriesSection: SectionDefinition = defineSection({
  type: 'categories',
  name: 'Shop by Room',
  description: 'Room-based category grid with gold icon accents and warm tile backgrounds',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow Label', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 6, min: 2, max: 12 },
    { id: 'tile_background_color', type: 'color', label: 'Tile Background Color', default: '#f0ebe3' },
    { id: 'tile_hover_color', type: 'color', label: 'Tile Hover Color', default: '#e8e0d4' },
  ],
});

export const featuredProductsSection: SectionDefinition = defineSection({
  type: 'featured-products',
  name: "Editor's Picks",
  description: 'Hand-curated product grid with gold accent labels',
  target: 'body',
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow Label', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: "Editor's Picks" },
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: '' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 9, min: 3, max: 18 },
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Text', default: '' },
    { id: 'columns', type: 'select', label: 'Columns', default: '3', options: [
      { value: '2', label: '2 Columns' },
      { value: '3', label: '3 Columns' },
    ]},
  ],
});

export const philosophySection: SectionDefinition = defineSection({
  type: 'philosophy',
  name: 'Philosophy',
  description: 'Brand values section with warm background and three pillar cards',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow Label', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'body_text', type: 'textarea', label: 'Body Text', default: '' },
    { id: 'background_color', type: 'color', label: 'Background Color', default: '#f9f7f4' },
  ],
  blocks: [
    {
      type: 'pillar',
      name: 'Pillar',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'description', type: 'text', label: 'Description', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'pillar-1', type: 'pillar', settings: { title: 'Sustainably Sourced', description: 'Responsibly harvested materials from certified suppliers.' } },
    { id: 'pillar-2', type: 'pillar', settings: { title: 'Built to Endure', description: 'Rigorous quality testing ensures lasting beauty and function.' } },
    { id: 'pillar-3', type: 'pillar', settings: { title: 'Thoughtful Design', description: 'Each piece balances form, function, and timeless aesthetics.' } },
  ],
});

export const trendingCarouselSection: SectionDefinition = defineSection({
  type: 'trending-carousel',
  name: 'Trending Now',
  description: 'Inspiration carousel of trending products',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow Label', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 6, min: 3, max: 12 },
    { id: 'min_products_to_show', type: 'number', label: 'Minimum Products Required to Show', default: 3, min: 1, max: 6, info: 'Section is hidden if fewer featured products exist' },
  ],
});

export const newsletterSection: SectionDefinition = defineSection({
  type: 'newsletter',
  name: 'Newsletter Signup',
  description: 'Dark newsletter section with gold CTA button',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow Label', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'placeholder', type: 'text', label: 'Input Placeholder', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'background_color', type: 'color', label: 'Background Color', default: '#2d2d2d' },
  ],
});

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'homedecor',
  name: 'Home Decor',
  version: '1.0.0',
  description: 'A warm, editorial theme for home furnishing and interior décor stores. Features dark hero panels, gold accents, and room-based navigation.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['home', 'general'],

  colors: {
    primary: '#d4a76a',
    secondary: '#c49a5f',
    accent: '#d4a76a',
    background: '#ffffff',
    foreground: '#2d2d2d',
    muted: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
  },

  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFontFamily: 'Inter, system-ui, sans-serif',
    baseFontSize: '16px',
    lineHeight: '1.6',
  },

  layout: {
    maxWidth: '1280px',
    headerStyle: 'standard',
    footerStyle: 'standard',
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
    { id: 'announcement_bg', type: 'color', label: 'Announcement Background', default: '#2d2d2d' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'gold_accent_color', type: 'color', label: 'Gold Accent Color', default: '#d4a76a' },
    { id: 'warm_tile_color', type: 'color', label: 'Warm Tile Color', default: '#f0ebe3' },
  ],

  sections: [
    heroSection,
    categoriesSection,
    featuredProductsSection,
    philosophySection,
    trendingCarouselSection,
    newsletterSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'categories', type: 'categories', settings: {} },
      { id: 'featured-products', type: 'featured-products', settings: {} },
      { id: 'philosophy', type: 'philosophy', settings: {}, blocks: [
        { id: 'pillar-1', type: 'pillar', settings: { title: 'Sustainably Sourced', description: 'Responsibly harvested materials from certified suppliers.' } },
        { id: 'pillar-2', type: 'pillar', settings: { title: 'Built to Endure', description: 'Rigorous quality testing ensures lasting beauty and function.' } },
        { id: 'pillar-3', type: 'pillar', settings: { title: 'Thoughtful Design', description: 'Each piece balances form, function, and timeless aesthetics.' } },
      ]},
      { id: 'trending-carousel', type: 'trending-carousel', settings: {} },
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
