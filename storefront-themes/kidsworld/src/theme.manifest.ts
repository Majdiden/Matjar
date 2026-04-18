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
    { id: 'heading_line1', type: 'text', label: 'Heading Line 1', default: 'Imagination' },
    { id: 'heading_line2', type: 'text', label: 'Heading Line 2', default: 'Starts Here!' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: 'Discover amazing toys, games, and gifts that spark creativity and bring endless joy.' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: 'Explore Toys' },
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
    { id: 'heading', type: 'text', label: 'Heading', default: 'Shop by Category' },
    { id: 'heading_highlight', type: 'text', label: 'Heading Highlight Word', default: 'Shop' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: 'Something amazing for every little explorer' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 6, min: 2, max: 12 },
  ],
  blocks: [
    {
      type: 'category-bubble',
      name: 'Category Bubble',
      settings: [
        { id: 'name', type: 'text', label: 'Category Name', default: 'Action Figures' },
        { id: 'letter', type: 'text', label: 'Letter', default: 'A' },
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
    { id: 'heading', type: 'text', label: 'Heading', default: 'Shop by Age' },
    { id: 'heading_highlight', type: 'text', label: 'Heading Highlight Word', default: 'Age' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: 'Find the perfect toy for any age' },
  ],
  blocks: [
    {
      type: 'age-group',
      name: 'Age Group',
      settings: [
        { id: 'label', type: 'text', label: 'Age Label', default: '0–2' },
        { id: 'name', type: 'text', label: 'Group Name', default: 'Babies & Toddlers' },
        { id: 'emoji', type: 'text', label: 'Emoji', default: '🍼' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'age-1', type: 'age-group', settings: { label: '0–2', name: 'Babies & Toddlers', emoji: '🍼' } },
    { id: 'age-2', type: 'age-group', settings: { label: '3–5', name: 'Preschool', emoji: '🧸' } },
    { id: 'age-3', type: 'age-group', settings: { label: '6–8', name: 'Little Kids', emoji: '🚂' } },
    { id: 'age-4', type: 'age-group', settings: { label: '9–11', name: 'Big Kids', emoji: '🎮' } },
    { id: 'age-5', type: 'age-group', settings: { label: '12+', name: 'Tweens & Teens', emoji: '🎧' } },
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
        { id: 'icon', type: 'text', label: 'Icon (shield|star|book|truck)', default: 'shield' },
        { id: 'title', type: 'text', label: 'Title', default: 'Safe & Certified' },
        { id: 'description', type: 'text', label: 'Description', default: 'All toys tested & approved' },
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
    { id: 'heading', type: 'text', label: 'Heading', default: 'Best Sellers' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: 'The toys kids love most' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 2, max: 16 },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: 'Add to Cart' },
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: 'See All' },
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
    { id: 'heading', type: 'text', label: 'Heading', default: 'New Adventures' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: 'Just arrived and ready for playtime' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 4, max: 16 },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Button Text', default: 'Add' },
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
    { id: 'heading', type: 'text', label: 'Heading', default: 'Join the Fun Club!' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: 'Get exclusive deals, new arrival alerts, and birthday surprises for your little ones.' },
    { id: 'placeholder', type: 'text', label: 'Input Placeholder', default: 'parent@email.com' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: 'Subscribe' },
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
    fontFamily: 'Nunito, system-ui, sans-serif',
    headingFontFamily: 'Nunito, system-ui, sans-serif',
    baseFontSize: '16px',
    lineHeight: '1.6',
  },

  layout: {
    maxWidth: '1280px',
    headerStyle: 'standard',
    footerStyle: 'standard',
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: 'Free shipping on orders over $40! Plus free gift wrapping on every order.' },
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
        { id: 'age-1', type: 'age-group', settings: { label: '0–2', name: 'Babies & Toddlers', emoji: '🍼' } },
        { id: 'age-2', type: 'age-group', settings: { label: '3–5', name: 'Preschool', emoji: '🧸' } },
        { id: 'age-3', type: 'age-group', settings: { label: '6–8', name: 'Little Kids', emoji: '🚂' } },
        { id: 'age-4', type: 'age-group', settings: { label: '9–11', name: 'Big Kids', emoji: '🎮' } },
        { id: 'age-5', type: 'age-group', settings: { label: '12+', name: 'Tweens & Teens', emoji: '🎧' } },
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
