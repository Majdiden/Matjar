import { defineTheme } from '@matjar/theme-shared/theme/defineTheme';
import { defineSection } from '@matjar/theme-shared/theme/defineSection';
import type { SectionDefinition } from '@matjar/theme-shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero Banner',
  icon: 'LayoutTemplate',
  category: 'content',
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
  icon: 'FolderTree',
  category: 'commerce',
  description: 'Shop-by-category tiles — auto-filled from your store categories, or add your own custom tiles with images and links',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'layout', type: 'select', label: 'Layout', default: 'bento', options: [
      { value: 'bento', label: 'Editorial (feature tile)' },
      { value: 'grid', label: 'Uniform grid' },
      { value: 'rail', label: 'Carousel rail' },
    ], info: 'Editorial promotes the first tile to a double-size feature on desktop when there are 5+ tiles' },
    { id: 'columns', type: 'select', label: 'Desktop Columns', default: '3', options: [
      { value: '2', label: '2 Columns' },
      { value: '3', label: '3 Columns' },
      { value: '4', label: '4 Columns' },
      { value: '5', label: '5 Columns' },
      { value: '6', label: '6 Columns' },
    ]},
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 6, min: 2, max: 12 },
    { id: 'show_product_count', type: 'checkbox', label: 'Show Product Count', default: true },
    { id: 'card_aspect', type: 'select', label: 'Tile Shape', default: '4/5', options: [
      { value: '4/5', label: 'Portrait (4:5)' },
      { value: '1/1', label: 'Square (1:1)' },
      { value: '3/4', label: 'Tall (3:4)' },
      { value: '16/9', label: 'Wide (16:9)' },
    ]},
    { id: 'card_overlay', type: 'checkbox', label: 'Text Over Image', default: true, info: 'Off puts the tile name below the image instead' },
    { id: 'heading_alignment', type: 'select', label: 'Heading Alignment', default: 'center', options: [
      { value: 'center', label: 'Center' },
      { value: 'start', label: 'Start' },
    ]},
  ],
  blocks: [
    {
      type: 'tile',
      name: 'Custom Tile',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '', info: 'Required — tiles without a title are hidden' },
        { id: 'subtitle', type: 'text', label: 'Subtitle', default: '' },
        { id: 'image', type: 'image', label: 'Image', info: 'Optional — a designed colour panel is used if empty' },
        { id: 'link', type: 'url', label: 'Link URL', default: '', info: 'e.g. /categories/phones or /products?sort=newest' },
      ],
    },
  ],
  // Two empty placeholder tiles so the block rows are discoverable in the
  // editor. Tiles without a title never render — the section keeps
  // auto-populating from the store's categories until one is filled in.
  defaultBlocks: [
    { id: 'tile-1', type: 'tile', settings: { title: '', subtitle: '', image: '', link: '' } },
    { id: 'tile-2', type: 'tile', settings: { title: '', subtitle: '', image: '', link: '' } },
  ],
});

export const featuredProductsSection: SectionDefinition = defineSection({
  type: 'featured-products',
  name: 'Featured Products',
  icon: 'Star',
  category: 'commerce',
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
  icon: 'ShieldCheck',
  category: 'marketing',
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

export const promoBannersSection: SectionDefinition = defineSection({
  type: 'promo-banners',
  name: 'Promo Banners',
  icon: 'Images',
  category: 'marketing',
  description: 'Clickable image banner slideshow for promotions, campaigns and lookbooks',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play', default: true },
    { id: 'autoplay_interval', type: 'number', label: 'Auto-play Interval', default: 5, min: 2, max: 15, step: 1 },
    { id: 'aspect_ratio', type: 'select', label: 'Banner Shape', default: '21/9', options: [
      { value: '16/9', label: 'Tall (16:9)' },
      { value: '21/9', label: 'Standard (21:9)' },
      { value: '3/1', label: 'Slim (3:1)' },
    ]},
    { id: 'rounded', type: 'checkbox', label: 'Rounded Corners', default: true },
    { id: 'show_arrows', type: 'checkbox', label: 'Show Arrows', default: true },
    { id: 'show_dots', type: 'checkbox', label: 'Show Dots', default: true },
  ],
  blocks: [
    {
      type: 'slide',
      name: 'Banner Slide',
      settings: [
        { id: 'image', type: 'image', label: 'Image' },
        { id: 'link', type: 'url', label: 'Link URL', default: '', info: 'The whole banner becomes clickable' },
        { id: 'alt', type: 'text', label: 'Image Description', default: '', info: 'For accessibility and SEO' },
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'subtitle', type: 'text', label: 'Subtitle', default: '' },
        { id: 'cta_label', type: 'text', label: 'Button Label', default: '' },
        { id: 'cta_url', type: 'url', label: 'Button URL', default: '', info: 'Falls back to the banner link' },
        { id: 'align', type: 'select', label: 'Text Alignment', default: 'start', options: [
          { value: 'start', label: 'Start' },
          { value: 'center', label: 'Center' },
          { value: 'end', label: 'End' },
        ]},
      ],
    },
  ],
  defaultBlocks: [
    { id: 'promo-slide-1', type: 'slide', settings: { image: '', link: '/products', align: 'start' } },
    { id: 'promo-slide-2', type: 'slide', settings: { image: '', link: '/products?sort=newest', align: 'start' } },
  ],
});

export const newArrivalsSection: SectionDefinition = defineSection({
  type: 'new-arrivals',
  name: 'New Arrivals',
  icon: 'Sparkles',
  category: 'commerce',
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
  icon: 'Mail',
  category: 'marketing',
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
  previewImage: '/preview.jpg',
  description: 'A clean, modern theme suitable for any type of store. Features a bold hero, category grid, and product showcases.',
  author: { name: 'Matjar', website: 'https://matjar.to' },
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

  fonts: [
    { label: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
    { label: "Inter", value: "Inter, system-ui, sans-serif" },
    { label: "Tajawal", value: "'Tajawal', sans-serif" },
  ],

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
    promoBannersSection,
    newArrivalsSection,
    newsletterSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'categories', type: 'categories', settings: {}, blocks: [
        { id: 'tile-1', type: 'tile', settings: { title: '', subtitle: '', image: '', link: '' } },
        { id: 'tile-2', type: 'tile', settings: { title: '', subtitle: '', image: '', link: '' } },
      ]},
      { id: 'featured-products', type: 'featured-products', settings: {} },
      { id: 'trust-badges', type: 'trust-badges', settings: {}, blocks: [
        { id: 'badge-1', type: 'badge', settings: { icon: 'shipping', title: 'Free Shipping', description: 'On orders over $50' } },
        { id: 'badge-2', type: 'badge', settings: { icon: 'lock', title: 'Secure Payment', description: '256-bit SSL encryption' } },
        { id: 'badge-3', type: 'badge', settings: { icon: 'return', title: 'Easy Returns', description: '30-day money back guarantee' } },
      ]},
      { id: 'promo-banners', type: 'promo-banners', settings: {}, blocks: [
        { id: 'promo-slide-1', type: 'slide', settings: { image: '', link: '/products', align: 'start' } },
        { id: 'promo-slide-2', type: 'slide', settings: { image: '', link: '/products?sort=newest', align: 'start' } },
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
