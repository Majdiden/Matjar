import { defineTheme } from '@matjar/theme-shared/theme/defineTheme';
import { defineSection } from '@matjar/theme-shared/theme/defineSection';
import type { SectionDefinition, SectionSetting } from '@matjar/theme-shared/types/theme';

/**
 * MISK (مسك) — an Arabic-first fragrance storefront.
 *
 * Warm near-black ink on white, musk gold accents, a midnight hero band and a
 * grove-green concept band. Amiri (naskh) display over Tajawal body — the
 * Arabic pair is primary and the Latin pair (Cormorant Garamond + Jost) is the
 * fallback branch, not the other way round.
 *
 * EVERY display string below defaults to '' on purpose. A non-empty default is
 * persisted as a real setting value at install time and then permanently wins
 * over i18n, which is exactly how Linen and Atelier shipped English into Arabic
 * pages (fixed in f40294d). Sections resolve copy through `copy(t, value, …)`:
 * merchant text wins, otherwise the theme's own translations supply it.
 */

const U = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;
/** Theme-owned note illustrations, served from the built theme root. */
const NOTE = (name: string) => `/notes/${name}.svg`;

// ─── Shared setting groups ────────────────────────────────────────

/** Spacing + background, present on every body section. */
const spacing = (top = 72, bottom = 72, bg = ''): SectionSetting[] => [
  { id: 'padding_top', type: 'range', label: 'Padding Top', min: 0, max: 160, step: 8, default: top, unit: 'px' },
  { id: 'padding_bottom', type: 'range', label: 'Padding Bottom', min: 0, max: 160, step: 8, default: bottom, unit: 'px' },
  { id: 'background_color', type: 'color', label: 'Background', default: bg },
];

const headingGroup = (opts: { eyebrow?: boolean; sub?: boolean; cta?: boolean; align?: boolean } = {}): SectionSetting[] => [
  ...(opts.eyebrow ? [{ id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' } as SectionSetting] : []),
  { id: 'heading', type: 'text', label: 'Heading', default: '' },
  ...(opts.sub ? [{ id: 'subheading', type: 'textarea', label: 'Subheading', default: '' } as SectionSetting] : []),
  ...(opts.cta
    ? ([
        { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
        { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
      ] as SectionSetting[])
    : []),
  ...(opts.align
    ? ([{ id: 'align', type: 'select', label: 'Text Alignment', default: 'center', options: [
        { label: 'Start', value: 'start' }, { label: 'Center', value: 'center' },
      ] }] as SectionSetting[])
    : []),
];

const ICON_OPTIONS = [
  { label: 'Truck', value: 'truck' }, { label: 'Return', value: 'return' }, { label: 'Wallet', value: 'wallet' },
  { label: 'Headset', value: 'headset' }, { label: 'Shield', value: 'shield' }, { label: 'Leaf', value: 'leaf' },
  { label: 'Droplet', value: 'droplet' }, { label: 'Sparkle', value: 'sparkle' }, { label: 'Heart', value: 'heart' },
  { label: 'Flask', value: 'flask' }, { label: 'Gift', value: 'gift' }, { label: 'Check', value: 'check' },
];

const iconBlock = {
  type: 'item',
  name: 'Item',
  settings: [
    { id: 'icon', type: 'select', label: 'Icon', default: 'truck', options: ICON_OPTIONS },
    { id: 'title', type: 'text', label: 'Title', default: '' },
    { id: 'text', type: 'textarea', label: 'Text', default: '' },
  ] as SectionSetting[],
};

const PRODUCT_SOURCE: SectionSetting = {
  id: 'product_source', type: 'select', label: 'Product Source', default: 'newest',
  options: [
    { label: 'Newest', value: 'newest' }, { label: 'Featured', value: 'featured' },
    { label: 'On sale', value: 'sale' }, { label: 'Popular', value: 'popular' },
  ],
};

// ─── 1. Hero (home-4 banner) ──────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'misk-hero',
  name: 'Hero Slideshow',
  icon: 'Images',
  category: 'content',
  description: 'Full-bleed band with a framed image beside a caption; slides crossfade with a synced progress bar',
  target: 'body',
  limit: 1,
  settings: [
    // Simple-editor (My Store) settings: when filled they override the FIRST
    // slide's heading / text / image / button; the other slides are untouched.
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', bind: 'brand.tagline', default: '' },
    { id: 'image', type: 'image', label: 'Image', bind: 'brand.coverImage', default: '' },
    { id: 'cta_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'layout', type: 'select', label: 'Layout', default: 'image_start', options: [
      { label: 'Image at start', value: 'image_start' }, { label: 'Image at end', value: 'image_end' },
    ] },
    { id: 'band_color', type: 'color', label: 'Band Colour', default: '#191528' },
    { id: 'section_height', type: 'select', label: 'Section Height', default: 'tall', options: [
      { label: 'Medium', value: 'medium' }, { label: 'Tall', value: 'tall' }, { label: 'Full screen', value: 'full' },
    ] },
    { id: 'autoplay', type: 'checkbox', label: 'Auto-play', default: true },
    { id: 'autoplay_interval', type: 'range', label: 'Auto-play Interval', min: 3000, max: 12000, step: 500, default: 6000, unit: 'ms' },
    { id: 'pause_on_hover', type: 'checkbox', label: 'Pause on Hover', default: true },
    { id: 'show_arrows', type: 'checkbox', label: 'Show Arrows', default: true },
    { id: 'show_progress', type: 'checkbox', label: 'Show Progress Bar', default: true },
    { id: 'show_counter', type: 'checkbox', label: 'Show Slide Counter', default: true },
    { id: 'zoom_effect', type: 'checkbox', label: 'Slow Zoom On Image', default: true },
    { id: 'image_radius', type: 'range', label: 'Image Corner Radius', min: 0, max: 48, step: 2, default: 10, unit: 'px' },
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
        { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
        { id: 'cta_text', type: 'text', label: 'CTA Text', default: '' },
        { id: 'cta_url', type: 'url', label: 'CTA URL', default: '/products' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'slide-1', type: 'slide', settings: { image: U('1594125311687-3b1b3eafa9f4'), cta_url: '/products' } },
    { id: 'slide-2', type: 'slide', settings: { image: U('1631730359585-38a4935cbec4'), cta_url: '/products' } },
    { id: 'slide-3', type: 'slide', settings: { image: U('1631730359585-38a4935cbec4'), cta_url: '/products' } },
  ],
});

// ─── 2. Shop by notes ─────────────────────────────────────────────

export const notesSection: SectionDefinition = defineSection({
  type: 'misk-notes',
  name: 'Shop By Notes',
  icon: 'Flower2',
  category: 'commerce',
  description: 'A row of fragrance-note tiles that link to categories; becomes a swipeable rail on phones',
  target: 'body',
  settings: [
    ...headingGroup({ sub: true }),
    { id: 'source', type: 'select', label: 'Tiles From', default: 'blocks', options: [
      { label: 'The blocks below', value: 'blocks' }, { label: 'Store categories', value: 'categories' },
    ] },
    { id: 'max_items', type: 'number', label: 'Maximum Tiles', default: 8, min: 2, max: 16 },
    { id: 'columns', type: 'select', label: 'Columns (desktop)', default: '8', options: [
      { label: '4 Columns', value: '4' }, { label: '5 Columns', value: '5' }, { label: '6 Columns', value: '6' }, { label: '8 Columns', value: '8' },
    ] },
    { id: 'image_shape', type: 'select', label: 'Tile Shape', default: 'free', options: [
      { label: 'Cut-out (no frame)', value: 'free' }, { label: 'Circle', value: 'circle' }, { label: 'Rounded square', value: 'rounded' },
    ] },
    ...spacing(72, 24),
  ],
  blocks: [{
    type: 'note', name: 'Note', limit: 16,
    settings: [
      { id: 'image', type: 'image', label: 'Image', default: '' },
      { id: 'title', type: 'text', label: 'Title', default: '' },
      { id: 'link_url', type: 'url', label: 'Link URL', default: '/products' },
    ],
  }],
  /**
   * The note tiles ship as original SVG illustrations rather than stock
   * photography. Photographs of real bottles put somebody else's trademark
   * in every merchant's storefront, and at tile size an illustration reads
   * far more clearly than a cropped photo. Merchants can still swap any
   * tile for their own image from the customizer.
   */
  defaultBlocks: [
    { id: 'n-1', type: 'note', settings: { image: NOTE('citrus'), link_url: '/products' } },
    { id: 'n-2', type: 'note', settings: { image: NOTE('rose'), link_url: '/products' } },
    { id: 'n-3', type: 'note', settings: { image: NOTE('spice'), link_url: '/products' } },
    { id: 'n-4', type: 'note', settings: { image: NOTE('blossom'), link_url: '/products' } },
    { id: 'n-5', type: 'note', settings: { image: NOTE('lavender'), link_url: '/products' } },
    { id: 'n-6', type: 'note', settings: { image: NOTE('wood'), link_url: '/products' } },
    { id: 'n-7', type: 'note', settings: { image: NOTE('vanilla'), link_url: '/products' } },
    { id: 'n-8', type: 'note', settings: { image: NOTE('floral'), link_url: '/products' } },
  ],
});

// ─── 3. Scent cards (text + three labelled image cards) ───────────

export const scentCardsSection: SectionDefinition = defineSection({
  type: 'misk-scent-cards',
  name: 'Collection Cards',
  icon: 'LayoutGrid',
  category: 'commerce',
  description: 'An intro block beside image cards with centred pill labels',
  target: 'body',
  settings: [
    ...headingGroup({ eyebrow: true, sub: true, cta: true }),
    { id: 'layout', type: 'select', label: 'Layout', default: 'text_start', options: [
      { label: 'Text at start', value: 'text_start' }, { label: 'Text at end', value: 'text_end' }, { label: 'Text above', value: 'text_above' },
    ] },
    { id: 'card_radius', type: 'range', label: 'Card Corner Radius', min: 0, max: 40, step: 2, default: 14, unit: 'px' },
    { id: 'aspect', type: 'select', label: 'Card Shape', default: 'square', options: [
      { label: 'Square', value: 'square' }, { label: 'Portrait', value: 'portrait' }, { label: 'Landscape', value: 'landscape' },
    ] },
    ...spacing(24, 72),
  ],
  blocks: [{
    type: 'card', name: 'Card', limit: 6,
    settings: [
      { id: 'image', type: 'image', label: 'Image', default: '' },
      { id: 'title', type: 'text', label: 'Label', default: '' },
      { id: 'link_url', type: 'url', label: 'Link URL', default: '/products' },
    ],
  }],
  defaultBlocks: [
    { id: 'c-1', type: 'card', settings: { image: U('1612817288484-6f916006741a', 800), link_url: '/products' } },
    { id: 'c-2', type: 'card', settings: { image: U('1611930022073-b7a4ba5fcccd', 800), link_url: '/products' } },
    { id: 'c-3', type: 'card', settings: { image: U('1631730359585-38a4935cbec4', 800), link_url: '/products' } },
  ],
});

// ─── 4. Concept collage (grove band) ──────────────────────────────

export const conceptSection: SectionDefinition = defineSection({
  type: 'misk-concept',
  name: 'Concept Collage',
  icon: 'Images',
  category: 'content',
  description: 'A coloured band with a story block beside an asymmetric image collage',
  target: 'body',
  settings: [
    ...headingGroup({ eyebrow: true, cta: true }),
    { id: 'body', type: 'richtext', label: 'Body', default: '' },
    { id: 'layout', type: 'select', label: 'Layout', default: 'text_start', options: [
      { label: 'Text at start', value: 'text_start' }, { label: 'Text at end', value: 'text_end' },
    ] },
    { id: 'image_main', type: 'image', label: 'Tall Image', default: U('1631730359585-38a4935cbec4', 900) },
    { id: 'image_2', type: 'image', label: 'Image 2', default: U('1611930022073-b7a4ba5fcccd', 700) },
    { id: 'image_3', type: 'image', label: 'Image 3', default: U('1565193566173-7a0ee3dbe261', 700) },
    { id: 'image_4', type: 'image', label: 'Image 4', default: U('1610701596007-11502861dcfa', 700) },
    { id: 'image_5', type: 'image', label: 'Image 5', default: U('1593095948071-474c5cc2989d', 700) },
    { id: 'text_color', type: 'color', label: 'Text Colour', default: '#ffffff' },
    ...spacing(88, 88, '#33361f'),
  ],
});

// ─── 5. Product grid ──────────────────────────────────────────────

export const productGridSection: SectionDefinition = defineSection({
  type: 'misk-product-grid',
  name: 'Product Grid',
  icon: 'PackageSearch',
  category: 'commerce',
  description: 'A grid of products from a chosen source, with an optional underline rule beneath the heading',
  target: 'body',
  settings: [
    ...headingGroup({ eyebrow: true, sub: true, align: true }),
    { id: 'show_rule', type: 'checkbox', label: 'Show Rule Under Heading', default: true },
    PRODUCT_SOURCE,
    { id: 'collection', type: 'collection', label: 'Collection (overrides source)', default: '' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 12, min: 2, max: 24 },
    { id: 'columns', type: 'select', label: 'Columns (desktop)', default: '4', options: [
      { label: '2 Columns', value: '2' }, { label: '3 Columns', value: '3' }, { label: '4 Columns', value: '4' }, { label: '5 Columns', value: '5' },
    ] },
    { id: 'mobile_layout', type: 'select', label: 'Layout On Phones', default: 'grid-2', options: [
      { label: '2-column grid', value: 'grid-2' }, { label: '1-column grid', value: 'grid-1' }, { label: 'Swipeable rail', value: 'rail' },
    ] },
    { id: 'show_view_all', type: 'checkbox', label: 'Show "View All" Link', default: true },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
    ...spacing(),
  ],
});

// ─── 6. Countdown band ────────────────────────────────────────────

export const countdownSection: SectionDefinition = defineSection({
  type: 'misk-countdown',
  name: 'Countdown Banner',
  icon: 'Timer',
  category: 'marketing',
  description: 'A full-bleed banner with a countdown to a date you set. Hidden until a date is set.',
  target: 'body',
  settings: [
    { id: 'background_image', type: 'image', label: 'Background Image', default: U('1612817288484-6f916006741a') },
    { id: 'overlay_opacity', type: 'range', label: 'Overlay Opacity', min: 0, max: 90, step: 5, default: 45, unit: '%' },
    ...headingGroup({ eyebrow: true, cta: true }),
    { id: 'end_at', type: 'text', label: 'Countdown Ends (YYYY-MM-DD or YYYY-MM-DDTHH:mm)', default: '', info: 'Leave empty to hide the section — the theme never shows an invented timer.' },
    { id: 'repeat_daily', type: 'checkbox', label: 'Repeat Daily', default: false },
    { id: 'hide_when_expired', type: 'checkbox', label: 'Hide When Finished', default: true },
    { id: 'min_height', type: 'range', label: 'Minimum Height', min: 220, max: 640, step: 20, default: 320, unit: 'px' },
    { id: 'text_color', type: 'color', label: 'Text Colour', default: '#ffffff' },
    ...spacing(0, 0),
  ],
});

// ─── Library-only sections ────────────────────────────────────────

export const uspStripSection: SectionDefinition = defineSection({
  type: 'misk-usp-strip',
  name: 'Promise Strip',
  icon: 'ShieldCheck',
  category: 'marketing',
  description: 'A strip of icon promises — delivery, returns, payment, support',
  target: 'body',
  settings: [
    { id: 'columns', type: 'select', label: 'Columns (desktop)', default: '4', options: [
      { label: '3 Columns', value: '3' }, { label: '4 Columns', value: '4' },
    ] },
    { id: 'show_dividers', type: 'checkbox', label: 'Show Dividers', default: true },
    ...spacing(40, 40, '#f4efe7'),
  ],
  blocks: [{ ...iconBlock, limit: 4 }],
  defaultBlocks: [
    { id: 'u-1', type: 'item', settings: { icon: 'truck' } },
    { id: 'u-2', type: 'item', settings: { icon: 'return' } },
    { id: 'u-3', type: 'item', settings: { icon: 'wallet' } },
    { id: 'u-4', type: 'item', settings: { icon: 'headset' } },
  ],
});

export const splitBannerSection: SectionDefinition = defineSection({
  type: 'misk-split-banner',
  name: 'Split Banner',
  icon: 'PanelLeft',
  category: 'content',
  description: 'An image beside a block of text with a call to action',
  target: 'body',
  settings: [
    { id: 'image', type: 'image', label: 'Image', default: U('1611930022073-b7a4ba5fcccd') },
    { id: 'layout', type: 'select', label: 'Layout', default: 'image_start', options: [
      { label: 'Image at start', value: 'image_start' }, { label: 'Image at end', value: 'image_end' },
    ] },
    ...headingGroup({ eyebrow: true, sub: true, cta: true }),
    { id: 'image_radius', type: 'range', label: 'Image Corner Radius', min: 0, max: 48, step: 2, default: 10, unit: 'px' },
    ...spacing(),
  ],
});

export const categoryTilesSection: SectionDefinition = defineSection({
  type: 'misk-category-tiles',
  name: 'Category Tiles',
  icon: 'FolderTree',
  category: 'commerce',
  description: 'A grid of category image tiles with a slow zoom on hover',
  target: 'body',
  settings: [
    ...headingGroup({ eyebrow: true, sub: true, align: true }),
    { id: 'max_categories', type: 'number', label: 'Maximum Categories', default: 6, min: 2, max: 12 },
    { id: 'columns', type: 'select', label: 'Columns (desktop)', default: '3', options: [
      { label: '2 Columns', value: '2' }, { label: '3 Columns', value: '3' }, { label: '4 Columns', value: '4' },
    ] },
    { id: 'show_product_count', type: 'checkbox', label: 'Show Product Count', default: true },
    { id: 'card_radius', type: 'range', label: 'Card Corner Radius', min: 0, max: 40, step: 2, default: 14, unit: 'px' },
    ...spacing(),
  ],
});

export const testimonialsSection: SectionDefinition = defineSection({
  type: 'misk-testimonials',
  name: 'Testimonials',
  icon: 'Quote',
  category: 'content',
  description: 'Customer quotes in a swipeable carousel',
  target: 'body',
  settings: [...headingGroup({ eyebrow: true, sub: true, align: true }), ...spacing(72, 72, '#f4efe7')],
  blocks: [{
    type: 'quote', name: 'Quote', limit: 10,
    settings: [
      { id: 'quote', type: 'textarea', label: 'Quote', default: '' },
      { id: 'name', type: 'text', label: 'Name', default: '' },
      { id: 'role', type: 'text', label: 'Role / City', default: '' },
    ],
  }],
  defaultBlocks: [
    { id: 'q-1', type: 'quote', settings: {} },
    { id: 'q-2', type: 'quote', settings: {} },
    { id: 'q-3', type: 'quote', settings: {} },
  ],
});

export const storiesSection: SectionDefinition = defineSection({
  type: 'misk-stories',
  name: 'Stories',
  icon: 'Newspaper',
  category: 'content',
  description: 'A carousel of editorial cards linking to your pages',
  target: 'body',
  settings: [...headingGroup({ eyebrow: true, cta: true, align: true }), ...spacing()],
  blocks: [{
    type: 'post', name: 'Post', limit: 8,
    settings: [
      { id: 'image', type: 'image', label: 'Image', default: '' },
      { id: 'date', type: 'text', label: 'Date', default: '' },
      { id: 'title', type: 'text', label: 'Title', default: '' },
      { id: 'excerpt', type: 'textarea', label: 'Excerpt', default: '' },
      { id: 'link_url', type: 'url', label: 'Link URL', default: '/pages/about' },
    ],
  }],
  defaultBlocks: [
    { id: 'p-1', type: 'post', settings: { image: U('1594125311687-3b1b3eafa9f4', 900), link_url: '/pages/about' } },
    { id: 'p-2', type: 'post', settings: { image: U('1565193566173-7a0ee3dbe261', 900), link_url: '/pages/about' } },
    { id: 'p-3', type: 'post', settings: { image: U('1610701596007-11502861dcfa', 900), link_url: '/pages/about' } },
  ],
});

export const marqueeSection: SectionDefinition = defineSection({
  type: 'misk-marquee',
  name: 'Ticker',
  icon: 'Megaphone',
  category: 'marketing',
  description: 'A continuously scrolling strip of short messages',
  target: 'body',
  settings: [
    { id: 'speed', type: 'range', label: 'Scroll Duration', min: 10, max: 60, step: 2, default: 34, unit: 's' },
    { id: 'separator', type: 'select', label: 'Separator', default: 'diamond', options: [
      { label: 'Diamond', value: 'diamond' }, { label: 'Dot', value: 'dot' }, { label: 'Slash', value: 'slash' }, { label: 'None', value: 'none' },
    ] },
    { id: 'text_color', type: 'color', label: 'Text Colour', default: '#14110e' },
    ...spacing(16, 16, '#f4efe7'),
  ],
  blocks: [{ type: 'message', name: 'Message', limit: 8, settings: [{ id: 'text', type: 'text', label: 'Text', default: '' }] }],
  defaultBlocks: [
    { id: 'm-1', type: 'message', settings: {} },
    { id: 'm-2', type: 'message', settings: {} },
    { id: 'm-3', type: 'message', settings: {} },
  ],
});

// ─── Template helpers ─────────────────────────────────────────────

/**
 * The settings the phone-first simple editor surfaces for each section —
 * at most four apiece (MAX_BASIC_SETTINGS_PER_SECTION), chosen as the
 * things a merchant on a phone actually wants to change. Everything else
 * stays in the advanced editor. Annotated here, in one table, rather than
 * sprinkled through the definitions, because the limit is per section and
 * is far easier to keep honest when the whole set is visible at once.
 */
const BASIC_SETTINGS: Record<string, string[]> = {
  'misk-hero': ['heading', 'subheading', 'image', 'cta_text'],
  'misk-notes': ['heading', 'subheading', 'source'],
  'misk-scent-cards': ['heading', 'subheading', 'cta_text'],
  'misk-concept': ['heading', 'body', 'image_main'],
  'misk-product-grid': ['heading', 'product_source', 'product_limit'],
  'misk-countdown': ['heading', 'end_at', 'background_image'],
  'misk-usp-strip': ['columns'],
  'misk-split-banner': ['image', 'heading', 'cta_text'],
  'misk-category-tiles': ['heading', 'max_categories', 'columns'],
  'misk-testimonials': ['heading', 'subheading'],
  'misk-stories': ['heading', 'cta_text'],
  'misk-marquee': ['speed'],
};

/** Mark the settings named in BASIC_SETTINGS as simple-editor fields. */
function annotateBasic(defs: SectionDefinition[]): SectionDefinition[] {
  return defs.map((d) => {
    const ids = BASIC_SETTINGS[d.type];
    if (!ids) return d;
    return {
      ...d,
      settings: d.settings.map((s) => (ids.includes(s.id) ? ({ ...s, level: 'basic' } as SectionSetting) : s)),
    };
  });
}

const ALL_SECTIONS: SectionDefinition[] = [
  heroSection, notesSection, scentCardsSection, conceptSection, productGridSection, countdownSection,
  uspStripSection, splitBannerSection, categoryTilesSection, testimonialsSection, storiesSection, marqueeSection,
];

/**
 * Theme install seeds a store's sections from these template entries and copies
 * `blocks` verbatim (an absent array becomes `[]`, which then wins over the
 * definition's defaultBlocks at render time). Attach the defaults here so a
 * fresh install renders the curated homepage.
 */
function withDefaultBlocks<T extends { type: string; blocks?: any[] }>(entries: T[]): T[] {
  return entries.map((e) => {
    const def = ALL_SECTIONS.find((d) => d.type === e.type);
    return e.blocks || !def?.defaultBlocks ? e : { ...e, blocks: JSON.parse(JSON.stringify(def.defaultBlocks)) };
  });
}

// ─── Manifest ─────────────────────────────────────────────────────

const manifest = defineTheme({
  slug: 'misk',
  name: 'Misk',
  version: '1.0.0',
  previewImage: '/preview.jpg',
  description:
    'An Arabic-first fragrance storefront: Amiri naskh headlines over Tajawal, musk-gold accents on warm ink, a midnight hero band, shop-by-notes tiles and a merchant-dated countdown.',
  author: { name: 'Matjar', website: 'https://matjar.to' },
  categories: ['perfume', 'fragrance', 'beauty', 'luxury', 'general'],

  colors: {
    primary: '#14110E',
    secondary: '#A87333',
    accent: '#F4EFE7',
    background: '#FFFFFF',
    foreground: '#14110E',
    muted: '#6E675E',
    border: '#E6DFD4',
    error: '#C2281F',
    success: '#2E7D53',
  },

  typography: {
    fontFamily: "'Tajawal', 'Jost', system-ui, sans-serif",
    headingFontFamily: "'Amiri', 'Cormorant Garamond', Georgia, serif",
    baseFontSize: '17px',
    lineHeight: '1.8',
  },

  fonts: [
    { label: 'Tajawal', value: "'Tajawal', sans-serif" },
    { label: 'Amiri', value: "'Amiri', serif" },
    { label: 'Cormorant Garamond', value: "'Cormorant Garamond', Georgia, serif" },
    { label: 'Jost', value: "'Jost', system-ui, sans-serif" },
  ],

  layout: { maxWidth: '1320px', headerStyle: 'standard', footerStyle: 'expanded' },

  designTokens: {
    elevation: {
      xs: '0 1px 2px rgba(20,17,14,0.04)',
      sm: '0 2px 8px rgba(20,17,14,0.06)',
      md: '0 8px 24px rgba(20,17,14,0.08)',
      lg: '0 18px 48px rgba(20,17,14,0.10)',
      xl: '0 32px 80px rgba(20,17,14,0.14)',
    },
    motion: {
      durationFast: '180ms',
      durationBase: '320ms',
      durationSlow: '700ms',
      easeStandard: 'cubic-bezier(.4,0,.2,1)',
      easeEmphasized: 'cubic-bezier(.2,.8,.2,1)',
      easeEntrance: 'cubic-bezier(0,0,.2,1)',
      hoverLift: 'translateY(-4px)',
    },
    radius: { sm: '6px', base: '10px', lg: '18px', pill: '999px' },
    sectionGap: '72px',
  },

  settings: [
    // ── Utility bar ──
    { id: 'show_utility_bar', type: 'checkbox', label: 'Show Utility Bar', default: true },
    { id: 'utility_phone', type: 'text', label: 'Utility Bar Phone', default: '' },
    { id: 'utility_email', type: 'text', label: 'Utility Bar Email', default: '' },
    { id: 'utility_show_social', type: 'checkbox', label: 'Show Social Links In Utility Bar', default: true },
    { id: 'utility_show_language', type: 'checkbox', label: 'Show Language Switcher In Utility Bar', default: true },
    { id: 'utility_background', type: 'color', label: 'Utility Bar Background', default: '#f4efe7' },

    // ── Announcement ──
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: true },
    // One strip on every page with the merchant's own text (My Store → Homepage).
    { id: 'announcement_text', type: 'text', label: 'Top Strip Text', default: '' },
    { id: 'announcement_background', type: 'color', label: 'Announcement Background', default: '#14110e' },
    { id: 'announcement_color', type: 'color', label: 'Announcement Text Colour', default: '#ffffff' },

    { id: 'free_shipping_threshold', type: 'number', label: 'Free shipping threshold', default: 0, min: 0, max: 10000000, info: 'Set to 0 to hide the free-shipping progress bar in the cart.' },

    // ── Header ──
    { id: 'sticky_header', type: 'checkbox', label: 'Sticky Header (reveals on scroll up)', default: true },
    { id: 'header_layout', type: 'select', label: 'Header Layout', default: 'logo_start', options: [
      { label: 'Logo at start, menu centred', value: 'logo_start' }, { label: 'Logo centred, menu at start', value: 'logo_center' },
    ] },
    { id: 'show_wishlist_icon', type: 'checkbox', label: 'Show Wishlist Icon', default: true },
    { id: 'show_account_icon', type: 'checkbox', label: 'Show Account Icon', default: true },

    // ── Mega menu ──
    { id: 'mega_show_promo', type: 'checkbox', label: 'Show Promo Panel In Mega Menu', default: true },
    { id: 'mega_image', type: 'image', label: 'Mega Menu Image', default: U('1594125311687-3b1b3eafa9f4', 900) },
    { id: 'mega_eyebrow', type: 'text', label: 'Mega Menu Eyebrow', default: '' },
    { id: 'mega_title', type: 'text', label: 'Mega Menu Title', default: '' },
    { id: 'mega_cta_text', type: 'text', label: 'Mega Menu CTA Text', default: '' },
    { id: 'mega_cta_url', type: 'url', label: 'Mega Menu CTA URL', default: '/products' },

    // ── Search ──
    { id: 'show_search_popular', type: 'checkbox', label: 'Show Popular Searches', default: true },
    { id: 'popular_searches', type: 'text', label: 'Popular Searches (comma separated)', default: '' },
    { id: 'search_image', type: 'image', label: 'Search Panel Image', default: U('1612817288484-6f916006741a', 1000) },

    // ── Collection / product listing ──
    { id: 'collection_banner_image', type: 'image', label: 'Collection Banner Image', default: U('1631730359585-38a4935cbec4', 1800) },
    { id: 'collection_banner_height', type: 'range', label: 'Collection Banner Height', min: 160, max: 560, step: 20, default: 320, unit: 'px' },
    { id: 'collection_show_chips', type: 'checkbox', label: 'Show Category Chips On Collection Banner', default: true },
    { id: 'filter_placement', type: 'select', label: 'Collection Filters', default: 'start', options: [
      { label: 'Sidebar (start)', value: 'start' }, { label: 'Sidebar (end)', value: 'end' },
      { label: 'Bar above the grid', value: 'top' }, { label: 'Drawer', value: 'drawer' },
    ] },
    { id: 'default_columns', type: 'select', label: 'Collection Columns', default: '3', options: [
      { label: '2 Columns', value: '2' }, { label: '3 Columns', value: '3' }, { label: '4 Columns', value: '4' },
    ] },
    { id: 'mobile_columns', type: 'select', label: 'Collection Columns On Phones', default: '2', options: [
      { label: '1 Column', value: '1' }, { label: '2 Columns', value: '2' },
    ] },
    { id: 'pagination', type: 'select', label: 'Collection Pagination', default: 'load-more', options: [
      { label: 'Load more button', value: 'load-more' }, { label: 'Numbered pages', value: 'numbered' },
    ] },
    { id: 'products_per_page', type: 'number', label: 'Products Per Page', default: 12, min: 6, max: 48 },
    { id: 'show_grid_toggle', type: 'checkbox', label: 'Show Grid / List Toggle', default: true },

    // ── Product card ──
    { id: 'card_show_ribbon', type: 'checkbox', label: 'Show Sale Ribbon On Cards', default: true },
    { id: 'card_text_align', type: 'select', label: 'Card Text Alignment', default: 'center', options: [
      { label: 'Centred', value: 'center' }, { label: 'Start', value: 'start' },
    ] },
    { id: 'card_show_quick_add', type: 'checkbox', label: 'Show Quick Add Bar On Hover', default: true },
    { id: 'card_second_image', type: 'checkbox', label: 'Swap To Second Image On Hover', default: true },

    // ── Product page ──
    { id: 'gallery_layout', type: 'select', label: 'Product Gallery Layout', default: 'thumbs-below', options: [
      { label: 'Thumbnails below', value: 'thumbs-below' }, { label: 'Thumbnails at start', value: 'thumbs-start' },
      { label: 'Stacked images (sticky info)', value: 'stacked' }, { label: 'Slider with dots', value: 'slider-dots' },
    ] },
    { id: 'variant_picker_style', type: 'select', label: 'Variant Picker Style', default: 'buttons', options: [
      { label: 'Buttons', value: 'buttons' }, { label: 'Dropdown', value: 'dropdown' }, { label: 'Colour swatches', value: 'color-swatch' },
    ] },
    { id: 'product_info_style', type: 'select', label: 'Product Info Style', default: 'accordion', options: [
      { label: 'Accordion', value: 'accordion' }, { label: 'Tabs', value: 'tabs' },
    ] },
    { id: 'show_save_badge', type: 'checkbox', label: 'Show "Save %" Badge', default: true },
    { id: 'show_sticky_add_to_cart', type: 'checkbox', label: 'Sticky Add-To-Cart Bar', default: true },
    { id: 'show_buy_now', type: 'checkbox', label: 'Show Buy-Now Button', default: true },
    { id: 'show_delivery_note', type: 'checkbox', label: 'Show Delivery / Returns Notes', default: true },
    { id: 'delivery_note', type: 'text', label: 'Delivery Note', default: '' },
    { id: 'returns_note', type: 'text', label: 'Returns Note', default: '' },
    { id: 'show_related', type: 'checkbox', label: 'Show Related Products', default: true },
    { id: 'show_recently_viewed', type: 'checkbox', label: 'Show Recently Viewed', default: true },

    // ── Footer ──
    { id: 'footer_about', type: 'textarea', label: 'Footer About Text', default: '' },
    { id: 'footer_show_contact', type: 'checkbox', label: 'Show Footer Contact Column', default: true },
    { id: 'footer_show_menu', type: 'checkbox', label: 'Show Footer Menu Column', default: true },
    { id: 'footer_show_social', type: 'checkbox', label: 'Show Footer Social Links', default: true },
    { id: 'footer_show_payment', type: 'checkbox', label: 'Show Payment Badges', default: true },
    { id: 'footer_background', type: 'color', label: 'Footer Background', default: '#ffffff' },

    // ── Contact / WhatsApp (replaces the reference newsletter block) ──
    { id: 'show_whatsapp_block', type: 'checkbox', label: 'Show WhatsApp Block', default: true },
    { id: 'whatsapp_number', type: 'text', label: 'WhatsApp Number (international format)', bind: 'brand.whatsapp', default: '' },
    { id: 'whatsapp_heading', type: 'text', label: 'WhatsApp Heading', default: '' },
    { id: 'whatsapp_text', type: 'textarea', label: 'WhatsApp Text', default: '' },
    { id: 'show_floating_whatsapp', type: 'checkbox', label: 'Show Floating WhatsApp Button', default: false },
  ],

  sections: annotateBasic(ALL_SECTIONS),

  templates: {
    index: withDefaultBlocks([
      // Every theme's homepage: the hero, newest products, featured products
      // (PBI 10). The other sections stay addable from the advanced editor.
      { id: 'hero', type: 'misk-hero', settings: {} },
      { id: 'new-arrivals', type: 'misk-product-grid', settings: { product_source: 'newest', product_limit: 8 } },
      { id: 'featured', type: 'misk-product-grid', settings: { product_source: 'featured', product_limit: 8 } },
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
