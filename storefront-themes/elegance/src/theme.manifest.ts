import { defineTheme } from '@shared/theme/defineTheme';
import { defineSection } from '@shared/theme/defineSection';
import type { SectionDefinition } from '@shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero — Editorial Full-Bleed',
  description: 'Full-bleed editorial hero with background image, headline anchored to the bottom-left, and a single CTA button',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow_text', type: 'text', label: 'Eyebrow Text', default: 'New Season', info: 'Small uppercase label shown above the headline' },
    { id: 'heading', type: 'text', label: 'Heading', default: 'Timeless Elegance', info: 'Falls back to store name if empty' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: 'Curated luxury fashion and accessories' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: 'Shop Collection' },
    { id: 'button_url', type: 'url', label: 'Button URL', default: '/products' },
    { id: 'background_image', type: 'image', label: 'Background Image', default: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1600&q=80', info: 'Recommended minimum width: 1600px' },
    { id: 'image_brightness', type: 'range', label: 'Image Brightness', min: 20, max: 100, step: 5, default: 70, unit: '%', info: 'Controls the darkening overlay over the image' },
    { id: 'section_height', type: 'select', label: 'Section Height', default: '70vh', options: [
      { value: '50vh', label: 'Short (50vh)' },
      { value: '70vh', label: 'Medium (70vh)' },
      { value: '90vh', label: 'Tall (90vh)' },
      { value: '100vh', label: 'Full Screen' },
    ]},
    { id: 'min_height', type: 'number', label: 'Minimum Height (px)', default: 500, min: 300, max: 900 },
  ],
});

export const collectionsSection: SectionDefinition = defineSection({
  type: 'collections',
  name: 'Collections Grid',
  description: 'Asymmetric category grid — first item spans two rows for an editorial editorial feel',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow_text', type: 'text', label: 'Eyebrow Text', default: 'Explore' },
    { id: 'heading', type: 'text', label: 'Heading', default: 'Our Collections' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 5, min: 2, max: 6, info: 'First category will span two rows in the asymmetric layout' },
    { id: 'hover_label', type: 'text', label: 'Hover Label', default: 'Explore', info: 'Text shown next to the arrow on card hover' },
    { id: 'show_category_names', type: 'checkbox', label: 'Show Category Names', default: true },
  ],
});

export const featuredProductsSection: SectionDefinition = defineSection({
  type: 'featured-products',
  name: "Editor's Picks",
  description: 'Curated grid of featured products with a fade-in-on-scroll animation',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow_text', type: 'text', label: 'Eyebrow Text', default: 'Curated' },
    { id: 'heading', type: 'text', label: 'Heading', default: "Editor's Picks" },
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: 'View All' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 2, max: 16 },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
    { id: 'show_badge', type: 'checkbox', label: 'Show Sale / New Badge', default: true },
    { id: 'enable_hover_swap', type: 'checkbox', label: 'Enable Hover Image Swap', default: true },
    { id: 'background_color', type: 'color', label: 'Section Background Color', default: '#f9fafb' },
    { id: 'animate_on_scroll', type: 'checkbox', label: 'Fade In on Scroll', default: true },
  ],
});

export const editorialBannerSection: SectionDefinition = defineSection({
  type: 'editorial-banner',
  name: 'Editorial Banner',
  description: 'Mid-page full-width visual break with background image, eyebrow, headline, and CTA',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow_text', type: 'text', label: 'Eyebrow Text', default: 'The Art of' },
    { id: 'heading', type: 'text', label: 'Heading', default: 'Effortless Style' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: 'Discover More' },
    { id: 'button_url', type: 'url', label: 'Button URL', default: '/products' },
    { id: 'background_image', type: 'image', label: 'Background Image', default: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80' },
    { id: 'image_opacity', type: 'range', label: 'Image Opacity', min: 10, max: 100, step: 5, default: 60, unit: '%' },
    { id: 'section_height', type: 'select', label: 'Section Height', default: '50vh', options: [
      { value: '40vh', label: 'Short (40vh)' },
      { value: '50vh', label: 'Medium (50vh)' },
      { value: '65vh', label: 'Tall (65vh)' },
    ]},
    { id: 'min_height', type: 'number', label: 'Minimum Height (px)', default: 350, min: 250, max: 700 },
    { id: 'background_color', type: 'color', label: 'Fallback Background Color', default: '#111827', info: 'Shown if no background image is set' },
  ],
});

export const newArrivalsSection: SectionDefinition = defineSection({
  type: 'new-arrivals',
  name: 'New Arrivals Carousel',
  description: 'Horizontal scrolling carousel of recently added products',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow_text', type: 'text', label: 'Eyebrow Text', default: 'Just In' },
    { id: 'heading', type: 'text', label: 'Heading', default: 'New Arrivals' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 6, min: 3, max: 12 },
    { id: 'slides_per_view', type: 'number', label: 'Slides Visible at Once', default: 3, min: 2, max: 4 },
    { id: 'show_arrows', type: 'checkbox', label: 'Show Navigation Arrows', default: true },
    { id: 'loop', type: 'checkbox', label: 'Loop Carousel', default: true },
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play', default: false },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
    { id: 'show_badge', type: 'checkbox', label: 'Show Sale / New Badge', default: true },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products?sort=newest' },
  ],
});

export const trustBarSection: SectionDefinition = defineSection({
  type: 'trust-bar',
  name: 'Trust Bar',
  description: 'Horizontal strip of trust signals — shipping, payment, returns, packaging',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'show_section', type: 'checkbox', label: 'Show Section', default: true },
    { id: 'border_top', type: 'checkbox', label: 'Show Top Border', default: true },
    { id: 'border_bottom', type: 'checkbox', label: 'Show Bottom Border', default: true },
  ],
  blocks: [
    {
      type: 'trust-item',
      name: 'Trust Item',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: 'Free Shipping' },
        { id: 'description', type: 'text', label: 'Description', default: 'On orders over $200' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'trust-1', type: 'trust-item', settings: { title: 'Free Shipping', description: 'On orders over $200' } },
    { id: 'trust-2', type: 'trust-item', settings: { title: 'Secure Payment', description: 'SSL encrypted' } },
    { id: 'trust-3', type: 'trust-item', settings: { title: 'Easy Returns', description: '30-day policy' } },
    { id: 'trust-4', type: 'trust-item', settings: { title: 'Luxury Packaging', description: 'Gift-ready' } },
  ],
});

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'elegance',
  name: 'Elegance',
  version: '1.0.0',
  description: 'A luxury fashion theme with editorial aesthetics. Features a full-bleed hero, asymmetric collection grid, and refined typography.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['fashion', 'luxury', 'jewelry', 'apparel'],

  colors: {
    primary: '#111827',
    secondary: '#374151',
    accent: '#c9a96e',
    background: '#ffffff',
    foreground: '#111827',
    muted: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
  },

  typography: {
    fontFamily: 'system-ui, sans-serif',
    headingFontFamily: '"Playfair Display", Georgia, serif',
    baseFontSize: '16px',
    lineHeight: '1.6',
  },

  layout: {
    maxWidth: '1280px',
    headerStyle: 'transparent',
    footerStyle: 'minimal',
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: 'Complimentary shipping on orders over $200' },
    { id: 'announcement_bg', type: 'color', label: 'Announcement Background', default: '#111827' },
    { id: 'announcement_text_color', type: 'color', label: 'Announcement Text Color', default: '#ffffff' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'gold_accent_color', type: 'color', label: 'Gold Accent Color', default: '#c9a96e', info: 'Used for borders, highlights, and interactive elements' },
    { id: 'card_border_radius', type: 'range', label: 'Card Border Radius', min: 0, max: 12, step: 1, default: 0, unit: 'px', info: 'Elegance theme defaults to sharp corners' },
  ],

  sections: [
    heroSection,
    collectionsSection,
    featuredProductsSection,
    editorialBannerSection,
    newArrivalsSection,
    trustBarSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'collections', type: 'collections', settings: {} },
      { id: 'featured-products', type: 'featured-products', settings: {} },
      { id: 'editorial-banner', type: 'editorial-banner', settings: {} },
      { id: 'new-arrivals', type: 'new-arrivals', settings: {} },
      { id: 'trust-bar', type: 'trust-bar', settings: {}, blocks: [
        { id: 'trust-1', type: 'trust-item', settings: { title: 'Free Shipping', description: 'On orders over $200' } },
        { id: 'trust-2', type: 'trust-item', settings: { title: 'Secure Payment', description: 'SSL encrypted' } },
        { id: 'trust-3', type: 'trust-item', settings: { title: 'Easy Returns', description: '30-day policy' } },
        { id: 'trust-4', type: 'trust-item', settings: { title: 'Luxury Packaging', description: 'Gift-ready' } },
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
