import type { ThemeManifest, SectionDefinition } from '../types/theme';
import { universalSections } from './universalSections';

/**
 * Define a theme manifest. Theme developers wrap their config in
 * `defineTheme()` so the SDK can:
 *
 *   1. Type-check the manifest shape
 *   2. Auto-merge the universal section catalog (so any section type the
 *      merchant adds via the dashboard always validates on publish AND has
 *      a default render path via `_shared/components/sections`)
 *
 * Theme-declared sections take precedence over the universal catalog —
 * if a theme defines its own `hero` section with custom settings, that
 * one is kept and the universal `hero` is dropped.
 *
 * @example
 * ```ts
 * export default defineTheme({
 *   slug: 'modern',
 *   name: 'Modern',
 *   ...
 *   sections: [heroSection, featuredProductsSection, ...],
 *   templates: { index: [...] },
 * });
 * ```
 */
export function defineTheme(manifest: ThemeManifest): ThemeManifest {
  const declaredTypes = new Set(manifest.sections.map((s) => s.type));
  const merged: SectionDefinition[] = [
    ...manifest.sections,
    ...universalSections.filter((s) => !declaredTypes.has(s.type)),
  ];
  return { ...manifest, sections: merged };
}
