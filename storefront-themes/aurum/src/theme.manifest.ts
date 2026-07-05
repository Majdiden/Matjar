import { defineTheme } from '@matjar/theme-shared/theme/defineTheme';
import { defineSection } from '@matjar/theme-shared/theme/defineSection';
import type { SectionDefinition, SectionInstance } from '@matjar/theme-shared/types/theme';

/**
 * AURUM — dark editorial luxury jewelry theme.
 *
 * Design language: near-black canvas, warm off-white type, soft gold
 * accent. High-contrast Prata display serif over Jost geometric sans,
 * all-caps tracked labels, thin outline buttons, product photography on
 * warm light-neutral tiles. Slow, elegant motion.
 */

// Verified Unsplash jewelry photography (every id checked HTTP 200).
const U = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

// ─── Section Definitions ─────────────────────────────────────────

export const splitHeroSection: SectionDefinition = defineSection({
  type: 'aurum-split-hero',
  name: 'Split Hero',
  icon: 'LayoutTemplate',
  category: 'content',
  description: 'Full-bleed two-panel editorial hero with headline and CTA',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
    { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
    { id: 'image_left', type: 'image', label: 'Left Image', default: U('1531995811006-35cb42e1a022', 1400) },
    { id: 'image_right', type: 'image', label: 'Right Image', default: U('1588444650733-d0767b753fc8', 1400) },
  ],
});

export const marqueeSection: SectionDefinition = defineSection({
  type: 'aurum-marquee',
  name: 'Press Marquee',
  icon: 'Megaphone',
  category: 'marketing',
  description: 'Infinite scrolling strip of serif press wordmarks',
  target: 'body',
  settings: [
    { id: 'items', type: 'text', label: 'Items (comma separated)', default: 'ELLE, VOGUE, BAZAAR, FORBES, GRAZIA' },
    { id: 'speed', type: 'range', label: 'Scroll duration', default: 30, min: 10, max: 60, step: 5, unit: 's' },
  ],
});

export const spotlightSection: SectionDefinition = defineSection({
  type: 'aurum-spotlight',
  name: 'Editorial Spotlight',
  icon: 'Star',
  category: 'content',
  description: 'Large editorial image beside a single featured product',
  target: 'body',
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'image', type: 'image', label: 'Editorial Image', default: U('1506630448388-4e683c67ddb0', 1400) },
  ],
});

export const collectionTabsSection: SectionDefinition = defineSection({
  type: 'aurum-collection-tabs',
  name: 'Shop by Collection',
  icon: 'Layers',
  category: 'commerce',
  description: 'Underline category tabs over a filtered product grid',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Products per tab', default: 4, min: 4, max: 12 },
  ],
});

export const editorialSection: SectionDefinition = defineSection({
  type: 'aurum-editorial',
  name: 'Editorial Story',
  icon: 'Newspaper',
  category: 'content',
  description: 'Centered serif headline with two staggered portrait images',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'body', type: 'textarea', label: 'Body copy', default: '' },
    { id: 'image_1', type: 'image', label: 'First Image', default: U('1589128777073-263566ae5e4d') },
    { id: 'image_2', type: 'image', label: 'Second Image', default: U('1599459183200-59c7687a0275') },
  ],
});

export const productRailSection: SectionDefinition = defineSection({
  type: 'aurum-product-rail',
  name: 'Product Rail',
  icon: 'Grid3x3',
  category: 'commerce',
  description: 'Newest products with a view-all link',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'source', type: 'select', label: 'Source', default: 'newest', options: [
      { value: 'newest', label: 'Newest' },
      { value: 'featured', label: 'Featured' },
      { value: 'popular', label: 'Popular' },
    ]},
    { id: 'product_limit', type: 'number', label: 'Limit', default: 4, min: 4, max: 12 },
  ],
});

export const trustSection: SectionDefinition = defineSection({
  type: 'aurum-trust',
  name: 'Trust Columns',
  icon: 'ShieldCheck',
  category: 'marketing',
  description: 'Statement heading with three service reassurance columns',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
  ],
  blocks: [
    {
      type: 'column',
      name: 'Trust Column',
      settings: [
        { id: 'icon', type: 'select', label: 'Icon', default: 'returns', options: [
          { value: 'returns', label: 'Returns' },
          { value: 'shipping', label: 'Shipping' },
          { value: 'support', label: 'Support' },
        ]},
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'text', type: 'text', label: 'Text', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'aurum-trust-1', type: 'column', settings: { icon: 'returns' } },
    { id: 'aurum-trust-2', type: 'column', settings: { icon: 'shipping' } },
    { id: 'aurum-trust-3', type: 'column', settings: { icon: 'support' } },
  ],
});

export const collectionsShowcaseSection: SectionDefinition = defineSection({
  type: 'aurum-collections-showcase',
  name: 'Collections Showcase',
  icon: 'Layers',
  category: 'commerce',
  description: 'Tall category cards with overlaid labels and shop buttons',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'image_1', type: 'image', label: 'Fallback Image 1', default: U('1573408301185-9146fe634ad0') },
    { id: 'image_2', type: 'image', label: 'Fallback Image 2', default: U('1602173574767-37ac01994b2a') },
    { id: 'image_3', type: 'image', label: 'Fallback Image 3', default: U('1611591437281-460bfbe1220a') },
    { id: 'image_4', type: 'image', label: 'Fallback Image 4', default: U('1598560917505-59a3ad559071') },
  ],
});

export const statementSection: SectionDefinition = defineSection({
  type: 'aurum-statement',
  name: 'Scroll Statement',
  icon: 'Type',
  category: 'content',
  description: 'Huge serif statement whose lines brighten as they enter view',
  target: 'body',
  settings: [
    { id: 'text', type: 'textarea', label: 'Statement (one line per row)', default: '' },
  ],
});

export const gallerySection: SectionDefinition = defineSection({
  type: 'aurum-gallery',
  name: 'Social Gallery',
  icon: 'Instagram',
  category: 'media',
  description: 'Square image grid with a social handle button',
  target: 'body',
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'handle', type: 'text', label: 'Handle button text', default: '' },
    { id: 'handle_url', type: 'url', label: 'Handle URL', default: '' },
  ],
  blocks: [
    {
      type: 'tile',
      name: 'Gallery Tile',
      settings: [
        { id: 'image', type: 'image', label: 'Image' },
        { id: 'link', type: 'url', label: 'Link', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'aurum-gal-1', type: 'tile', settings: { image: U('1610694955371-d4a3e0ce4b52', 800) } },
    { id: 'aurum-gal-2', type: 'tile', settings: { image: U('1630019852942-f89202989a59', 800) } },
    { id: 'aurum-gal-3', type: 'tile', settings: { image: U('1620656798579-1984d9e87df7', 800) } },
    { id: 'aurum-gal-4', type: 'tile', settings: { image: U('1617117811969-97f441511dee', 800) } },
  ],
});

// ─── Templates ───────────────────────────────────────────────────

const indexTemplate: SectionInstance[] = [
  { id: 'aurum-hero', type: 'aurum-split-hero', settings: {} },
  { id: 'aurum-marquee', type: 'aurum-marquee', settings: {} },
  { id: 'aurum-spotlight', type: 'aurum-spotlight', settings: {} },
  { id: 'aurum-tabs', type: 'aurum-collection-tabs', settings: {} },
  { id: 'aurum-editorial', type: 'aurum-editorial', settings: {} },
  { id: 'aurum-rail', type: 'aurum-product-rail', settings: {} },
  { id: 'aurum-trust', type: 'aurum-trust', settings: {} },
  { id: 'aurum-showcase', type: 'aurum-collections-showcase', settings: {} },
  { id: 'aurum-statement', type: 'aurum-statement', settings: {} },
  { id: 'aurum-gallery', type: 'aurum-gallery', settings: {} },
];

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'aurum',
  name: 'Aurum',
  version: '1.0.0',
  previewImage: '/preview.jpg',
  description: 'A dark editorial luxury theme for jewelry and fine accessories. Prata serif headlines and soft gold accents over near-black.',
  author: { name: 'Matjar', website: 'https://matjar.to' },
  categories: ['jewelry', 'fashion', 'general'],

  colors: {
    primary: '#f4f1ea',
    secondary: '#a6a29a',
    accent: '#c8a24b',
    background: '#141414',
    foreground: '#f4f1ea',
    muted: '#a6a29a',
    border: '#2b2b2b',
    error: '#e5484d',
    success: '#5fae6e',
  },

  typography: {
    fontFamily: "'Jost', 'Tajawal', system-ui, sans-serif",
    headingFontFamily: "'Prata', 'Amiri', Georgia, serif",
    baseFontSize: '15px',
    lineHeight: '1.6',
  },

  fonts: [
    { label: "Prata", value: "'Prata', serif" },
    { label: "Jost", value: "'Jost', sans-serif" },
    { label: "Amiri", value: "'Amiri', serif" },
    { label: "Tajawal", value: "'Tajawal', sans-serif" },
  ],

  layout: {
    maxWidth: '1440px',
  },

  designTokens: {
    motion: {
      durationFast: '200ms',
      durationBase: '400ms',
      durationSlow: '700ms',
      easeEntrance: 'cubic-bezier(0.22, 1, 0.36, 1)',
      hoverLift: 'translateY(-4px)',
    },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
  ],

  sections: [
    splitHeroSection,
    marqueeSection,
    spotlightSection,
    collectionTabsSection,
    editorialSection,
    productRailSection,
    trustSection,
    collectionsShowcaseSection,
    statementSection,
    gallerySection,
  ],

  templates: {
    index: indexTemplate,
    // Per-template section buckets: empty arrays let merchants compose
    // layouts for these templates in the dashboard Visual Editor.
    product: [],
    collection: [],
    cart: [],
    search: [],
    page: [],
  },
});

export default manifest;
