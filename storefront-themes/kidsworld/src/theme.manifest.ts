import { defineTheme } from '@shared/theme/defineTheme';
import { defineSection } from '@shared/theme/defineSection';
import type { SectionDefinition } from '@shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero Banner',
  description: 'Playful full-width gradient hero with animated SVG decorations, bold headline, and yellow pill CTA button',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading_line1', type: 'text', label: 'Heading Line 1', default: '' },
    { id: 'heading_line2', type: 'text', label: 'Heading Line 2', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'button_url', type: 'url', label: 'Button URL', default: '/products' },
    { id: 'gradient_from', type: 'color', label: 'Gradient From', default: '#ec4899' },
    { id: 'gradient_via', type: 'color', label: 'Gradient Via', default: '#8b5cf6' },
    { id: 'gradient_to', type: 'color', label: 'Gradient To', default: '#3b82f6' },
    { id: 'button_color', type: 'color', label: 'Button Color', default: '#fbbf24' },
  ],
});

export const categoriesSection: SectionDefinition = defineSection({
  type: 'categories',
  name: 'Category Bubbles',
  description: 'Colorful rounded category bubbles with styled letter icons for kid-friendly browsing',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'heading_highlight', type: 'text', label: 'Heading Highlight Word', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 6, min: 2, max: 12 },
  ],
  blocks: [
    {
      type: 'category-bubble',
      name: 'Category Bubble',
      settings: [
        { id: 'name', type: 'text', label: 'Category Name', default: '' },
        { id: 'letter', type: 'text', label: 'Letter', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'bubble-1', type: 'category-bubble', settings: { name: 'Action Figures', letter: 'A' } },
    { id: 'bubble-2', type: 'category-bubble', settings: { name: 'Building Sets', letter: 'B' } },
    { id: 'bubble-3', type: 'category-bubble', settings: { name: 'Dolls', letter: 'D' } },
    { id: 'bubble-4', type: 'category-bubble', settings: { name: 'Board Games', letter: 'B' } },
    { id: 'bubble-5', type: 'category-bubble', settings: { name: 'Vehicles', letter: 'V' } },
    { id: 'bubble-6', type: 'category-bubble', settings: { name: 'Arts & Crafts', letter: 'A' } },
  ],
});

export const shopByAgeSection: SectionDefinition = defineSection({
  type: 'shop-by-age',
  name: 'Shop by Age',
  description: 'Age-band picker that links into the catalog with a matching `age` query param',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'heading_highlight', type: 'text', label: 'Heading Highlight Word', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
  ],
  blocks: [
    {
      type: 'age-group',
      name: 'Age Group',
      settings: [
        { id: 'label', type: 'text', label: 'Age Label', default: '' },
        { id: 'name', type: 'text', label: 'Group Name', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'age-1', type: 'age-group', settings: { label: '0–2', name: 'Babies & Toddlers' } },
    { id: 'age-2', type: 'age-group', settings: { label: '3–5', name: 'Preschool' } },
    { id: 'age-3', type: 'age-group', settings: { label: '6–8', name: 'Little Kids' } },
    { id: 'age-4', type: 'age-group', settings: { label: '9–11', name: 'Big Kids' } },
    { id: 'age-5', type: 'age-group', settings: { label: '12+', name: 'Tweens & Teens' } },
  ],
});

export const trustBadgesSection: SectionDefinition = defineSection({
  type: 'trust-badges',
  name: 'Trust Badges',
  description: 'Safety and quality trust indicators displayed in a card grid',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'show_section', type: 'checkbox', label: 'Show Section', default: true },
    { id: 'highlight_color', type: 'color', label: 'Card Hover Border Color', default: '#fbbf24' },
  ],
  blocks: [
    {
      type: 'badge',
      name: 'Trust Badge',
      settings: [
        { id: 'icon', type: 'text', label: 'Icon (shield|star|book|truck)', default: '' },
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'description', type: 'text', label: 'Description', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'badge-1', type: 'badge', settings: { icon: 'shield', title: 'Safe & Certified', description: 'All toys tested & approved' } },
    { id: 'badge-2', type: 'badge', settings: { icon: 'star', title: 'Fun Guaranteed', description: 'Or your money back' } },
    { id: 'badge-3', type: 'badge', settings: { icon: 'book', title: 'Educational', description: 'Learn through play' } },
    { id: 'badge-4', type: 'badge', settings: { icon: 'truck', title: 'Fast Shipping', description: 'Free over $40' } },
  ],
});

export const featuredProductsSection: SectionDefinition = defineSection({
  type: 'featured-products',
  name: 'Best Sellers',
  description: 'Grid of best-selling toys with ratings and add-to-cart',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 2, max: 16 },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: '' },
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: '' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'columns', type: 'select', label: 'Columns', default: '4', options: [
      { value: '2', label: '2 Columns' },
      { value: '3', label: '3 Columns' },
      { value: '4', label: '4 Columns' },
    ]},
  ],
});

export const newArrivalsSection: SectionDefinition = defineSection({
  type: 'new-arrivals',
  name: 'New Adventures',
  description: 'Scrollable carousel of newly arrived toys ready for playtime',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 4, max: 16 },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: '' },
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play', default: false },
    { id: 'show_arrows', type: 'checkbox', label: 'Show Arrows', default: true },
    { id: 'show_dots', type: 'checkbox', label: 'Show Dots', default: true },
  ],
});

export const newsletterSection: SectionDefinition = defineSection({
  type: 'newsletter',
  name: 'Fun Club CTA',
  description: 'Colorful email signup section with playful gradient and fun messaging',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'placeholder', type: 'text', label: 'Input Placeholder', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'gradient_from', type: 'color', label: 'Gradient From', default: '#fbbf24' },
    { id: 'gradient_via', type: 'color', label: 'Gradient Via', default: '#ec4899' },
    { id: 'gradient_to', type: 'color', label: 'Gradient To', default: '#8b5cf6' },
    { id: 'button_text_color', type: 'color', label: 'Button Text Color', default: '#ec4899' },
  ],
});

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'kidsworld',
  name: 'KidsWorld',
  version: '1.0.0',
  description: 'A vibrant, playful theme built for toy and kids\' product stores. Features bold gradients, colorful category bubbles, and joyful typography.',
  author: { name: 'Matjar', website: 'https://matjar.com' },
  categories: ['toys', 'general'],

  colors: {
    primary: '#ec4899',
    secondary: '#8b5cf6',
    accent: '#fbbf24',
    background: '#ffffff',
    foreground: '#1f2937',
    muted: '#6b7280',
    border: '#fce7f3',
    error: '#ef4444',
    success: '#10b981',
  },

  typography: {
    fontFamily: "Nunito, 'Baloo Bhaijaan 2', system-ui, sans-serif",
    headingFontFamily: "Nunito, 'Baloo Bhaijaan 2', system-ui, sans-serif",
    baseFontSize: '16px',
    lineHeight: '1.6',
  },

  layout: {
    maxWidth: '1280px',
    headerStyle: 'standard',
    footerStyle: 'standard',
  },

  designTokens: {
    motion: {
      durationFast: '160ms',
      durationBase: '300ms',
      durationSlow: '520ms',
      easeEntrance: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      hoverLift: 'translateY(-6px) scale(1.03)',
    },
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
    { id: 'announcement_bg', type: 'color', label: 'Announcement Background', default: '#ec4899' },
    { id: 'enable_quick_view', type: 'checkbox', label: 'Enable Quick View', default: true },
    { id: 'border_radius', type: 'range', label: 'Border Radius', min: 0, max: 32, step: 4, default: 16, unit: 'px' },
  ],

  sections: [
    heroSection,
    categoriesSection,
    shopByAgeSection,
    trustBadgesSection,
    featuredProductsSection,
    newArrivalsSection,
    newsletterSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'categories', type: 'categories', settings: {}, blocks: [
        { id: 'bubble-1', type: 'category-bubble', settings: { name: 'Action Figures', letter: 'A' } },
        { id: 'bubble-2', type: 'category-bubble', settings: { name: 'Building Sets', letter: 'B' } },
        { id: 'bubble-3', type: 'category-bubble', settings: { name: 'Dolls', letter: 'D' } },
        { id: 'bubble-4', type: 'category-bubble', settings: { name: 'Board Games', letter: 'B' } },
        { id: 'bubble-5', type: 'category-bubble', settings: { name: 'Vehicles', letter: 'V' } },
        { id: 'bubble-6', type: 'category-bubble', settings: { name: 'Arts & Crafts', letter: 'A' } },
      ]},
      { id: 'shop-by-age', type: 'shop-by-age', settings: {}, blocks: [
        { id: 'age-1', type: 'age-group', settings: { label: '0–2', name: 'Babies & Toddlers' } },
        { id: 'age-2', type: 'age-group', settings: { label: '3–5', name: 'Preschool' } },
        { id: 'age-3', type: 'age-group', settings: { label: '6–8', name: 'Little Kids' } },
        { id: 'age-4', type: 'age-group', settings: { label: '9–11', name: 'Big Kids' } },
        { id: 'age-5', type: 'age-group', settings: { label: '12+', name: 'Tweens & Teens' } },
      ]},
      { id: 'trust-badges', type: 'trust-badges', settings: {}, blocks: [
        { id: 'badge-1', type: 'badge', settings: { icon: 'shield', title: 'Safe & Certified', description: 'All toys tested & approved' } },
        { id: 'badge-2', type: 'badge', settings: { icon: 'star', title: 'Fun Guaranteed', description: 'Or your money back' } },
        { id: 'badge-3', type: 'badge', settings: { icon: 'book', title: 'Educational', description: 'Learn through play' } },
        { id: 'badge-4', type: 'badge', settings: { icon: 'truck', title: 'Fast Shipping', description: 'Free over $40' } },
      ]},
      { id: 'featured-products', type: 'featured-products', settings: {} },
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
