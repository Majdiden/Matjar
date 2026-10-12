/**
 * Homepage with no products yet.
 *
 * A store without products would show empty product grids and rails. In that
 * case the homepage keeps only its hero (the store's name, line and cover) and
 * every theme shows one "No products to show yet" message in place of the
 * product sections.
 *
 * Every theme's hero section type names a hero (`hero`, `atelier-hero`,
 * `aurum-split-hero`, `hero-showcase`, ...), the same rule the theme switch
 * uses (services/themeSwitchCarry.js).
 *
 * Pure, no DOM: unit tested directly.
 */

const HERO_TYPE = /hero/i;

export const isHeroSection = (type: unknown): boolean => HERO_TYPE.test(String(type ?? ''));

/**
 * The homepage sections to render and whether to show the empty message.
 * `hasProducts` is null while unknown: everything renders as usual then, so a
 * store with products never loses its sections for a moment.
 */
export function gateHomeSections<S extends { type?: string }>(
  sections: readonly S[],
  hasProducts: boolean | null,
): { sections: S[]; showEmpty: boolean } {
  if (hasProducts !== false) return { sections: [...sections], showEmpty: false };
  return { sections: sections.filter((s) => isHeroSection(s.type)), showEmpty: true };
}
