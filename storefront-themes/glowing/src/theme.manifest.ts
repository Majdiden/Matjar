import { defineTheme } from '@shared/theme/defineTheme';
import { defineSection } from '@shared/theme/defineSection';
import type { SectionDefinition, SectionInstance } from '@shared/types/theme';

/**
 * GLOWING — minimalist cosmetics theme.
 *
 * Design language: ultra-minimal, white space, centered serif wordmark,
 * black buttons, thin rules, SALE badges in red. Three promo cards under
 * hero (Summer Collection / What's New? / Buy 1 Get 1). Clean grid of
 * product cards with SALE pills.
 */

// ─── Section Definitions ─────────────────────────────────────────

export const topStripSection: SectionDefinition = defineSection({
  type: 'glowing-top-strip',
  name: 'Top Announcement Strip',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'text', type: 'text', label: 'Text', default: '' },
  ],
});

export const glowingHeroSection: SectionDefinition = defineSection({
  type: 'glowing-hero',
  name: 'Editorial Hero',
  description: 'Large serif headline with soft pastel/leaf backdrop and CTA',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
    { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
    { id: 'image', type: 'image', label: 'Hero Image' },
  ],
});

export const glowingPromoCardsSection: SectionDefinition = defineSection({
  type: 'glowing-promo-cards',
  name: 'Three Promo Cards',
  description: 'Row of 3 promo cards (collection / new / offer)',
  target: 'body',
  settings: [],
  blocks: [
    {
      type: 'card',
      name: 'Promo Card',
      settings: [
        { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'cta_text', type: 'text', label: 'CTA', default: '' },
        { id: 'cta_url', type: 'url', label: 'URL', default: '/products' },
        { id: 'background_color', type: 'color', label: 'Background', default: '#f7efe6' },
        { id: 'image', type: 'image', label: 'Image' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'glowing-card-1', type: 'card', settings: { eyebrow: 'NEW SEASON', title: 'Summer Collection', cta_text: 'SHOP NOW', background_color: '#f7efe6' } },
    { id: 'glowing-card-2', type: 'card', settings: { eyebrow: 'JUST DROPPED', title: "What's New?", cta_text: 'DISCOVER', background_color: '#ebe4db' } },
    { id: 'glowing-card-3', type: 'card', settings: { eyebrow: 'LIMITED OFFER', title: 'Buy 1 Get 1', cta_text: 'SHOP NOW', background_color: '#efe0d2' } },
  ],
});

export const glowingProductGridSection: SectionDefinition = defineSection({
  type: 'glowing-product-grid',
  name: 'Product Grid',
  description: 'Clean grid of products with SALE badges',
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
    { id: 'columns', type: 'select', label: 'Columns', default: '4', options: [
      { value: '3', label: '3' },
      { value: '4', label: '4' },
    ]},
  ],
});

export const glowingQuoteSection: SectionDefinition = defineSection({
  type: 'glowing-quote',
  name: 'Centered Quote',
  target: 'body',
  settings: [
    { id: 'quote', type: 'textarea', label: 'Quote', default: '' },
    { id: 'author', type: 'text', label: 'Author', default: '' },
  ],
});

export const glowingInstagramSection: SectionDefinition = defineSection({
  type: 'glowing-instagram',
  name: 'Instagram Row',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
  ],
  blocks: [
    {
      type: 'tile',
      name: 'Instagram Tile',
      settings: [
        { id: 'image', type: 'image', label: 'Image' },
        { id: 'link', type: 'url', label: 'Post URL', default: '' },
        { id: 'background_color', type: 'color', label: 'Background tint', default: '#f7efe6' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'glowing-insta-1', type: 'tile', settings: { background_color: '#f7efe6' } },
    { id: 'glowing-insta-2', type: 'tile', settings: { background_color: '#efe0d2' } },
    { id: 'glowing-insta-3', type: 'tile', settings: { background_color: '#ebe4db' } },
    { id: 'glowing-insta-4', type: 'tile', settings: { background_color: '#f5e6d8' } },
    { id: 'glowing-insta-5', type: 'tile', settings: { background_color: '#eadfd0' } },
    { id: 'glowing-insta-6', type: 'tile', settings: { background_color: '#e8ddc9' } },
  ],
});

// ─── Templates ───────────────────────────────────────────────────

const indexTemplate: SectionInstance[] = [
  { id: 'glowing-strip', type: 'glowing-top-strip', settings: {} },
  { id: 'glowing-hero', type: 'glowing-hero', settings: {} },
  { id: 'glowing-promos', type: 'glowing-promo-cards', settings: {} },
  { id: 'glowing-bestsellers', type: 'glowing-product-grid', settings: { heading: 'BEST SELLERS', source: 'featured' } },
  { id: 'glowing-quote', type: 'glowing-quote', settings: {} },
  { id: 'glowing-newarrivals', type: 'glowing-product-grid', settings: { heading: 'NEW ARRIVALS', source: 'newest' } },
  { id: 'glowing-insta', type: 'glowing-instagram', settings: {} },
  { id: 'glowing-newsletter', type: 'newsletter', settings: {} },
];

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'glowing',
  name: 'Glowing',
  version: '1.0.0',
  description: 'Minimalist cosmetics theme with editorial serif headings, generous whitespace and clean product grids.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['cosmetics', 'beauty'],

  colors: {
    primary: '#111111',
    secondary: '#6b6b6b',
    accent: '#d4a373',
    background: '#ffffff',
    foreground: '#111111',
    muted: '#8a8a8a',
    border: '#e8e1d6',
    error: '#c03030',
    success: '#4a8a4a',
  },

  typography: {
    fontFamily: "Inter, 'Tajawal', system-ui, sans-serif",
    headingFontFamily: "Cormorant Garamond, 'Amiri', Georgia, serif",
    baseFontSize: '15px',
    lineHeight: '1.7',
  },

  layout: {
    maxWidth: '1280px',
  },

  designTokens: {
    motion: {
      durationFast: '170ms',
      durationBase: '320ms',
      durationSlow: '560ms',
      easeEntrance: 'cubic-bezier(0.22, 1, 0.36, 1)',
      hoverLift: 'translateY(-4px) scale(1.01)',
    },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Top Strip', default: true },
    { id: 'announcement_text', type: 'text', label: 'Top Strip Text', default: '' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
  ],

  sections: [
    topStripSection,
    glowingHeroSection,
    glowingPromoCardsSection,
    glowingProductGridSection,
    glowingQuoteSection,
    glowingInstagramSection,
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
