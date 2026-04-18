/**
 * Universal section definitions — shared across every theme so that
 * sections added in the dashboard from the global section library always
 * pass the publish-time manifest validation gate AND have a render path
 * via the default registry in `_shared/components/sections`.
 *
 * defineTheme() automatically appends any of these that the theme didn't
 * already declare, so themes only need to list type-specific sections of
 * their own.
 */
import { defineSection } from './defineSection';
import type { SectionDefinition } from '../types/theme';

export const universalSections: SectionDefinition[] = [
  defineSection({
    type: 'hero',
    name: 'Hero Banner',
    description: 'Large hero with heading, subheading, and CTAs',
    target: 'body',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: 'Welcome' },
      { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
      { id: 'badge_text', type: 'text', label: 'Badge Text', default: '' },
      { id: 'background_image', type: 'image', label: 'Background Image' },
      { id: 'overlay_opacity', type: 'range', label: 'Overlay Opacity', min: 0, max: 100, step: 5, default: 0, unit: '%' },
      { id: 'primary_button_text', type: 'text', label: 'Primary Button Text', default: 'Shop Now' },
      { id: 'primary_button_url', type: 'url', label: 'Primary Button URL', default: '/products' },
      { id: 'secondary_button_text', type: 'text', label: 'Secondary Button Text', default: '' },
      { id: 'secondary_button_url', type: 'url', label: 'Secondary Button URL', default: '' },
    ],
  }),

  defineSection({
    type: 'banner',
    name: 'Promo Banner',
    description: 'Slim promotional strip',
    target: 'body',
    settings: [
      { id: 'message', type: 'text', label: 'Message', default: 'Free shipping on all orders over $50' },
      { id: 'link_text', type: 'text', label: 'Link Text', default: '' },
      { id: 'link_url', type: 'url', label: 'Link URL', default: '' },
      { id: 'background_color', type: 'color', label: 'Background', default: '#2563eb' },
      { id: 'text_color', type: 'color', label: 'Text Color', default: '#ffffff' },
    ],
  }),

  defineSection({
    type: 'rich-text',
    name: 'Rich Text',
    description: 'Heading + paragraph with optional CTA',
    target: 'body',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: '' },
      { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
      { id: 'body', type: 'textarea', label: 'Body', default: '' },
      { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
      { id: 'button_url', type: 'url', label: 'Button URL', default: '' },
    ],
  }),

  defineSection({
    type: 'image-with-text',
    name: 'Image with Text',
    description: 'Split layout: image on one side, content on the other',
    target: 'body',
    settings: [
      { id: 'image', type: 'image', label: 'Image' },
      { id: 'eyebrow', type: 'text', label: 'Eyebrow', default: '' },
      { id: 'heading', type: 'text', label: 'Heading', default: 'Our Story' },
      { id: 'body', type: 'textarea', label: 'Body', default: '' },
      { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
      { id: 'button_url', type: 'url', label: 'Button URL', default: '' },
      { id: 'layout', type: 'select', label: 'Layout', default: 'image-left', options: [
        { value: 'image-left', label: 'Image Left' },
        { value: 'image-right', label: 'Image Right' },
      ]},
    ],
  }),

  defineSection({
    type: 'gallery',
    name: 'Gallery',
    description: 'Grid of images',
    target: 'body',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: '' },
      { id: 'columns', type: 'number', label: 'Columns', default: 3, min: 2, max: 6 },
      // Note: `images` is a JSON array; the dashboard editor exposes it as a list builder.
    ],
  }),

  defineSection({
    type: 'features',
    name: 'Features',
    description: 'Icon + title + description grid',
    target: 'body',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: 'Why Shop With Us' },
      // `features` is a JSON list of {icon, title, description}
    ],
  }),

  defineSection({
    type: 'video',
    name: 'Video',
    description: 'Embedded YouTube/Vimeo video',
    target: 'body',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: '' },
      { id: 'video_url', type: 'url', label: 'Video URL', default: '' },
    ],
  }),

  defineSection({
    type: 'testimonials',
    name: 'Testimonials',
    description: 'Customer quotes grid',
    target: 'body',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: 'What Customers Say' },
      // `testimonials` is a JSON list of {quote, author, role, avatar}
    ],
  }),

  defineSection({
    type: 'newsletter',
    name: 'Newsletter Signup',
    description: 'Email subscription form',
    target: 'body',
    limit: 1,
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: 'Stay in the Loop' },
      { id: 'subheading', type: 'text', label: 'Subheading', default: 'Subscribe for exclusive deals' },
      { id: 'placeholder', type: 'text', label: 'Input Placeholder', default: 'Enter your email' },
      { id: 'button_text', type: 'text', label: 'Button Text', default: 'Subscribe' },
      { id: 'disclaimer', type: 'text', label: 'Disclaimer', default: '' },
      { id: 'use_gradient', type: 'checkbox', label: 'Use Theme Gradient', default: true },
      { id: 'background_color', type: 'color', label: 'Background Color', default: '#2563eb' },
    ],
  }),

  defineSection({
    type: 'brands',
    name: 'Brand Logos',
    description: 'Strip of partner / brand logos',
    target: 'body',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: 'AS FEATURED IN' },
      // `logos` is a JSON list of image URLs
    ],
  }),

  defineSection({
    type: 'spacer',
    name: 'Spacer',
    description: 'Vertical breathing room',
    target: 'body',
    settings: [
      { id: 'height', type: 'number', label: 'Height (px)', default: 40, min: 0, max: 400, step: 4 },
    ],
  }),

  defineSection({
    type: 'featured-products',
    name: 'Featured Products',
    description: 'Grid of featured products',
    target: 'body',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: 'Featured Products' },
      { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
      { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 2, max: 16 },
      { id: 'columns', type: 'select', label: 'Columns', default: '4', options: [
        { value: '2', label: '2 Columns' },
        { value: '3', label: '3 Columns' },
        { value: '4', label: '4 Columns' },
      ]},
      { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
      { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
      { id: 'show_add_to_cart', type: 'checkbox', label: 'Show Add to Cart', default: true },
      { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
    ],
  }),

  defineSection({
    type: 'new-arrivals',
    name: 'New Arrivals',
    description: 'Carousel of recently added products',
    target: 'body',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: 'New Arrivals' },
      { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
      { id: 'product_limit', type: 'number', label: 'Number of Products', default: 8, min: 4, max: 16 },
      { id: 'autoplay', type: 'checkbox', label: 'Auto-play', default: false },
      { id: 'show_add_to_cart', type: 'checkbox', label: 'Show Add to Cart', default: true },
      { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products?sort=newest' },
    ],
  }),

  defineSection({
    type: 'categories',
    name: 'Category Grid',
    description: 'Category showcase',
    target: 'body',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: 'Shop by Category' },
      { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
      { id: 'max_categories', type: 'number', label: 'Max Categories', default: 6, min: 2, max: 12 },
      { id: 'show_product_count', type: 'checkbox', label: 'Show Product Count', default: true },
    ],
  }),

  defineSection({
    type: 'trust-badges',
    name: 'Trust Badges',
    description: 'Shipping/security/returns highlights',
    target: 'body',
    settings: [
      { id: 'background_color', type: 'color', label: 'Background', default: '#f9fafb' },
      // `badges` is a JSON list of {icon, title, description}
    ],
  }),
];
