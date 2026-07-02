import { defineTheme } from '@shared/theme/defineTheme';
import { defineSection } from '@shared/theme/defineSection';
import type { SectionDefinition } from '@shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero Banner',
  description: 'Full-width gradient hero with decorative book emojis, tagline, headline, and CTA button',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow_text', type: 'text', label: 'Eyebrow Text', default: '' },
    { id: 'heading_line1', type: 'text', label: 'Heading Line 1', default: '' },
    { id: 'heading_line2', type: 'text', label: 'Heading Line 2', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'button_url', type: 'url', label: 'Button URL', default: '/products' },
    { id: 'gradient_from', type: 'color', label: 'Gradient From', default: '#7c3aed' },
    { id: 'gradient_via', type: 'color', label: 'Gradient Via', default: '#6d28d9' },
    { id: 'gradient_to', type: 'color', label: 'Gradient To', default: '#4c1d95' },
  ],
});

export const genresSection: SectionDefinition = defineSection({
  type: 'genres',
  name: 'Browse by Genre',
  description: 'Grid of genre category cards with emoji icons and hover effects',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 6, min: 2, max: 12 },
  ],
  blocks: [
    {
      type: 'genre',
      name: 'Genre',
      settings: [
        { id: 'name', type: 'text', label: 'Genre Name', default: '' },
        { id: 'icon', type: 'text', label: 'Icon Letter', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'genre-1', type: 'genre', settings: { name: 'Fiction', icon: 'F' } },
    { id: 'genre-2', type: 'genre', settings: { name: 'Non-Fiction', icon: 'N' } },
    { id: 'genre-3', type: 'genre', settings: { name: 'Sci-Fi', icon: 'S' } },
    { id: 'genre-4', type: 'genre', settings: { name: 'Mystery', icon: 'M' } },
    { id: 'genre-5', type: 'genre', settings: { name: 'Romance', icon: 'R' } },
    { id: 'genre-6', type: 'genre', settings: { name: 'History', icon: 'H' } },
  ],
});

export const staffPicksSection: SectionDefinition = defineSection({
  type: 'staff-picks',
  name: 'Staff Picks',
  description: 'Grid of hand-picked products curated by the store team',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 6, min: 2, max: 12 },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: '' },
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: '' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'columns', type: 'select', label: 'Columns', default: '3', options: [
      { value: '2', label: '2 Columns' },
      { value: '3', label: '3 Columns' },
    ]},
  ],
});

export const readingQuoteSection: SectionDefinition = defineSection({
  type: 'reading-quote',
  name: 'Reading Quote',
  description: 'Inspirational reading quote with subtle violet background',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'quote_text', type: 'textarea', label: 'Quote Text', default: '' },
    { id: 'quote_author', type: 'text', label: 'Quote Author', default: '' },
    { id: 'background_color', type: 'color', label: 'Background Color', default: '#ede9fe' },
  ],
});

export const bestsellersSection: SectionDefinition = defineSection({
  type: 'bestsellers',
  name: 'Bestsellers',
  description: 'Scrollable carousel of bestselling products',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 9, min: 4, max: 16 },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: '' },
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play', default: false },
    { id: 'show_arrows', type: 'checkbox', label: 'Show Arrows', default: true },
    { id: 'show_dots', type: 'checkbox', label: 'Show Dots', default: true },
  ],
});

export const newsletterSection: SectionDefinition = defineSection({
  type: 'newsletter',
  name: 'Reading List CTA',
  description: 'Email signup with violet gradient background to grow the reading community',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'placeholder', type: 'text', label: 'Input Placeholder', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'gradient_from', type: 'color', label: 'Gradient From', default: '#7c3aed' },
    { id: 'gradient_to', type: 'color', label: 'Gradient To', default: '#4c1d95' },
  ],
});

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'bookshelf',
  name: 'Bookshelf',
  version: '1.0.0',
  description: 'A literary-inspired theme designed for bookstores. Features a violet palette, genre browsing, staff picks, and an inspirational quote section.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['books', 'general'],

  colors: {
    primary: '#7c3aed',
    secondary: '#6d28d9',
    accent: '#4c1d95',
    background: '#ffffff',
    foreground: '#1f2937',
    muted: '#6b7280',
    border: '#ede9fe',
    error: '#ef4444',
    success: '#10b981',
  },

  typography: {
    fontFamily: "Georgia, 'Amiri', serif",
    headingFontFamily: "Georgia, 'Amiri', serif",
    baseFontSize: '16px',
    lineHeight: '1.7',
  },

  layout: {
    maxWidth: '1152px',
    headerStyle: 'standard',
    footerStyle: 'standard',
  },

  designTokens: {
    motion: { durationFast: '160ms', durationBase: '300ms', durationSlow: '520ms', easeEntrance: 'cubic-bezier(0.22, 1, 0.36, 1)', hoverLift: 'translateY(-4px)' },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
    { id: 'announcement_bg', type: 'color', label: 'Announcement Background', default: '#4c1d95' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'border_radius', type: 'range', label: 'Border Radius', min: 0, max: 24, step: 2, default: 12, unit: 'px' },
  ],

  sections: [
    heroSection,
    genresSection,
    staffPicksSection,
    readingQuoteSection,
    bestsellersSection,
    newsletterSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'genres', type: 'genres', settings: {}, blocks: [
        { id: 'genre-1', type: 'genre', settings: { name: 'Fiction', icon: 'F' } },
        { id: 'genre-2', type: 'genre', settings: { name: 'Non-Fiction', icon: 'N' } },
        { id: 'genre-3', type: 'genre', settings: { name: 'Sci-Fi', icon: 'S' } },
        { id: 'genre-4', type: 'genre', settings: { name: 'Mystery', icon: 'M' } },
        { id: 'genre-5', type: 'genre', settings: { name: 'Romance', icon: 'R' } },
        { id: 'genre-6', type: 'genre', settings: { name: 'History', icon: 'H' } },
      ]},
      { id: 'staff-picks', type: 'staff-picks', settings: {} },
      { id: 'reading-quote', type: 'reading-quote', settings: {} },
      { id: 'bestsellers', type: 'bestsellers', settings: {} },
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
