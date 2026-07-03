/**
 * Universal section catalog (backend mirror).
 *
 * Mirrors `storefront-themes/_shared/theme/universalSections.ts`. Every
 * theme manifest is auto-augmented with these section definitions at
 * registry-load time so:
 *
 *   - The dashboard's "add section" picker offers the universal types
 *     for any active theme.
 *   - Publish-time validation accepts merchant-added sections of these
 *     types regardless of which theme is active.
 *
 * Theme-declared sections take precedence — if a theme already declares
 * "hero" with custom settings, the universal "hero" is dropped.
 *
 * IMPORTANT: keep this file in sync with the frontend version. The shapes
 * must match field-for-field so the merchant sees the same editor controls
 * the storefront actually consumes.
 */

export const UNIVERSAL_SECTIONS = [
  {
    type: "hero",
    name: "Hero Banner",
    description: "Large hero with heading, subheading, and CTAs",
    target: "body",
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "Welcome" },
      { id: "subheading", type: "textarea", label: "Subheading", default: "" },
      { id: "badge_text", type: "text", label: "Badge Text", default: "" },
      { id: "background_image", type: "image", label: "Background Image" },
      { id: "overlay_opacity", type: "range", label: "Overlay Opacity", min: 0, max: 100, step: 5, default: 0, unit: "%" },
      { id: "primary_button_text", type: "text", label: "Primary Button Text", default: "Shop Now" },
      { id: "primary_button_url", type: "url", label: "Primary Button URL", default: "/products" },
      { id: "secondary_button_text", type: "text", label: "Secondary Button Text", default: "" },
      { id: "secondary_button_url", type: "url", label: "Secondary Button URL", default: "" },
    ],
  },
  {
    type: "banner",
    name: "Promo Banner",
    description: "Slim promotional strip",
    target: "body",
    settings: [
      { id: "message", type: "text", label: "Message", default: "Free shipping on all orders over $50" },
      { id: "link_text", type: "text", label: "Link Text", default: "" },
      { id: "link_url", type: "url", label: "Link URL", default: "" },
      { id: "background_color", type: "color", label: "Background", default: "#2563eb" },
      { id: "text_color", type: "color", label: "Text Color", default: "#ffffff" },
    ],
  },
  {
    type: "rich-text",
    name: "Rich Text",
    description: "Heading + paragraph with optional CTA",
    target: "body",
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "" },
      { id: "subheading", type: "text", label: "Subheading", default: "" },
      { id: "body", type: "richtext", label: "Body", default: "" },
      { id: "button_text", type: "text", label: "Button Text", default: "" },
      { id: "button_url", type: "url", label: "Button URL", default: "" },
    ],
  },
  {
    type: "image-with-text",
    name: "Image with Text",
    description: "Split layout: image on one side, content on the other",
    target: "body",
    settings: [
      { id: "image", type: "image", label: "Image" },
      { id: "eyebrow", type: "text", label: "Eyebrow", default: "" },
      { id: "heading", type: "text", label: "Heading", default: "Our Story" },
      { id: "body", type: "richtext", label: "Body", default: "" },
      { id: "button_text", type: "text", label: "Button Text", default: "" },
      { id: "button_url", type: "url", label: "Button URL", default: "" },
      {
        id: "layout",
        type: "select",
        label: "Layout",
        default: "image-left",
        options: [
          { value: "image-left", label: "Image Left" },
          { value: "image-right", label: "Image Right" },
        ],
      },
    ],
  },
  {
    type: "gallery",
    name: "Gallery",
    description: "Grid of images",
    target: "body",
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "" },
      { id: "columns", type: "number", label: "Columns", default: 3, min: 2, max: 6 },
      { id: "images", type: "json", label: "Images (URLs)", default: [] },
    ],
  },
  {
    type: "features",
    name: "Features",
    description: "Icon + title + description grid",
    target: "body",
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "Why Shop With Us" },
      { id: "features", type: "json", label: "Features", default: [] },
    ],
  },
  {
    type: "video",
    name: "Video",
    description: "Embedded YouTube/Vimeo video",
    target: "body",
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "" },
      { id: "video_url", type: "url", label: "Video URL", default: "" },
    ],
  },
  {
    type: "testimonials",
    name: "Testimonials",
    description: "Customer quotes grid",
    target: "body",
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "What Customers Say" },
      { id: "testimonials", type: "json", label: "Testimonials", default: [] },
    ],
  },
  {
    type: "newsletter",
    name: "Newsletter Signup",
    description: "Email subscription form",
    target: "body",
    limit: 1,
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "Stay in the Loop" },
      { id: "subheading", type: "text", label: "Subheading", default: "Subscribe for exclusive deals" },
      { id: "placeholder", type: "text", label: "Input Placeholder", default: "Enter your email" },
      { id: "button_text", type: "text", label: "Button Text", default: "Subscribe" },
      { id: "disclaimer", type: "text", label: "Disclaimer", default: "" },
      { id: "use_gradient", type: "checkbox", label: "Use Theme Gradient", default: true },
      { id: "background_color", type: "color", label: "Background Color", default: "#2563eb" },
    ],
  },
  {
    type: "brands",
    name: "Brand Logos",
    description: "Strip of partner / brand logos",
    target: "body",
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "AS FEATURED IN" },
      { id: "logos", type: "json", label: "Logo URLs", default: [] },
    ],
  },
  {
    type: "spacer",
    name: "Spacer",
    description: "Vertical breathing room",
    target: "body",
    settings: [
      { id: "height", type: "number", label: "Height (px)", default: 40, min: 0, max: 400, step: 4 },
    ],
  },
  {
    type: "featured-products",
    name: "Featured Products",
    description: "Grid of featured products",
    target: "body",
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "Featured Products" },
      { id: "subheading", type: "text", label: "Subheading", default: "" },
      { id: "product_limit", type: "number", label: "Number of Products", default: 8, min: 2, max: 16 },
      {
        id: "columns",
        type: "select",
        label: "Columns",
        default: "4",
        options: [
          { value: "2", label: "2 Columns" },
          { value: "3", label: "3 Columns" },
          { value: "4", label: "4 Columns" },
        ],
      },
      { id: "show_quick_view", type: "checkbox", label: "Show Quick View", default: true },
      { id: "show_rating", type: "checkbox", label: "Show Rating", default: true },
      { id: "show_add_to_cart", type: "checkbox", label: "Show Add to Cart", default: true },
      { id: "view_all_url", type: "url", label: "View All URL", default: "/products" },
    ],
  },
  {
    type: "new-arrivals",
    name: "New Arrivals",
    description: "Carousel of recently added products",
    target: "body",
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "New Arrivals" },
      { id: "subheading", type: "text", label: "Subheading", default: "" },
      { id: "product_limit", type: "number", label: "Number of Products", default: 8, min: 4, max: 16 },
      { id: "autoplay", type: "checkbox", label: "Auto-play", default: false },
      { id: "show_add_to_cart", type: "checkbox", label: "Show Add to Cart", default: true },
      { id: "view_all_url", type: "url", label: "View All URL", default: "/products?sort=newest" },
    ],
  },
  {
    type: "categories",
    name: "Category Grid",
    description: "Category showcase",
    target: "body",
    settings: [
      { id: "heading", type: "text", label: "Heading", default: "Shop by Category" },
      { id: "subheading", type: "text", label: "Subheading", default: "" },
      { id: "max_categories", type: "number", label: "Max Categories", default: 6, min: 2, max: 12 },
      { id: "show_product_count", type: "checkbox", label: "Show Product Count", default: true },
    ],
  },
  {
    type: "trust-badges",
    name: "Trust Badges",
    description: "Shipping/security/returns highlights",
    target: "body",
    settings: [
      { id: "background_color", type: "color", label: "Background", default: "#f9fafb" },
      { id: "badges", type: "json", label: "Badges", default: [] },
    ],
  },
];

/**
 * Merge universal sections into a theme manifest's `sections` array,
 * preserving theme-declared types as the source of truth.
 */
export function mergeUniversalSections(themeSections = []) {
  const declared = new Set(themeSections.map((s) => s.type));
  return [
    ...themeSections,
    ...UNIVERSAL_SECTIONS.filter((s) => !declared.has(s.type)),
  ];
}
