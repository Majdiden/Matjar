import { defineTheme } from '@matjar/theme-shared/theme/defineTheme';
import { defineSection } from '@matjar/theme-shared/theme/defineSection';
import type { SectionDefinition } from '@matjar/theme-shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero Banner',
  icon: 'LayoutTemplate',
  category: 'content',
  description: 'Full-width hero banner with green gradient background, headline, and call-to-action buttons',
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
    { id: 'hero_emoji', type: 'text', label: 'Hero Icon', default: '', info: 'Icon displayed in the decorative circle on the right' },
  ],
});

export const categoriesSection: SectionDefinition = defineSection({
  type: 'categories',
  name: 'Category Grid',
  icon: 'FolderTree',
  category: 'commerce',
  description: 'Display food and grocery categories in a responsive grid',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 8, min: 2, max: 12 },
    { id: 'show_product_count', type: 'checkbox', label: 'Show Product Count', default: true },
  ],
});

export const featuredProductsSection: SectionDefinition = defineSection({
  type: 'featured-products',
  name: "Today's Picks",
  icon: 'Star',
  category: 'commerce',
  description: 'Showcase featured products in a grid with quick-view support',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: "Today's Picks" },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 2, max: 16 },
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
    { id: 'show_add_to_cart', type: 'checkbox', label: 'Show Add to Cart', default: true },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: '' },
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: '' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
  ],
});

export const trustBadgesSection: SectionDefinition = defineSection({
  type: 'trust-badges',
  name: 'Trust Badges',
  icon: 'ShieldCheck',
  category: 'marketing',
  description: 'Highlight delivery, quality, and sourcing policies',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'show_section', type: 'checkbox', label: 'Show Section', default: true },
  ],
  blocks: [
    {
      type: 'badge',
      name: 'Trust Badge',
      settings: [
        { id: 'icon', type: 'text', label: 'Icon', default: '' },
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'description', type: 'text', label: 'Description', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'badge-1', type: 'badge', settings: { icon: 'truck', title: 'Same-Day Delivery', description: 'Order before 2PM' } },
    { id: 'badge-2', type: 'badge', settings: { icon: 'leaf', title: '100% Organic', description: 'Certified produce' } },
    { id: 'badge-3', type: 'badge', settings: { icon: 'check', title: 'Quality Guarantee', description: 'Or your money back' } },
    { id: 'badge-4', type: 'badge', settings: { icon: 'heart', title: 'Locally Sourced', description: 'Supporting local farms' } },
  ],
});

export const weeklyDealsSection: SectionDefinition = defineSection({
  type: 'weekly-deals',
  name: 'Weekly Deals Bar',
  icon: 'Tag',
  category: 'commerce',
  description: 'Urgency strip with heading, subheading, a countdown to Sunday, and a CTA button',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'badge_label', type: 'text', label: 'Badge Label', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: "Save up to 40% on this week's hand-picked selection" },
    { id: 'cta_label', type: 'text', label: 'CTA Label', default: '' },
    { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products?onSale=true' },
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
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: '' },
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: '' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products?sort=newest' },
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play Carousel', default: false },
  ],
});

export const newsletterSection: SectionDefinition = defineSection({
  type: 'newsletter',
  name: 'Recipes & Newsletter',
  icon: 'Mail',
  category: 'marketing',
  description: 'Email subscription section with recipe tips CTA',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'icon', type: 'text', label: 'Section Icon', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'placeholder', type: 'text', label: 'Input Placeholder', default: '' },
    { id: 'disclaimer', type: 'text', label: 'Disclaimer Text', default: '' },
  ],
});

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'freshmart',
  name: 'FreshMart',
  version: '1.0.0',
  previewImage: '/preview.jpg',
  description: 'A vibrant food and grocery theme with a farm-fresh aesthetic. Features green accents, category emoji grids, and a produce-focused layout.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['food', 'general'],

  colors: {
    primary: '#16a34a',
    secondary: '#15803d',
    accent: '#f59e0b',
    background: '#ffffff',
    foreground: '#1f2937',
    muted: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#16a34a',
  },

  typography: {
    fontFamily: "Inter, 'Cairo', system-ui, sans-serif",
    headingFontFamily: "Inter, 'Cairo', system-ui, sans-serif",
    baseFontSize: '16px',
    lineHeight: '1.6',
  },

  fonts: [
    { label: "Quicksand", value: "'Quicksand', sans-serif" },
    { label: "Nunito", value: "'Nunito', sans-serif" },
    { label: "Cairo", value: "'Cairo', sans-serif" },
  ],

  layout: {
    maxWidth: '1280px',
    headerStyle: 'standard',
    footerStyle: 'standard',
  },

  designTokens: {
    motion: {
      durationFast: '140ms',
      durationBase: '240ms',
      durationSlow: '420ms',
      easeEntrance: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      hoverLift: 'translateY(-5px)',
    },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
    { id: 'announcement_bg', type: 'color', label: 'Announcement Background', default: '#15803d' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'border_radius', type: 'range', label: 'Border Radius', min: 0, max: 24, step: 2, default: 16, unit: 'px' },
  ],

  sections: [
    heroSection,
    categoriesSection,
    weeklyDealsSection,
    featuredProductsSection,
    trustBadgesSection,
    newArrivalsSection,
    newsletterSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'categories', type: 'categories', settings: {} },
      { id: 'weekly-deals', type: 'weekly-deals', settings: {} },
      { id: 'featured-products', type: 'featured-products', settings: {} },
      { id: 'trust-badges', type: 'trust-badges', settings: {}, blocks: [
        { id: 'badge-1', type: 'badge', settings: { icon: 'truck', title: 'Same-Day Delivery', description: 'Order before 2PM' } },
        { id: 'badge-2', type: 'badge', settings: { icon: 'leaf', title: '100% Organic', description: 'Certified produce' } },
        { id: 'badge-3', type: 'badge', settings: { icon: 'check', title: 'Quality Guarantee', description: 'Or your money back' } },
        { id: 'badge-4', type: 'badge', settings: { icon: 'heart', title: 'Locally Sourced', description: 'Supporting local farms' } },
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
