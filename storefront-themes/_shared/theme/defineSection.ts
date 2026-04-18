import type { SectionDefinition } from '../types/theme';

/**
 * Define a section that can be used in theme templates.
 *
 * @example
 * ```ts
 * export const heroSection = defineSection({
 *   type: 'hero',
 *   name: 'Hero Banner',
 *   target: 'body',
 *   settings: [
 *     { id: 'heading', type: 'text', label: 'Heading', default: 'Welcome' },
 *     { id: 'subheading', type: 'textarea', label: 'Subheading' },
 *     { id: 'background_image', type: 'image', label: 'Background Image' },
 *     { id: 'button_text', type: 'text', label: 'Button Text', default: 'Shop Now' },
 *     { id: 'button_url', type: 'url', label: 'Button URL', default: '/products' },
 *     { id: 'overlay_opacity', type: 'range', label: 'Overlay Opacity', min: 0, max: 100, step: 5, default: 40 },
 *   ],
 * });
 * ```
 */
export function defineSection(definition: SectionDefinition): SectionDefinition {
  return definition;
}
