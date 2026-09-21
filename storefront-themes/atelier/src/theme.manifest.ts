import { defineTheme } from '@matjar/theme-shared/theme/defineTheme';
import { defineSection } from '@matjar/theme-shared/theme/defineSection';
import type { SectionDefinition, SectionSetting } from '@matjar/theme-shared/types/theme';

/**
 * ATELIER — polished, high-energy clean-beauty storefront.
 *
 * White page, near-black ink, bronze accent, warm-neutral surfaces. Optical
 * serif display over a geometric sans. Crisp linear micro-motion, a fade hero
 * with a synced progress bar, a marquee, count-up stats, a before/after
 * comparison, a hotspot lookbook, and a collection/product page whose
 * layouts are settings rather than separate templates.
 */

const U = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

// ─── Shared setting groups ────────────────────────────────────────

const spacing = (top = 30, bottom = 30): SectionSetting[] => [
  { id: 'padding_top', type: 'range', label: 'Padding Top', min: 0, max: 160, step: 10, default: top, unit: 'px' },
  { id: 'padding_bottom', type: 'range', label: 'Padding Bottom', min: 0, max: 160, step: 10, default: bottom, unit: 'px' },
  { id: 'background_color', type: 'color', label: 'Background', default: '#ffffff' },
];

const headingGroup = (opts: { eyebrow?: boolean; sub?: boolean; cta?: boolean } = {}): SectionSetting[] => [
  ...(opts.eyebrow ? [{ id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' } as SectionSetting] : []),
  { id: 'heading', type: 'text', label: 'Heading', default: '' },
  ...(opts.sub ? [{ id: 'subheading', type: 'textarea', label: 'Subheading', default: '' } as SectionSetting] : []),
  ...(opts.cta
    ? ([
        { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
        { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
      ] as SectionSetting[])
    : []),
];

const ICON_OPTIONS = [
  { label: 'Leaf', value: 'leaf' }, { label: 'Droplet', value: 'droplet' }, { label: 'Shield', value: 'shield' },
  { label: 'Heart', value: 'heart' }, { label: 'Sparkle', value: 'sparkle' }, { label: 'Truck', value: 'truck' },
  { label: 'Return', value: 'return' }, { label: 'Wallet', value: 'wallet' }, { label: 'Headset', value: 'headset' },
  { label: 'Check', value: 'check' }, { label: 'Sun', value: 'sun' }, { label: 'Flask', value: 'flask' },
];

const iconBlock = {
  type: 'item',
  name: 'Item',
  settings: [
    { id: 'icon', type: 'select', label: 'Icon', default: 'leaf', options: ICON_OPTIONS },
    { id: 'title', type: 'text', label: 'Title', default: '' },
    { id: 'text', type: 'textarea', label: 'Text', default: '' },
  ] as SectionSetting[],
};

// ─── Sections ─────────────────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'atelier-hero',
  name: 'Fade Slideshow',
  icon: 'Images',
  category: 'content',
  description: 'Full-bleed fading slideshow with a synced progress bar, slow zoom and staggered captions',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play', default: true },
    { id: 'autoplay_interval', type: 'range', label: 'Auto-play Interval', min: 3000, max: 9000, step: 500, default: 4000, unit: 'ms' },
    { id: 'pause_on_hover', type: 'checkbox', label: 'Pause on Hover', default: false },
    { id: 'show_arrows', type: 'checkbox', label: 'Show Arrows', default: true },
    { id: 'show_counter', type: 'checkbox', label: 'Show Slide Counter', default: true },
    { id: 'section_height', type: 'select', label: 'Section Height', default: 'tall', options: [
      { label: 'Medium (70vh)', value: 'medium' }, { label: 'Tall (90vh)', value: 'tall' }, { label: 'Full Screen', value: 'full' },
    ] },
    { id: 'overlay_opacity', type: 'range', label: 'Overlay Opacity', min: 0, max: 80, step: 5, default: 35, unit: '%' },
    { id: 'align', type: 'select', label: 'Text Alignment', default: 'start', options: [
      { label: 'Start', value: 'start' }, { label: 'Center', value: 'center' },
    ] },
  ],
  blocks: [
    {
      type: 'slide',
      name: 'Slide',
      limit: 6,
      settings: [
        { id: 'image', type: 'image', label: 'Image', default: '' },
        { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
        { id: 'heading', type: 'text', label: 'Heading', default: '' },
        { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
        { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'slide-1', type: 'slide', settings: { image: U('1601049541289-9b1b7bbbfe19'), eyebrow: 'Skin first', heading: 'Rituals that let your skin breathe', cta_text: 'Shop the edit', cta_url: '/products' } },
    { id: 'slide-2', type: 'slide', settings: { image: U('1596462502278-27bfdc403348'), eyebrow: 'New season', heading: 'Serums built around one active at a time', cta_text: 'Discover serums', cta_url: '/products' } },
    { id: 'slide-3', type: 'slide', settings: { image: U('1522335789203-aabd1fc54bc9'), eyebrow: 'Everyday glow', heading: 'A lighter routine for busy mornings', cta_text: 'Build your routine', cta_url: '/products' } },
  ],
});

export const marqueeSection: SectionDefinition = defineSection({
  type: 'atelier-marquee',
  name: 'Ticker',
  icon: 'Megaphone',
  category: 'marketing',
  description: 'Continuously scrolling strip of short messages',
  target: 'body',
  settings: [
    { id: 'speed', type: 'range', label: 'Scroll duration', min: 6, max: 30, step: 1, default: 10, unit: 's' },
    { id: 'uppercase_headings', type: 'checkbox', label: 'Uppercase', default: true },
    { id: 'text_color', type: 'color', label: 'Text Color', default: '#1c1c1c' },
    ...spacing(14, 14).map((s) => (s.id === 'background_color' ? { ...s, default: '#f5f1eb' } : s)),
  ],
  blocks: [{ type: 'message', name: 'Message', settings: [{ id: 'text', type: 'text', label: 'Text', default: '' }] }],
  defaultBlocks: [
    { id: 'm-1', type: 'message', settings: { text: 'Free delivery on orders over 500' } },
    { id: 'm-2', type: 'message', settings: { text: 'Dermatologist-tested formulas' } },
    { id: 'm-3', type: 'message', settings: { text: 'Cruelty-free, always' } },
    { id: 'm-4', type: 'message', settings: { text: 'New serums just landed' } },
  ],
});

export const iconRowSection: SectionDefinition = defineSection({
  type: 'atelier-icon-row',
  name: 'Icon Row',
  icon: 'Sparkles',
  category: 'content',
  description: 'Intro copy with a row of icon items',
  target: 'body',
  settings: [...headingGroup({ eyebrow: true, sub: true, cta: true }), ...spacing()],
  blocks: [{ ...iconBlock, limit: 6 }],
  defaultBlocks: [
    { id: 'i-1', type: 'item', settings: { icon: 'leaf', title: 'Gentle formulas', text: '' } },
    { id: 'i-2', type: 'item', settings: { icon: 'droplet', title: 'Clean ingredients', text: '' } },
    { id: 'i-3', type: 'item', settings: { icon: 'shield', title: 'Free from harm', text: '' } },
    { id: 'i-4', type: 'item', settings: { icon: 'heart', title: 'Cruelty-free care', text: '' } },
  ],
});

export const featureGridSection: SectionDefinition = defineSection({
  type: 'atelier-feature-grid',
  name: 'Feature Grid',
  icon: 'Grid3x3',
  category: 'content',
  description: 'Heading with a grid of icon, title and text cards',
  target: 'body',
  settings: [...headingGroup({ eyebrow: true }), ...spacing()],
  blocks: [{ ...iconBlock, limit: 8 }],
  defaultBlocks: [
    { id: 'f-1', type: 'item', settings: { icon: 'leaf', title: 'Natural care', text: 'Thoughtfully sourced ingredients that respect your skin.' } },
    { id: 'f-2', type: 'item', settings: { icon: 'flask', title: 'Lab-tested', text: 'Every batch checked for purity and performance.' } },
    { id: 'f-3', type: 'item', settings: { icon: 'shield', title: 'No harsh chemicals', text: 'Minimal formulas that skip the irritants.' } },
    { id: 'f-4', type: 'item', settings: { icon: 'sun', title: 'Made for daily use', text: 'Balanced textures for morning and night.' } },
  ],
});

export const imageBandSection: SectionDefinition = defineSection({
  type: 'atelier-image-band',
  name: 'Image Band',
  icon: 'Image',
  category: 'media',
  description: 'Decorative strip of images, no text',
  target: 'body',
  settings: [
    { id: 'columns', type: 'select', label: 'Columns', default: '6', options: [
      { label: '4 Columns', value: '4' }, { label: '5 Columns', value: '5' }, { label: '6 Columns', value: '6' },
    ] },
    ...spacing(0, 0),
  ],
  blocks: [{ type: 'image', name: 'Image', limit: 8, settings: [{ id: 'image', type: 'image', label: 'Image', default: '' }, { id: 'link', type: 'url', label: 'Link (optional)', default: '' }] }],
  defaultBlocks: [
    { id: 'b-1', type: 'image', settings: { image: U('1570172619644-dfd03ed5d881', 800) } },
    { id: 'b-2', type: 'image', settings: { image: U('1571781926291-c477ebfd024b', 800) } },
    { id: 'b-3', type: 'image', settings: { image: U('1612817288484-6f916006741a', 800) } },
    { id: 'b-4', type: 'image', settings: { image: U('1598440947619-2c35fc9aa908', 800) } },
    { id: 'b-5', type: 'image', settings: { image: U('1608248543803-ba4f8c70ae0b', 800) } },
    { id: 'b-6', type: 'image', settings: { image: U('1620916566398-39f1143ab7be', 800) } },
  ],
});

export const categoryTilesSection: SectionDefinition = defineSection({
  type: 'atelier-category-tiles',
  name: 'Category Tiles',
  icon: 'FolderTree',
  category: 'commerce',
  description: 'Grid of category image tiles with a slow zoom on hover',
  target: 'body',
  settings: [
    ...headingGroup({ eyebrow: true }),
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 6, min: 2, max: 12 },
    { id: 'show_product_count', type: 'checkbox', label: 'Show Product Count', default: true },
    ...spacing(),
  ],
});

export const productGridSection: SectionDefinition = defineSection({
  type: 'atelier-product-grid',
  name: 'Product Grid',
  icon: 'PackageSearch',
  category: 'commerce',
  description: 'Grid of products from a chosen source',
  target: 'body',
  settings: [
    ...headingGroup({ eyebrow: true, sub: true }),
    { id: 'product_source', type: 'select', label: 'Spotlight Source', default: 'newest', options: [
      { label: 'Newest', value: 'newest' }, { label: 'Featured', value: 'featured' }, { label: 'On sale', value: 'sale' }, { label: 'Popular', value: 'popular' },
    ] },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 4, max: 16 },
    { id: 'columns', type: 'select', label: 'Columns', default: '4', options: [{ label: '3 Columns', value: '3' }, { label: '4 Columns', value: '4' }] },
    { id: 'show_view_all', type: 'checkbox', label: 'Show "View All" Link', default: true },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
    ...spacing(),
  ],
});

export const splitBannerSection: SectionDefinition = defineSection({
  type: 'atelier-split-banner',
  name: 'Split Banner',
  icon: 'PanelLeft',
  category: 'content',
  description: 'Image beside a block of text with a call to action',
  target: 'body',
  settings: [
    { id: 'image', type: 'image', label: 'Image', default: U('1616394584738-fc6e612e71b9') },
    { id: 'layout', type: 'select', label: 'Layout', default: 'image_start', options: [{ label: 'Image Left', value: 'image_start' }, { label: 'Image Right', value: 'image_end' }] },
    ...headingGroup({ eyebrow: true, sub: true, cta: true }),
    ...spacing(),
  ],
});

export const videoBlockSection: SectionDefinition = defineSection({
  type: 'atelier-video-block',
  name: 'Video Block',
  icon: 'Video',
  category: 'media',
  description: 'Poster with a play button that opens the video inline',
  target: 'body',
  settings: [
    { id: 'image', type: 'image', label: 'Image', default: U('1512496015851-a90fb38ba796') },
    { id: 'video_url', type: 'url', label: 'Video URL', default: '' },
    { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
    { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
    ...spacing(),
  ],
});

export const dealsBannerSection: SectionDefinition = defineSection({
  type: 'atelier-deals-banner',
  name: 'Promo Banner',
  icon: 'Tag',
  category: 'marketing',
  description: 'Static full-width promotional banner',
  target: 'body',
  settings: [
    { id: 'background_image', type: 'image', label: 'Background Image', default: U('1526947425960-945c6e72858f') },
    { id: 'overlay_opacity', type: 'range', label: 'Overlay Opacity', min: 0, max: 80, step: 5, default: 30, unit: '%' },
    ...headingGroup({ eyebrow: true, sub: true, cta: true }),
    { id: 'min_height', type: 'range', label: 'Minimum Height (px)', min: 240, max: 720, step: 20, default: 420, unit: 'px' },
    ...spacing(),
  ],
});

export const statsSection: SectionDefinition = defineSection({
  type: 'atelier-stats',
  name: 'Counter Stats',
  icon: 'Zap',
  category: 'content',
  description: 'Numbers that count up when scrolled into view',
  target: 'body',
  settings: [...headingGroup({ eyebrow: true, sub: true, cta: true }), ...spacing(40, 40).map((s) => (s.id === 'background_color' ? { ...s, default: '#f5f1eb' } : s))],
  blocks: [{ type: 'stat', name: 'Stat', limit: 6, settings: [
    { id: 'value', type: 'text', label: 'Number', default: '0' },
    { id: 'suffix', type: 'text', label: 'Suffix', default: '' },
    { id: 'label', type: 'text', label: 'Label text', default: '' },
  ] }],
  defaultBlocks: [
    { id: 's-1', type: 'stat', settings: { value: '12', suffix: '+', label: 'Years of formulating' } },
    { id: 's-2', type: 'stat', settings: { value: '38000', suffix: '+', label: 'Orders delivered' } },
    { id: 's-3', type: 'stat', settings: { value: '98.6', suffix: '%', label: 'Would buy again' } },
    { id: 's-4', type: 'stat', settings: { value: '27', suffix: 'K', label: 'Community members' } },
    { id: 's-5', type: 'stat', settings: { value: '0.4', suffix: '%', label: 'Return rate' } },
  ],
});

export const lookbookSection: SectionDefinition = defineSection({
  type: 'atelier-lookbook',
  name: 'Shoppable Lookbook',
  icon: 'Layers',
  category: 'commerce',
  description: 'An image with product hotspots and an add-all button',
  target: 'body',
  settings: [
    ...headingGroup({ eyebrow: true, sub: true }),
    { id: 'image', type: 'image', label: 'Image', default: 'https://images.unsplash.com/photo-1522337094846-8a818192de1f?w=1600&h=1000&q=80&auto=format&fit=crop' },
    { id: 'show_add_all', type: 'checkbox', label: 'Show "Add all to cart"', default: true },
    ...spacing(),
  ],
  blocks: [{ type: 'hotspot', name: 'Hotspot', limit: 6, settings: [
    { id: 'x', type: 'range', label: 'Horizontal position', min: 2, max: 98, step: 1, default: 50, unit: '%' },
    { id: 'y', type: 'range', label: 'Vertical position', min: 2, max: 98, step: 1, default: 50, unit: '%' },
    { id: 'product', type: 'product', label: 'Product', default: '' },
  ] }],
  defaultBlocks: [
    { id: 'h-1', type: 'hotspot', settings: { x: 32, y: 44, product: '' } },
    { id: 'h-2', type: 'hotspot', settings: { x: 64, y: 58, product: '' } },
    { id: 'h-3', type: 'hotspot', settings: { x: 50, y: 78, product: '' } },
  ],
});

export const uspStripSection: SectionDefinition = defineSection({
  type: 'atelier-usp-strip',
  name: 'USP Strip',
  icon: 'ShieldCheck',
  category: 'marketing',
  description: 'Four icon promises in a strip',
  target: 'body',
  settings: [...spacing(30, 30).map((s) => (s.id === 'background_color' ? { ...s, default: '#f5f1eb' } : s))],
  blocks: [{ ...iconBlock, limit: 4 }],
  defaultBlocks: [
    { id: 'u-1', type: 'item', settings: { icon: 'truck', title: 'Free delivery', text: 'On every order over 500.' } },
    { id: 'u-2', type: 'item', settings: { icon: 'return', title: 'Easy returns', text: '30 days to change your mind.' } },
    { id: 'u-3', type: 'item', settings: { icon: 'wallet', title: 'Pay your way', text: 'Cash on delivery and transfers.' } },
    { id: 'u-4', type: 'item', settings: { icon: 'headset', title: 'Here to help', text: 'Real people, seven days a week.' } },
  ],
});

export const testimonialsSection: SectionDefinition = defineSection({
  type: 'atelier-testimonials',
  name: 'Testimonials',
  icon: 'Quote',
  category: 'content',
  description: 'Customer quotes in a scroll-snap carousel',
  target: 'body',
  settings: [...headingGroup({ eyebrow: true, sub: true }), ...spacing()],
  blocks: [{ type: 'quote', name: 'Quote', limit: 10, settings: [
    { id: 'quote', type: 'textarea', label: 'Quote', default: '' },
    { id: 'name', type: 'text', label: 'Name', default: '' },
    { id: 'role', type: 'text', label: 'Role / Location', default: '' },
  ] }],
  defaultBlocks: [
    { id: 'q-1', type: 'quote', settings: { quote: 'The night cream is the first product that stopped my winter dryness without feeling heavy in the morning.', name: 'Rania A.', role: 'Khartoum' } },
    { id: 'q-2', type: 'quote', settings: { quote: 'I ordered on a Tuesday and it was at my door on Thursday. The serum smells clean and sinks in fast.', name: 'Mohamed K.', role: 'Omdurman' } },
    { id: 'q-3', type: 'quote', settings: { quote: 'Finally a sunscreen that does not leave a cast. It has replaced three products in my bag.', name: 'Sara E.', role: 'Port Sudan' } },
    { id: 'q-4', type: 'quote', settings: { quote: 'The lip tint lasts through coffee and lunch. I bought two more for my sisters.', name: 'Huda M.', role: 'Kassala' } },
  ],
});

export const beforeAfterSection: SectionDefinition = defineSection({
  type: 'atelier-before-after',
  name: 'Before / After',
  icon: 'Sparkles',
  category: 'media',
  description: 'Drag comparison between two images',
  target: 'body',
  settings: [
    ...headingGroup({ eyebrow: true, cta: true }),
    { id: 'image_1', type: 'image', label: 'First Image', default: U('1594125311687-3b1b3eafa9f4', 1200) },
    { id: 'image_2', type: 'image', label: 'Second Image', default: U('1616683693504-3ea7e9ad6fec', 1200) },
    { id: 'label_1', type: 'text', label: 'First Label', default: '' },
    { id: 'label_2', type: 'text', label: 'Second Label', default: '' },
    ...spacing(),
  ],
});

export const storiesSection: SectionDefinition = defineSection({
  type: 'atelier-stories',
  name: 'Stories',
  icon: 'Newspaper',
  category: 'content',
  description: 'Carousel of editorial cards',
  target: 'body',
  settings: [...headingGroup({ eyebrow: true }), ...spacing()],
  blocks: [{ type: 'post', name: 'Post', limit: 8, settings: [
    { id: 'image', type: 'image', label: 'Image', default: '' },
    { id: 'date', type: 'text', label: 'Date', default: '' },
    { id: 'title', type: 'text', label: 'Title', default: '' },
    { id: 'excerpt', type: 'textarea', label: 'Excerpt', default: '' },
    { id: 'link_url', type: 'url', label: 'Link URL', default: '' },
  ] }],
  defaultBlocks: [
    { id: 'p-1', type: 'post', settings: { image: U('1515377905703-c4788e51af15', 900), date: '', title: 'Layering actives without the sting', excerpt: 'A simple order of operations for retinoids, acids and vitamin C.', link_url: '/pages/about' } },
    { id: 'p-2', type: 'post', settings: { image: U('1513883049090-d0b7439799bf', 900), date: '', title: 'What "fragrance-free" really promises', excerpt: 'Reading a label like a formulator, in three minutes.', link_url: '/pages/about' } },
    { id: 'p-3', type: 'post', settings: { image: U('1560750588-73207b1ef5b8', 900), date: '', title: 'The five-minute morning routine', excerpt: 'Cleanse, protect, go. Everything else is optional.', link_url: '/pages/about' } },
  ],
});

// ─── Template helpers ─────────────────────────────────────────────

const ALL_SECTIONS: SectionDefinition[] = [
  heroSection, marqueeSection, iconRowSection, featureGridSection, imageBandSection, categoryTilesSection,
  productGridSection, splitBannerSection, videoBlockSection, dealsBannerSection, statsSection, lookbookSection,
  uspStripSection, testimonialsSection, beforeAfterSection, storiesSection,
];

/**
 * Theme install seeds a store's sections from these template entries and
 * copies `blocks` verbatim (an absent array becomes `[]`, which then wins over
 * the definition's defaultBlocks at render time). Attach the defaults here so
 * a fresh install renders the curated homepage.
 */
function withDefaultBlocks<T extends { type: string; blocks?: any[] }>(entries: T[]): T[] {
  return entries.map((e) => {
    const def = ALL_SECTIONS.find((d) => d.type === e.type);
    return e.blocks || !def?.defaultBlocks ? e : { ...e, blocks: JSON.parse(JSON.stringify(def.defaultBlocks)) };
  });
}

// ─── Global settings ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'atelier',
  name: 'Atelier',
  version: '1.0.0',
  previewImage: '/preview.jpg',
  description: 'A polished, high-energy clean-beauty theme: optical serif headlines, bronze accents, a fading hero with synced progress, count-up stats, a shoppable lookbook and configurable collection and product layouts.',
  author: { name: 'Matjar', website: 'https://matjar.to' },
  categories: ['beauty', 'cosmetics', 'skincare', 'general'],

  colors: {
    primary: '#1c1c1c',
    secondary: '#b6713e',
    accent: '#f5f1eb',
    background: '#ffffff',
    foreground: '#1c1c1c',
    muted: '#6b6b6b',
    border: '#e5e5e5',
    error: '#c81e1e',
    success: '#2e8b57',
  },

  typography: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    headingFontFamily: "'Fraunces', Georgia, serif",
    baseFontSize: '16px',
    lineHeight: '1.6',
  },

  fonts: [
    { label: 'DM Sans', value: "'DM Sans', system-ui, sans-serif" },
    { label: 'Fraunces', value: "'Fraunces', Georgia, serif" },
    { label: 'Tajawal', value: "'Tajawal', sans-serif" },
    { label: 'Amiri', value: "'Amiri', serif" },
  ],

  layout: {
    maxWidth: '1320px',
    headerStyle: 'standard',
    footerStyle: 'standard',
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    { id: 'announcement_text', type: 'textarea', label: 'Announcement messages (one per line)', default: 'Free delivery on orders over 500\nNew serums just landed\nCruelty-free, always' },
    { id: 'autoplay_interval', type: 'range', label: 'Announcement rotation', min: 2000, max: 10000, step: 500, default: 4000, unit: 'ms' },
    { id: 'free_shipping_threshold', type: 'number', label: 'Free shipping threshold', default: 500, min: 0, max: 100000 },
    { id: 'show_top_strip', type: 'checkbox', label: 'Show Top Strip', default: true },
    { id: 'header_transparent_home', type: 'checkbox', label: 'Transparent header on home', default: true },
    { id: 'sticky_header', type: 'checkbox', label: 'Sticky header (reveals on scroll up)', default: true },
    { id: 'show_search_popular', type: 'checkbox', label: 'Show popular searches', default: true },
    { id: 'popular_searches', type: 'text', label: 'Popular searches (comma separated)', default: 'Serum, Cleanser, Sunscreen, Moisturizer, Lip tint' },
    { id: 'search_image', type: 'image', label: 'Search panel image', default: U('1556228720-195a672e8a03', 1000) },
    { id: 'mega_menu_products', type: 'checkbox', label: 'Show products in mega menu', default: true },
    { id: 'mega_menu_product_limit', type: 'number', label: 'Mega menu products', default: 4, min: 2, max: 8 },
    { id: 'collection_banner_image', type: 'image', label: 'Collection banner image', default: U('1631730359585-38a4935cbec4', 1800) },
    { id: 'collection_show_categories', type: 'checkbox', label: 'Show category carousel on collections', default: true },
    { id: 'filter_placement', type: 'select', label: 'Collection filters', default: 'start', options: [
      { label: 'Sidebar (start)', value: 'start' }, { label: 'Sidebar (end)', value: 'end' }, { label: 'Bar above grid', value: 'top' },
      { label: 'Drawer from start', value: 'drawer-start' }, { label: 'Drawer from top', value: 'drawer-top' }, { label: 'Drawer from bottom', value: 'drawer-bottom' },
    ] },
    { id: 'pagination', type: 'select', label: 'Collection pagination', default: 'load-more', options: [{ label: 'Load more button', value: 'load-more' }, { label: 'Numbered pages', value: 'numbered' }] },
    { id: 'default_columns', type: 'select', label: 'Collection columns', default: '4', options: [{ label: '3 Columns', value: '3' }, { label: '4 Columns', value: '4' }] },
    { id: 'products_per_page', type: 'number', label: 'Products per page', default: 12, min: 6, max: 48 },
    { id: 'gallery_layout', type: 'select', label: 'Product gallery layout', default: 'thumbs-below', options: [
      { label: 'Thumbnails below', value: 'thumbs-below' }, { label: 'Thumbnails at start', value: 'thumbs-start' }, { label: 'Thumbnails at end', value: 'thumbs-end' },
      { label: 'Thumbnail grid', value: 'thumb-grid' }, { label: 'Image grid', value: 'image-grid' }, { label: 'Image scroll (sticky info)', value: 'image-scroll' },
      { label: 'Slider with arrows', value: 'slider-arrows' }, { label: 'Slider with dots', value: 'slider-dots' },
    ] },
    { id: 'variant_picker_style', type: 'select', label: 'Variant picker style', default: 'buttons', options: [
      { label: 'Buttons', value: 'buttons' }, { label: 'Dropdown', value: 'dropdown' }, { label: 'Image swatches', value: 'image-swatch' }, { label: 'Colour swatches', value: 'color-swatch' },
    ] },
    { id: 'product_info_style', type: 'select', label: 'Product tabs style', default: 'tabs', options: [{ label: 'Tabs', value: 'tabs' }, { label: 'Accordion', value: 'accordion' }] },
    { id: 'show_sticky_add_to_cart', type: 'checkbox', label: 'Sticky add-to-cart bar (desktop)', default: true },
    { id: 'show_countdown', type: 'checkbox', label: 'Show flash-sale countdown on sale products', default: false },
    { id: 'countdown_end', type: 'text', label: 'Flash sale ends (YYYY-MM-DD)', default: '' },
    { id: 'countdown_repeat_daily', type: 'checkbox', label: 'Repeat countdown daily', default: false },
    { id: 'show_inventory_bar', type: 'checkbox', label: 'Show inventory bar', default: false },
    { id: 'inventory_start', type: 'number', label: 'Starting stock for the inventory bar', default: 50, min: 1, max: 100000 },
    { id: 'benefit_1', type: 'text', label: 'Benefit 1', default: 'Free delivery over 500' },
    { id: 'benefit_2', type: 'text', label: 'Benefit 2', default: 'Easy 30-day returns' },
    { id: 'benefit_3', type: 'text', label: 'Benefit 3', default: 'Help seven days a week' },
    { id: 'shipping_note', type: 'text', label: 'Shipping note', default: 'Orders ship within 2 to 5 business days.' },
    { id: 'hotline_label', type: 'text', label: 'Hotline Label', default: '' },
    { id: 'hotline_phone', type: 'text', label: 'Hotline Phone', default: '' },
  ],

  sections: ALL_SECTIONS,

  templates: {
    index: withDefaultBlocks([
      { id: 'hero', type: 'atelier-hero', settings: {} },
      { id: 'marquee', type: 'atelier-marquee', settings: {} },
      { id: 'about', type: 'atelier-icon-row', settings: { eyebrow: 'About us', heading: 'Skin care that treats your skin, and the planet, gently', subheading: 'Small batches, transparent ingredient lists and packaging we can stand behind.', cta_text: 'Our story', cta_url: '/pages/about' } },
      { id: 'why', type: 'atelier-feature-grid', settings: { eyebrow: 'Trusted formulas', heading: 'Why people switch to us' } },
      { id: 'band', type: 'atelier-image-band', settings: {} },
      { id: 'categories', type: 'atelier-category-tiles', settings: { eyebrow: 'Browse', heading: 'Shop by category' } },
      { id: 'new-arrivals', type: 'atelier-product-grid', settings: { eyebrow: 'New arrivals', heading: 'Chosen for quality, performance and everyday use', product_source: 'newest', product_limit: 8 } },
      { id: 'split', type: 'atelier-split-banner', settings: { eyebrow: 'Thoughtful care', heading: 'Where careful formulation meets modern beauty', subheading: 'We test every texture on real skin across a full season before it earns a place on the shelf.', cta_text: 'Shop now', cta_url: '/products' } },
      { id: 'video', type: 'atelier-video-block', settings: { eyebrow: 'Behind the label', heading: 'See how a serum is made', cta_text: 'Explore more', cta_url: '/products' } },
      { id: 'deals', type: 'atelier-deals-banner', settings: { eyebrow: 'This week', heading: 'Weekly deals worth the detour', subheading: 'Rotating offers on the essentials, refreshed every Monday.', cta_text: 'Shop deals', cta_url: '/products?sort=popular' } },
      { id: 'stats', type: 'atelier-stats', settings: { eyebrow: 'Clean beauty essentials', heading: 'A short list of things we measure', subheading: 'The numbers behind a routine people keep coming back to.', cta_text: 'Shop now', cta_url: '/products' } },
      { id: 'sale', type: 'atelier-product-grid', settings: { eyebrow: 'Offers', heading: 'On sale this week', subheading: 'Limited-time prices on selected essentials.', product_source: 'sale', product_limit: 8 } },
      { id: 'kind', type: 'atelier-icon-row', settings: { eyebrow: 'Naturally kind', heading: 'Skin care made for everyone' } },
      { id: 'lookbook', type: 'atelier-lookbook', settings: { eyebrow: 'Get the look', heading: 'How we style a morning shelf' } },
      { id: 'usp', type: 'atelier-usp-strip', settings: {} },
      { id: 'testimonials', type: 'atelier-testimonials', settings: { eyebrow: 'What customers say', heading: 'Real feedback from real routines' } },
      { id: 'before-after', type: 'atelier-before-after', settings: { eyebrow: 'Clearly better', heading: 'See the difference for yourself', cta_text: 'Explore now', cta_url: '/products' } },
      { id: 'stories', type: 'atelier-stories', settings: { eyebrow: 'Latest stories', heading: 'Notes from the lab' } },
    ]),
    product: [
      { id: 'product-details', type: 'product-details', settings: {} },
      { id: 'product-policies', type: 'product-policies', settings: {} },
    ],
    collection: [],
    cart: [],
    search: [],
    page: [],
  },
});

export default manifest;
