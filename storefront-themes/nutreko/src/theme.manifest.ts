import { defineTheme } from '@shared/theme/defineTheme';
import { defineSection } from '@shared/theme/defineSection';
import type { SectionDefinition, SectionInstance } from '@shared/types/theme';

/**
 * NUTREKO — bold black/white/lime supplements theme.
 *
 * Sports-nutrition vibe: chunky sans headlines, 100% AUTHENTIC /
 * MAXIMUM POTENCY guarantee panels, explore-the-range category strip,
 * TOP SELLERS + TRENDING NOW + FUEL YOUR WORKOUT product rails.
 */

// ─── Section Definitions ─────────────────────────────────────────

export const nutrekoTopStripSection: SectionDefinition = defineSection({
  type: 'nutreko-top-strip',
  name: 'Top Info Strip',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'text', type: 'text', label: 'Text', default: '' },
  ],
});

export const nutrekoHeroSection: SectionDefinition = defineSection({
  type: 'nutreko-hero',
  name: 'Power Hero',
  description: 'Bold black hero with chunky headline and lime CTA',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
    { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
    { id: 'secondary_cta_text', type: 'text', label: 'Secondary CTA', default: '' },
    { id: 'image', type: 'image', label: 'Hero Image' },
  ],
});

export const nutrekoGuaranteeSection: SectionDefinition = defineSection({
  type: 'nutreko-guarantee',
  name: 'Guarantee Panels',
  description: '100% AUTHENTIC / MAXIMUM POTENCY / LAB TESTED panels',
  target: 'body',
  settings: [],
  blocks: [
    {
      type: 'panel',
      name: 'Guarantee',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'subtitle', type: 'text', label: 'Subtitle', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'g-1', type: 'panel', settings: { title: '100% AUTHENTIC', subtitle: 'Sourced direct from brands' } },
    { id: 'g-2', type: 'panel', settings: { title: 'MAXIMUM POTENCY', subtitle: 'Premium grade formulas' } },
    { id: 'g-3', type: 'panel', settings: { title: 'LAB TESTED', subtitle: 'Every batch verified' } },
    { id: 'g-4', type: 'panel', settings: { title: 'FAST SHIPPING', subtitle: 'Ships within 24 hours' } },
  ],
});

export const nutrekoCategoryStripSection: SectionDefinition = defineSection({
  type: 'nutreko-category-strip',
  name: 'Explore The Range',
  description: 'Horizontal category pills',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
  ],
  blocks: [
    {
      type: 'category',
      name: 'Category',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'cta_url', type: 'url', label: 'URL', default: '/products' },
        { id: 'image', type: 'image', label: 'Image' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'c-1', type: 'category', settings: { title: 'PROTEIN' } },
    { id: 'c-2', type: 'category', settings: { title: 'PRE-WORKOUT' } },
    { id: 'c-3', type: 'category', settings: { title: 'CREATINE' } },
    { id: 'c-4', type: 'category', settings: { title: 'RECOVERY' } },
    { id: 'c-5', type: 'category', settings: { title: 'VITAMINS' } },
  ],
});

export const nutrekoProductGridSection: SectionDefinition = defineSection({
  type: 'nutreko-product-grid',
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

export const nutrekoBannerSection: SectionDefinition = defineSection({
  type: 'nutreko-banner',
  name: 'Promo Banner',
  description: 'Full-width dark banner with lime accent and CTA',
  target: 'body',
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
    { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
  ],
});

// ─── Template ────────────────────────────────────────────────────

const indexTemplate: SectionInstance[] = [
  { id: 'nutreko-strip', type: 'nutreko-top-strip', settings: {} },
  { id: 'nutreko-hero', type: 'nutreko-hero', settings: {} },
  { id: 'nutreko-guarantee', type: 'nutreko-guarantee', settings: {} },
  { id: 'nutreko-categories', type: 'nutreko-category-strip', settings: {} },
  { id: 'nutreko-topsellers', type: 'nutreko-product-grid', settings: { heading: 'TOP SELLERS', source: 'featured' } },
  { id: 'nutreko-banner', type: 'nutreko-banner', settings: {} },
  { id: 'nutreko-trending', type: 'nutreko-product-grid', settings: { heading: 'TRENDING NOW', source: 'newest' } },
  { id: 'nutreko-fuel', type: 'nutreko-product-grid', settings: { heading: 'FUEL YOUR WORKOUT', source: 'popular' } },
  { id: 'nutreko-newsletter', type: 'newsletter', settings: {} },
];

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'nutreko',
  name: 'Nutreko',
  version: '1.0.0',
  description: 'Bold sports-nutrition theme with chunky typography, black/lime palette and high-energy product rails.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['supplements', 'health', 'fitness'],

  colors: {
    primary: '#a3e635',
    secondary: '#0a0a0a',
    accent: '#ff6a13',
    background: '#ffffff',
    foreground: '#0a0a0a',
    muted: '#6b7280',
    border: '#e5e5e5',
    error: '#dc2626',
    success: '#16a34a',
  },

  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFontFamily: 'Archivo Black, Inter, sans-serif',
    baseFontSize: '15px',
    lineHeight: '1.6',
  },

  layout: {
    maxWidth: '1280px',
  },

  designTokens: {
    motion: {
      durationFast: '110ms',
      durationBase: '200ms',
      durationSlow: '360ms',
      easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeEntrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
      hoverLift: 'translateY(-5px)',
    },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Top Strip', default: true },
    { id: 'announcement_text', type: 'text', label: 'Top Strip Text', default: '' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
  ],

  sections: [
    nutrekoTopStripSection,
    nutrekoHeroSection,
    nutrekoGuaranteeSection,
    nutrekoCategoryStripSection,
    nutrekoProductGridSection,
    nutrekoBannerSection,
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
