import { defineTheme } from '@shared/theme/defineTheme';
import { defineSection } from '@shared/theme/defineSection';
import type { SectionDefinition, SectionInstance } from '@shared/types/theme';

/**
 * BEAUXE — model-led cosmetics theme.
 *
 * Design: navy top bar + pink/cream palette, large model hero with
 * serif headline pulled over the photo, promo cards with product shots
 * on pink/cream backgrounds, soft rounded buttons, SALE badges, and a
 * BEST SELLER sidebar module on the product page.
 */

// ─── Section Definitions ─────────────────────────────────────────

export const beauxeTopBarSection: SectionDefinition = defineSection({
  type: 'beauxe-top-bar',
  name: 'Top Announcement Bar',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'text', type: 'text', label: 'Text', default: '' },
    { id: 'link_text', type: 'text', label: 'Link Text', default: '' },
    { id: 'link_url', type: 'url', label: 'Link URL', default: '/products' },
  ],
});

export const beauxeHeroSection: SectionDefinition = defineSection({
  type: 'beauxe-hero',
  name: 'Model Hero',
  description: 'Large model photo with serif headline pulled over pink/cream backdrop',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
    { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
    { id: 'image', type: 'image', label: 'Model Image' },
  ],
});

export const beauxeFeatureStripSection: SectionDefinition = defineSection({
  type: 'beauxe-feature-strip',
  name: 'Feature Strip',
  description: '4-icon strip (free shipping, cruelty-free, vegan, secure payment)',
  target: 'body',
  settings: [],
  blocks: [
    {
      type: 'feature',
      name: 'Feature',
      settings: [
        { id: 'icon', type: 'select', label: 'Icon', default: 'truck', options: [
          { value: 'truck', label: 'Truck' },
          { value: 'leaf', label: 'Leaf' },
          { value: 'heart', label: 'Heart' },
          { value: 'shield', label: 'Shield' },
        ]},
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'subtitle', type: 'text', label: 'Subtitle', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'f-1', type: 'feature', settings: { icon: 'truck', title: 'Free Shipping', subtitle: 'On orders over $50' } },
    { id: 'f-2', type: 'feature', settings: { icon: 'leaf', title: '100% Natural', subtitle: 'Clean ingredients' } },
    { id: 'f-3', type: 'feature', settings: { icon: 'heart', title: 'Cruelty Free', subtitle: 'Never tested on animals' } },
    { id: 'f-4', type: 'feature', settings: { icon: 'shield', title: 'Secure Checkout', subtitle: 'SSL encrypted' } },
  ],
});

export const beauxeCategoryTilesSection: SectionDefinition = defineSection({
  type: 'beauxe-category-tiles',
  name: 'Category Tiles',
  description: 'Shop by category: 3 pink/cream tiles with product imagery',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
  ],
  blocks: [
    {
      type: 'tile',
      name: 'Category Tile',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'cta_url', type: 'url', label: 'URL', default: '/products' },
        { id: 'background', type: 'color', label: 'Background', default: '#f8e4e4' },
        { id: 'image', type: 'image', label: 'Image' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'tile-1', type: 'tile', settings: { title: 'Skincare', background: '#f8e4e4' } },
    { id: 'tile-2', type: 'tile', settings: { title: 'Makeup', background: '#faf3ec' } },
    { id: 'tile-3', type: 'tile', settings: { title: 'Fragrance', background: '#f3ddd1' } },
  ],
});

export const beauxeProductGridSection: SectionDefinition = defineSection({
  type: 'beauxe-product-grid',
  name: 'Product Grid',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'source', type: 'select', label: 'Source', default: 'featured', options: [
      { value: 'featured', label: 'Featured' },
      { value: 'newest', label: 'Newest' },
      { value: 'popular', label: 'Popular' },
    ]},
    { id: 'product_limit', type: 'number', label: 'Limit', default: 8, min: 4, max: 16 },
  ],
});

export const beauxeBannerSection: SectionDefinition = defineSection({
  type: 'beauxe-banner',
  name: 'CTA Banner',
  description: 'Full-width pink banner with serif heading and CTA',
  target: 'body',
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
    { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
    { id: 'background_color', type: 'color', label: 'Background', default: '#f8e4e4' },
  ],
});

export const beauxeTestimonialsSection: SectionDefinition = defineSection({
  type: 'beauxe-testimonials',
  name: 'Testimonials',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
  ],
  blocks: [
    {
      type: 'quote',
      name: 'Quote',
      settings: [
        { id: 'quote', type: 'textarea', label: 'Quote', default: '' },
        { id: 'author', type: 'text', label: 'Author', default: '' },
        { id: 'role', type: 'text', label: 'Role', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 't-1', type: 'quote', settings: { quote: 'Absolutely love this serum! My skin has never felt so hydrated and glowing.', author: 'Emma R.', role: 'Verified Buyer' } },
    { id: 't-2', type: 'quote', settings: { quote: 'The packaging is beautiful and the products actually work. Highly recommend!', author: 'Sophie L.', role: 'Verified Buyer' } },
    { id: 't-3', type: 'quote', settings: { quote: 'Clean ingredients, amazing results. This is now a staple in my routine.', author: 'Mia K.', role: 'Verified Buyer' } },
  ],
});

// ─── Template ────────────────────────────────────────────────────

const indexTemplate: SectionInstance[] = [
  { id: 'beauxe-topbar', type: 'beauxe-top-bar', settings: {} },
  { id: 'beauxe-hero', type: 'beauxe-hero', settings: {} },
  { id: 'beauxe-features', type: 'beauxe-feature-strip', settings: {} },
  { id: 'beauxe-categories', type: 'beauxe-category-tiles', settings: {} },
  { id: 'beauxe-bestsellers', type: 'beauxe-product-grid', settings: { heading: 'BEST SELLERS' } },
  { id: 'beauxe-banner', type: 'beauxe-banner', settings: {} },
  { id: 'beauxe-newarrivals', type: 'beauxe-product-grid', settings: { heading: 'NEW ARRIVALS', source: 'newest' } },
  { id: 'beauxe-testimonials', type: 'beauxe-testimonials', settings: {} },
  { id: 'beauxe-newsletter', type: 'newsletter', settings: {} },
];

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'beauxe',
  name: 'Beauxe',
  version: '1.0.0',
  description: 'Model-led cosmetics theme with soft pink/cream palette, serif headlines and rounded CTAs.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['cosmetics', 'beauty'],

  colors: {
    primary: '#1d1d3b',
    secondary: '#d4a8b3',
    accent: '#f8e4e4',
    background: '#fffdfb',
    foreground: '#1d1d3b',
    muted: '#8a8299',
    border: '#f0e4e7',
    error: '#e05070',
    success: '#7ca082',
  },

  typography: {
    fontFamily: 'Nunito, system-ui, sans-serif',
    headingFontFamily: 'Playfair Display, Georgia, serif',
    baseFontSize: '15px',
    lineHeight: '1.65',
  },

  layout: {
    maxWidth: '1280px',
  },

  designTokens: {
    motion: { durationFast: '160ms', durationBase: '320ms', durationSlow: '600ms', easeEntrance: 'cubic-bezier(0.22, 1, 0.36, 1)', hoverLift: 'translateY(-3px)' },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Top Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Top Bar Text', default: '' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'product_tile_bg_1', type: 'color', label: 'Product tile background 1', default: '#f8e4e4' },
    { id: 'product_tile_bg_2', type: 'color', label: 'Product tile background 2', default: '#faf3ec' },
    { id: 'product_tile_bg_3', type: 'color', label: 'Product tile background 3', default: '#f3ddd1' },
    { id: 'product_tile_bg_4', type: 'color', label: 'Product tile background 4', default: '#f5e1d8' },
    { id: 'product_tile_bg_5', type: 'color', label: 'Product tile background 5', default: '#f9ebe6' },
  ],

  sections: [
    beauxeTopBarSection,
    beauxeHeroSection,
    beauxeFeatureStripSection,
    beauxeCategoryTilesSection,
    beauxeProductGridSection,
    beauxeBannerSection,
    beauxeTestimonialsSection,
  ],

  templates: {
    index: indexTemplate,
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
