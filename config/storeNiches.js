/**
 * The original signup niches. Theme presets are keyed by these
 * (`manifest.presets[niche]`, PBI 10; utils/themeManifestRules.js), so they
 * stay the fixed set a preset may target.
 *
 * What signup OFFERS is now the platform-managed theme category list
 * (services/themeCategories.js); every id below is one of its default
 * categories (config/themeCategories.js), and `tenant.settings.niche` accepts
 * these ids or any active category key (resolveStoreNicheKey). A category
 * without a preset simply starts from `templates.index`.
 *
 * Mirrored by NICHE_IDS in storefront-themes/_shared/theme/brandBindings.ts
 * and by the offline fallback list in dashboard Register.tsx;
 * tests/unit/themeBindingsParity.test.js keeps them identical.
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
