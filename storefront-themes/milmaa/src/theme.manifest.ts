import { defineTheme } from '@shared/theme/defineTheme';
import { defineSection } from '@shared/theme/defineSection';
import type { SectionDefinition, SectionInstance } from '@shared/types/theme';

/**
 * MILMAA — single-product plant-based milk theme.
 *
 * Pastel teal/cream/pink palette with playful serif headlines.
 * Flavor panels (BANANA / BADAM / CASHEWNUT), blog, customers-talk
 * strip, insta shots, newsletter.
 */

// ─── Section Definitions ─────────────────────────────────────────

export const milmaaTopStripSection: SectionDefinition = defineSection({
  type: 'milmaa-top-strip',
  name: 'Top Strip',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'text', type: 'text', label: 'Text', default: '' },
  ],
});

export const milmaaHeroSection: SectionDefinition = defineSection({
  type: 'milmaa-hero',
  name: 'Embrace Hero',
  description: 'Pastel cream hero with serif headline and milk carton imagery',
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

export const milmaaFlavorsSection: SectionDefinition = defineSection({
  type: 'milmaa-flavors',
  name: 'Flavor Panels',
  description: '3 colorful flavor panels (Banana, Badam, Cashewnut)',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
  ],
  blocks: [
    {
      type: 'flavor',
      name: 'Flavor',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'subtitle', type: 'text', label: 'Subtitle', default: '' },
        { id: 'cta_url', type: 'url', label: 'URL', default: '/products' },
        { id: 'background', type: 'color', label: 'Background', default: '#f6dc68' },
        { id: 'image', type: 'image', label: 'Image' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'fl-1', type: 'flavor', settings: { title: 'BANANA MILK', subtitle: 'Sweet, creamy, naturally energizing', background: '#f6dc68' } },
    { id: 'fl-2', type: 'flavor', settings: { title: 'BADAM MILK', subtitle: 'Rich almond indulgence, iron-packed', background: '#f7c1b7' } },
    { id: 'fl-3', type: 'flavor', settings: { title: 'CASHEWNUT MILK', subtitle: 'Buttery smooth, protein-rich', background: '#5eaaa8' } },
  ],
});

export const milmaaProductGridSection: SectionDefinition = defineSection({
  type: 'milmaa-product-grid',
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
    { id: 'product_limit', type: 'number', label: 'Limit', default: 4, min: 4, max: 12 },
  ],
});

export const milmaaBenefitsSection: SectionDefinition = defineSection({
  type: 'milmaa-benefits',
  name: 'Health Benefits',
  description: 'Split image + bullet benefits list',
  target: 'body',
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'image', type: 'image', label: 'Image' },
  ],
  blocks: [
    {
      type: 'benefit',
      name: 'Benefit',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'description', type: 'textarea', label: 'Description', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'b-1', type: 'benefit', settings: { title: 'Rich in calcium & vitamin D', description: 'Each serving delivers your daily dose of essential minerals.' } },
    { id: 'b-2', type: 'benefit', settings: { title: '100% plant-based', description: 'No dairy, no lactose, no compromise on creaminess.' } },
    { id: 'b-3', type: 'benefit', settings: { title: 'Zero added sugar', description: 'Naturally sweetened — the way nature intended.' } },
  ],
});

export const milmaaBlogSection: SectionDefinition = defineSection({
  type: 'milmaa-blog',
  name: 'Blog Row',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
  ],
  blocks: [
    {
      type: 'post',
      name: 'Post',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'excerpt', type: 'textarea', label: 'Excerpt', default: '' },
        { id: 'date', type: 'text', label: 'Date', default: '' },
        { id: 'image', type: 'image', label: 'Image' },
        { id: 'cta_url', type: 'url', label: 'URL', default: '#' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'p-1', type: 'post', settings: { title: 'Top 5 plant-based smoothie recipes', excerpt: 'Kickstart your day with these nutritious blends packed with flavor.', date: 'Jun 12' } },
    { id: 'p-2', type: 'post', settings: { title: 'Why plant-based is the future', excerpt: 'The science behind sustainable nutrition and why it matters.', date: 'May 28' } },
    { id: 'p-3', type: 'post', settings: { title: 'Meet our farmers', excerpt: 'The hands that grow the nuts and oats behind every bottle.', date: 'May 14' } },
  ],
});

export const milmaaTestimonialsSection: SectionDefinition = defineSection({
  type: 'milmaa-testimonials',
  name: 'Customers Talk',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
  ],
  blocks: [
    {
      type: 'testimonial',
      name: 'Testimonial',
      settings: [
        { id: 'quote', type: 'textarea', label: 'Quote', default: '' },
        { id: 'author', type: 'text', label: 'Author', default: '' },
        { id: 'role', type: 'text', label: 'Role', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'tm-1', type: 'testimonial', settings: { quote: 'The creamiest plant milk I have ever tasted! My kids love it and I feel good giving it to them.', author: 'Sarah M.', role: 'Busy Mom' } },
    { id: 'tm-2', type: 'testimonial', settings: { quote: 'Perfect for my morning oats. Clean ingredients and amazing flavor — truly a game changer.', author: 'David L.', role: 'Yoga Instructor' } },
    { id: 'tm-3', type: 'testimonial', settings: { quote: 'Finally a non-dairy milk that actually tastes like milk. The badam flavor is to die for!', author: 'Priya K.', role: 'Foodie' } },
  ],
});

export const milmaaInstagramSection: SectionDefinition = defineSection({
  type: 'milmaa-instagram',
  name: 'Instagram Strip',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
  ],
});

// ─── Template ────────────────────────────────────────────────────

const indexTemplate: SectionInstance[] = [
  { id: 'milmaa-strip', type: 'milmaa-top-strip', settings: {} },
  { id: 'milmaa-hero', type: 'milmaa-hero', settings: {} },
  { id: 'milmaa-flavors', type: 'milmaa-flavors', settings: {} },
  { id: 'milmaa-grid', type: 'milmaa-product-grid', settings: {} },
  { id: 'milmaa-benefits', type: 'milmaa-benefits', settings: {} },
  { id: 'milmaa-blog', type: 'milmaa-blog', settings: {} },
  { id: 'milmaa-testimonials', type: 'milmaa-testimonials', settings: {} },
  { id: 'milmaa-insta', type: 'milmaa-instagram', settings: {} },
  { id: 'milmaa-newsletter', type: 'newsletter', settings: {} },
];

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'milmaa',
  name: 'Milmaa',
  version: '1.0.0',
  description: 'Single-product plant-based milk theme with pastel teal/cream/pink palette and playful serif headlines.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['beverages', 'food', 'wellness'],

  colors: {
    primary: '#5eaaa8',
    secondary: '#2c4a4a',
    accent: '#f7c1b7',
    background: '#fdf6ed',
    foreground: '#2c4a4a',
    muted: '#7a8f8f',
    border: '#ebe0ce',
    error: '#e05070',
    success: '#5eaaa8',
  },

  typography: {
    fontFamily: "DM Sans, 'Tajawal', system-ui, sans-serif",
    headingFontFamily: "Fraunces, 'Amiri', Georgia, serif",
    baseFontSize: '15px',
    lineHeight: '1.65',
  },

  layout: {
    maxWidth: '1280px',
  },

  designTokens: {
    motion: {
      durationFast: '180ms',
      durationBase: '340ms',
      durationSlow: '600ms',
      easeEntrance: 'cubic-bezier(0.22, 1, 0.36, 1)',
      hoverLift: 'translateY(-3px)',
    },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Top Strip', default: true },
    { id: 'announcement_text', type: 'text', label: 'Top Strip Text', default: '' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'product_tile_bg_1', type: 'color', label: 'Product Tile Background 1 (Teal)', default: '#2c4a4a' },
    { id: 'product_tile_bg_2', type: 'color', label: 'Product Tile Background 2 (Pink)', default: '#f7c1b7' },
    { id: 'product_tile_bg_3', type: 'color', label: 'Product Tile Background 3 (Mint)', default: '#5eaaa8' },
    { id: 'product_tile_bg_4', type: 'color', label: 'Product Tile Background 4 (Cream)', default: '#fdf6ed' },
    { id: 'product_tile_bg_5', type: 'color', label: 'Product Tile Background 5 (Sand)', default: '#ebe0ce' },
    { id: 'product_tile_fg_1', type: 'color', label: 'Product Tile Foreground 1', default: '#2c4a4a' },
    { id: 'product_tile_fg_2', type: 'color', label: 'Product Tile Foreground 2', default: '#2c4a4a' },
    { id: 'product_tile_fg_3', type: 'color', label: 'Product Tile Foreground 3', default: '#fdf6ed' },
    { id: 'product_tile_fg_4', type: 'color', label: 'Product Tile Foreground 4', default: '#2c4a4a' },
    { id: 'product_tile_fg_5', type: 'color', label: 'Product Tile Foreground 5', default: '#2c4a4a' },
  ],

  sections: [
    milmaaTopStripSection,
    milmaaHeroSection,
    milmaaFlavorsSection,
    milmaaProductGridSection,
    milmaaBenefitsSection,
    milmaaBlogSection,
    milmaaTestimonialsSection,
    milmaaInstagramSection,
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
