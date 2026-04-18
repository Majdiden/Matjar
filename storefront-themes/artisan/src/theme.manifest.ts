import { defineTheme } from '@shared/theme/defineTheme';
import { defineSection } from '@shared/theme/defineSection';
import type { SectionDefinition } from '@shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero Banner',
  description: 'Centered hero with brown background, decorative circles, and artisan headline',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow_text', type: 'text', label: 'Eyebrow Text', default: 'Handmade & Authentic' },
    { id: 'heading_line1', type: 'text', label: 'Heading Line 1', default: 'Crafted by Hand,' },
    { id: 'heading_line2', type: 'text', label: 'Heading Line 2', default: 'Made with Heart' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: 'Discover one-of-a-kind pieces from independent makers and artisans around the world.' },
    { id: 'primary_button_text', type: 'text', label: 'Primary Button Text', default: 'Explore Collection' },
    { id: 'primary_button_url', type: 'url', label: 'Primary Button URL', default: '/products' },
    { id: 'secondary_button_text', type: 'text', label: 'Secondary Button Text', default: 'Browse Crafts' },
    { id: 'secondary_button_url', type: 'url', label: 'Secondary Button URL', default: '/categories' },
  ],
});

export const philosophySection: SectionDefinition = defineSection({
  type: 'philosophy',
  name: 'Our Philosophy',
  description: 'A centred text block sharing the brand story and values',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: 'Our Philosophy' },
    { id: 'body_text', type: 'textarea', label: 'Body Text', default: 'Every item in our collection tells a story -- of tradition, craftsmanship, and the human touch that no machine can replicate. We partner directly with artisans to bring you authentic, sustainable, and beautiful creations.' },
    { id: 'show_dividers', type: 'checkbox', label: 'Show Decorative Dividers', default: true },
  ],
});

export const featuredProductsSection: SectionDefinition = defineSection({
  type: 'featured-products',
  name: 'Hand-Picked Pieces',
  description: 'Showcase curated featured products in a 3-column grid',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: 'Hand-Picked Pieces' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: 'Curated with care from our finest makers' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 6, min: 2, max: 12 },
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
    { id: 'show_add_to_cart', type: 'checkbox', label: 'Show Add to Cart', default: true },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: 'Add' },
    { id: 'view_all_text', type: 'text', label: 'View All Button Text', default: 'View All Pieces' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
  ],
});

export const artisanSpotlightSection: SectionDefinition = defineSection({
  type: 'artisan-spotlight',
  name: 'Artisan Spotlight',
  description: 'Feature individual makers with name, craft, and a personal quote',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: 'Artisan Spotlight' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: 'Meet the hands behind the craft' },
  ],
  blocks: [
    {
      type: 'maker',
      name: 'Maker',
      settings: [
        { id: 'name', type: 'text', label: 'Name', default: 'Maria Santos' },
        { id: 'craft', type: 'text', label: 'Craft', default: 'Ceramics' },
        { id: 'quote', type: 'textarea', label: 'Quote', default: 'Every piece carries the warmth of the kiln and the patience of my hands.' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'maker-1', type: 'maker', settings: { name: 'Maria Santos', craft: 'Ceramics', quote: 'Every piece carries the warmth of the kiln and the patience of my hands.' } },
    { id: 'maker-2', type: 'maker', settings: { name: 'James Okafor', craft: 'Woodworking', quote: 'I let the grain of the wood guide each cut. Nature is my co-designer.' } },
    { id: 'maker-3', type: 'maker', settings: { name: 'Aiko Tanaka', craft: 'Textiles', quote: 'Weaving connects me to generations of makers before me.' } },
  ],
});

export const categoriesSection: SectionDefinition = defineSection({
  type: 'categories',
  name: 'Browse by Craft',
  description: 'Display craft categories in a responsive grid',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: 'Browse by Craft' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: 'Explore our curated categories' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 4, min: 2, max: 8 },
    { id: 'show_product_count', type: 'checkbox', label: 'Show Product Count', default: true },
    { id: 'product_count_label', type: 'text', label: 'Product Count Label', default: 'pieces', info: 'Unit label appended to the product count (e.g. "4 pieces")' },
  ],
});

export const newArrivalsSection: SectionDefinition = defineSection({
  type: 'new-arrivals',
  name: 'New Arrivals',
  description: 'Carousel of recently added artisan products',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: 'New Arrivals' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: 'Fresh from the workshop' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 4, max: 16 },
    { id: 'show_add_to_cart', type: 'checkbox', label: 'Show Add to Cart', default: true },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: 'Add to Cart' },
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: 'See More' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products?sort=newest' },
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play Carousel', default: false },
  ],
});

export const newsletterSection: SectionDefinition = defineSection({
  type: 'newsletter',
  name: 'Newsletter Signup',
  description: 'Community CTA with email subscription for craft lovers',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: 'Handcrafted with Love' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: 'Join our community of craft lovers. Get early access to new collections, maker stories, and exclusive artisan offers.' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: 'Subscribe' },
    { id: 'placeholder', type: 'text', label: 'Input Placeholder', default: 'Enter your email' },
    { id: 'disclaimer', type: 'text', label: 'Disclaimer Text', default: 'No spam, unsubscribe anytime.' },
  ],
});

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'artisan',
  name: 'Artisan',
  version: '1.0.0',
  description: 'A handcrafted theme with warm brown and amber tones for artisan, handmade, and craft stores. Features a story-driven layout with maker spotlights.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['general', 'beauty'],

  colors: {
    primary: '#92400e',
    secondary: '#7c3510',
    accent: '#d97706',
    background: '#ffffff',
    foreground: '#1f2937',
    muted: '#6b7280',
    border: '#e8d5b7',
    error: '#ef4444',
    success: '#10b981',
  },

  typography: {
    fontFamily: 'Georgia, serif',
    headingFontFamily: 'Georgia, serif',
    baseFontSize: '16px',
    lineHeight: '1.7',
  },

  layout: {
    maxWidth: '1152px',
    headerStyle: 'standard',
    footerStyle: 'standard',
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: 'Free shipping on all handcrafted orders over $60!' },
    { id: 'announcement_bg', type: 'color', label: 'Announcement Background', default: '#92400e' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'border_radius', type: 'range', label: 'Border Radius', min: 0, max: 16, step: 2, default: 4, unit: 'px' },
  ],

  sections: [
    heroSection,
    philosophySection,
    featuredProductsSection,
    artisanSpotlightSection,
    categoriesSection,
    newArrivalsSection,
    newsletterSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'philosophy', type: 'philosophy', settings: {} },
      { id: 'featured-products', type: 'featured-products', settings: {} },
      { id: 'artisan-spotlight', type: 'artisan-spotlight', settings: {}, blocks: [
        { id: 'maker-1', type: 'maker', settings: { name: 'Maria Santos', craft: 'Ceramics', quote: 'Every piece carries the warmth of the kiln and the patience of my hands.' } },
        { id: 'maker-2', type: 'maker', settings: { name: 'James Okafor', craft: 'Woodworking', quote: 'I let the grain of the wood guide each cut. Nature is my co-designer.' } },
        { id: 'maker-3', type: 'maker', settings: { name: 'Aiko Tanaka', craft: 'Textiles', quote: 'Weaving connects me to generations of makers before me.' } },
      ]},
      { id: 'categories', type: 'categories', settings: {} },
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
