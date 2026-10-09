/**
 * Store niches a merchant picks at signup (dashboard Register.tsx
 * NICHE_IDS). Stored on `tenant.settings.niche` and used to pick a theme's
 * per-niche starting homepage (`manifest.presets[niche]`, PBI 10). Not the
 * same list as config/themeCategories.js, which groups theme catalog keys.
 *
 * Mirrored by NICHE_IDS in storefront-themes/_shared/theme/brandBindings.ts;
 * tests/unit/themeBindingsParity.test.js keeps the three lists identical.
 */
export const STORE_NICHES = Object.freeze([
  "fashion",
  "electronics",
  "food",
  "sports",
  "books",
  "toys",
  "home",
  "general",
]);

/** The niche id when `raw` is a known niche, else null. */
export function normalizeStoreNiche(raw) {
  if (typeof raw !== "string") return null;
  const niche = raw.trim().toLowerCase();
  return STORE_NICHES.includes(niche) ? niche : null;
}
