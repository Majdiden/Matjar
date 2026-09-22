import { defineTheme } from '@matjar/theme-shared/theme/defineTheme';
import { defineSection } from '@matjar/theme-shared/theme/defineSection';
import type { SectionDefinition } from '@matjar/theme-shared/types/theme';

/**
 * LINEN — calm, warm, editorial skincare.
 *
 * Cream ground, sand surfaces, bronze accent, black ink. Square corners
 * everywhere except pill badges. Large airy body type (Nunito Sans) under
 * light geometric headings (Urbanist). Motion: 100 / 300 / 500ms, a 1.2s
 * entrance reveal, a 30s announcement marquee.
 */

// Royalty-free Unsplash photography (skincare / self-care), each checked live.
const U = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const pad = (top = 64, bottom = 64) => [
  { id: 'padding_top', type: 'range' as const, label: 'Padding Top', min: 0, max: 160, step: 8, default: top, unit: 'px' },
  { id: 'padding_bottom', type: 'range' as const, label: 'Padding Bottom', min: 0, max: 160, step: 8, default: bottom, unit: 'px' },
];

// ─── Sections ────────────────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'linen-hero',
  name: 'Slideshow Hero',
  icon: 'Images',
  category: 'content',
  description: 'Image-beside-text slideshow with crossfade, progress bar and replaying captions',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play Carousel', default: true },
    { id: 'autoplay_interval', type: 'range', label: 'Auto-play Interval', min: 3000, max: 9000, step: 500, default: 5000, unit: 'ms' },
    { id: 'pause_on_hover', type: 'checkbox', label: 'Pause on Hover', default: false },
    { id: 'show_dots', type: 'checkbox', label: 'Show Dots', default: true },
    { id: 'show_arrows', type: 'checkbox', label: 'Show Arrows', default: true },
  ],
  blocks: [
    {
      type: 'slide',
      name: 'Banner Slide',
      settings: [
        { id: 'image', type: 'image', label: 'Image', default: '' },
        { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
        { id: 'heading', type: 'text', label: 'Heading', default: '' },
        { id: 'body', type: 'textarea', label: 'Body', default: '' },
        { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
        { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
      ],
    },
  ],
  defaultBlocks: [
    // Copy is intentionally empty: the section falls back to the theme's own
    // translations (theme.section.hero.<block id>.*) so a fresh install reads
    // in the shopper's language. Merchant-entered text always wins.
    { id: 'slide-1', type: 'slide', settings: { image: U('1556228720-195a672e8a03'), cta_url: '/products' } },
    { id: 'slide-2', type: 'slide', settings: { image: U('1570554886111-e80fcca6a029'), cta_url: '/products?sort=newest' } },
    { id: 'slide-3', type: 'slide', settings: { image: U('1608248543803-ba4f8c70ae0b'), cta_url: '/about' } },
  ],
});

export const supportStripSection: SectionDefinition = defineSection({
  type: 'linen-support-strip',
  name: 'Support Strip',
  icon: 'ShieldCheck',
  category: 'marketing',
  description: 'Four icon promises on a sand band with hairline dividers',
  target: 'body',
  limit: 1,
  settings: [...pad(0, 0)],
  blocks: [
    {
      type: 'trust-item',
      name: 'Trust Item',
      settings: [
        { id: 'icon', type: 'select', label: 'Icon (emoji or letter)', default: 'truck', options: [
          { label: 'Truck', value: 'truck' }, { label: 'Headset', value: 'headset' }, { label: 'Return', value: 'return' }, { label: 'Leaf', value: 'leaf' }, { label: 'Shield', value: 'shield' }, { label: 'Heart', value: 'heart' },
        ] },
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'text', type: 'text', label: 'Text', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'ti-1', type: 'trust-item', settings: { icon: 'truck' } },
    { id: 'ti-2', type: 'trust-item', settings: { icon: 'headset' } },
    { id: 'ti-3', type: 'trust-item', settings: { icon: 'return' } },
    { id: 'ti-4', type: 'trust-item', settings: { icon: 'leaf' } },
  ],
});

export const productGridSection: SectionDefinition = defineSection({
  type: 'linen-product-grid',
  name: 'Product Grid',
  icon: 'Grid3x3',
  category: 'commerce',
  description: 'Eyebrow, heading and a four-up grid of products with a hover add-to-cart bar',
  target: 'body',
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'product_source', type: 'select', label: 'Spotlight Source', default: 'featured', options: [
      { label: 'Featured products', value: 'featured' }, { label: 'Newest arrivals', value: 'newest' }, { label: 'Popular', value: 'popular' },
    ] },
    { id: 'product_limit', type: 'range', label: 'Number of Products', min: 4, max: 12, step: 4, default: 4 },
    { id: 'view_all_text', type: 'text', label: 'View All Button Text', default: '' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'show_badge', type: 'checkbox', label: 'Show Sale / New Badge', default: true },
    { id: 'new_days', type: 'range', label: 'Days a product counts as new', min: 7, max: 90, step: 1, default: 30 },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
    ...pad(),
  ],
});

export const promoBannerSection: SectionDefinition = defineSection({
  type: 'linen-promo-banner',
  name: 'Promo Banner',
  icon: 'Megaphone',
  category: 'marketing',
  description: 'Full-bleed image with a centred cream card',
  target: 'body',
  settings: [
    { id: 'image', type: 'image', label: 'Image', default: U('1571781926291-c477ebfd024b', 2000) },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'body', type: 'textarea', label: 'Body', default: '' },
    { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
    { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
    { id: 'min_height', type: 'range', label: 'Minimum Height (px)', min: 360, max: 720, step: 20, default: 520, unit: 'px' },
    ...pad(0, 0),
  ],
});

export const categoryMasonrySection: SectionDefinition = defineSection({
  type: 'linen-category-masonry',
  name: 'Category Masonry',
  icon: 'LayoutTemplate',
  category: 'commerce',
  description: 'One tall category tile beside four smaller ones, from your real categories',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
    { id: 'tall_image', type: 'image', label: 'Fallback Image 3', default: U('1596462502278-27bfdc403348', 1200) },
    ...pad(),
  ],
});

export const editorialSplitSection: SectionDefinition = defineSection({
  type: 'linen-editorial-split',
  name: 'Editorial Split',
  icon: 'PanelLeft',
  category: 'content',
  description: 'Image beside a short story with an eyebrow, heading and call to action',
  target: 'body',
  settings: [
    { id: 'image', type: 'image', label: 'Image', default: U('1612817288484-6f916006741a', 1400) },
    { id: 'layout', type: 'select', label: 'Layout', default: 'image-left', options: [{ label: 'Image Left', value: 'image-left' }, { label: 'Image Right', value: 'image-right' }] },
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'body', type: 'textarea', label: 'Body', default: '' },
    { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
    { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
    ...pad(),
  ],
});

export const testimonialsSection: SectionDefinition = defineSection({
  type: 'linen-testimonials',
  name: 'Testimonials',
  icon: 'Quote',
  category: 'marketing',
  description: 'Four quotes with a bronze quote mark and a staggered reveal',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    ...pad(),
  ],
  blocks: [
    {
      type: 'testimonial',
      name: 'Testimonial',
      settings: [
        { id: 'quote', type: 'textarea', label: 'Quote', default: '' },
        { id: 'name', type: 'text', label: 'Name', default: '' },
        { id: 'role', type: 'text', label: 'Role / Location', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'tm-1', type: 'testimonial', settings: {} },
    { id: 'tm-2', type: 'testimonial', settings: {} },
    { id: 'tm-3', type: 'testimonial', settings: {} },
    { id: 'tm-4', type: 'testimonial', settings: {} },
  ],
});

export const storiesSection: SectionDefinition = defineSection({
  type: 'linen-stories',
  name: 'Stories',
  icon: 'Newspaper',
  category: 'content',
  description: 'Three story cards with a date chip, title, excerpt and link',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    ...pad(),
  ],
  blocks: [
    {
      type: 'post',
      name: 'Post',
      settings: [
        { id: 'image', type: 'image', label: 'Image', default: '' },
        { id: 'date', type: 'text', label: 'Date', default: '' },
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'excerpt', type: 'textarea', label: 'Excerpt', default: '' },
        { id: 'link_url', type: 'url', label: 'Link URL', default: '/' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'st-1', type: 'post', settings: { image: U('1552693673-1bf958298935', 1200), link_url: '/about' } },
    { id: 'st-2', type: 'post', settings: { image: U('1601049541289-9b1b7bbbfe19', 1200), link_url: '/about' } },
    { id: 'st-3', type: 'post', settings: { image: U('1598440947619-2c35fc9aa908', 1200), link_url: '/about' } },
  ],
});

export const instagramSection: SectionDefinition = defineSection({
  type: 'linen-instagram',
  name: 'Instagram Row',
  icon: 'Instagram',
  category: 'marketing',
  description: 'Six square images with a hover overlay linking to your feed',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'handle', type: 'text', label: 'Handle button text', default: '' },
    { id: 'handle_url', type: 'url', label: 'Handle URL', default: 'https://instagram.com' },
    ...pad(64, 0),
  ],
  blocks: [
    { type: 'image', name: 'Image', settings: [
      { id: 'image', type: 'image', label: 'Image', default: '' },
      { id: 'link', type: 'url', label: 'Link (optional)', default: '' },
    ] },
  ],
  defaultBlocks: [
    { id: 'ig-1', type: 'image', settings: { image: U('1620916566398-39f1143ab7be', 800) } },
    { id: 'ig-2', type: 'image', settings: { image: U('1556229010-6c3f2c9ca5f8', 800) } },
    { id: 'ig-3', type: 'image', settings: { image: U('1522335789203-aabd1fc54bc9', 800) } },
    { id: 'ig-4', type: 'image', settings: { image: U('1519415943484-9fa1873496d4', 800) } },
    { id: 'ig-5', type: 'image', settings: { image: U('1611930022073-b7a4ba5fcccd', 800) } },
    { id: 'ig-6', type: 'image', settings: { image: U('1598452963314-b09f397a5c48', 800) } },
  ],
});

// ─── Theme ──────────────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'linen',
  name: 'Linen',
  version: '1.0.0',
  previewImage: '/preview.jpg',
  description: 'Calm, warm and editorial. Cream and sand surfaces with a bronze accent, large airy type, square corners and a slideshow hero. Built for skincare, cosmetics and self-care brands.',
  author: { name: 'Matjar', website: 'https://matjar.to' },
  categories: ['beauty', 'cosmetics', 'wellness', 'general'],

  colors: {
    primary: '#8f5426',
    secondary: '#0f0f0f',
    accent: '#ecdec1',
    background: '#fcf7ee',
    foreground: '#0f0f0f',
    muted: '#5f5a52',
    border: '#e6dccb',
    error: '#b3352b',
    success: '#2f6b4f',
  },

  typography: {
    fontFamily: "'Nunito Sans', 'Tajawal', system-ui, sans-serif",
    headingFontFamily: "Urbanist, 'Tajawal', system-ui, sans-serif",
    baseFontSize: '17px',
    lineHeight: '1.7',
  },

  fonts: [
    { label: 'Nunito Sans', value: "'Nunito Sans', 'Tajawal', system-ui, sans-serif" },
    { label: 'Urbanist', value: "Urbanist, 'Tajawal', system-ui, sans-serif" },
    { label: 'Tajawal', value: "'Tajawal', sans-serif" },
  ],

  layout: {
    maxWidth: '1280px',
    headerStyle: 'centered',
    footerStyle: 'columns',
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
    { id: 'announcement_text_2', type: 'text', label: 'Announcement Text 2', default: '' },
    { id: 'announcement_text_3', type: 'text', label: 'Announcement Text 3', default: '' },
    { id: 'free_shipping_threshold', type: 'number', label: 'Free shipping threshold', default: 300, min: 0, max: 100000 },
    { id: 'popular_searches', type: 'text', label: 'Popular searches (comma separated)', default: '' },
    { id: 'mega_image', type: 'image', label: 'Mega Menu Image', default: U('1616394584738-fc6e612e71b9', 900) },
    { id: 'mega_eyebrow', type: 'text', label: 'Mega Menu Eyebrow', default: '' },
    { id: 'mega_title', type: 'text', label: 'Mega Menu Title', default: '' },
    { id: 'mega_cta_text', type: 'text', label: 'Mega Menu CTA Text', default: '' },
    { id: 'mega_cta_url', type: 'url', label: 'Mega Menu CTA URL', default: '/products' },
    { id: 'plp_banner_image', type: 'image', label: 'Collection Banner Image', default: U('1556228453-efd6c1ff04f6', 2000) },
    { id: 'pdp_banner_image', type: 'image', label: 'Product Banner Image', default: U('1556228578-8c89e6adf883', 2000) },
    { id: 'footer_about', type: 'textarea', label: 'Footer About Text', default: '' },
    { id: 'opening_hours', type: 'text', label: 'Opening hours', default: '' },
  ],

  sections: [
    heroSection,
    supportStripSection,
    productGridSection,
    promoBannerSection,
    categoryMasonrySection,
    editorialSplitSection,
    testimonialsSection,
    storiesSection,
    instagramSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'linen-hero', settings: {}, blocks: heroSection.defaultBlocks },
      { id: 'support', type: 'linen-support-strip', settings: {}, blocks: supportStripSection.defaultBlocks },
      { id: 'grid-1', type: 'linen-product-grid', settings: { product_source: 'featured' } },
      { id: 'promo', type: 'linen-promo-banner', settings: {} },
      { id: 'masonry', type: 'linen-category-masonry', settings: {} },
      { id: 'grid-2', type: 'linen-product-grid', settings: { product_source: 'newest', view_all_url: '/products?sort=newest' } },
      { id: 'editorial', type: 'linen-editorial-split', settings: {} },
      { id: 'testimonials', type: 'linen-testimonials', settings: {}, blocks: testimonialsSection.defaultBlocks },
      { id: 'stories', type: 'linen-stories', settings: {}, blocks: storiesSection.defaultBlocks },
      { id: 'instagram', type: 'linen-instagram', settings: {}, blocks: instagramSection.defaultBlocks },
    ],
    product: [
      // Description, merchant content blocks and the shipping policy already
      // render as accordions in the info column; only specifications remain here.
      { id: 'product-details', type: 'product-details', settings: { show_description: false, show_specs: true, show_content_sections: false, specs_heading: '' } },
    ],
    collection: [],
    cart: [],
    search: [],
    page: [],
  },
});

export default manifest;
