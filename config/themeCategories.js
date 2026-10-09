/**
 * Theme categories — the BUILT-IN DEFAULTS.
 *
 * The live list is platform-managed in the admin DB (schemas/themeCategory.js,
 * services/themeCategories.js): the platform owner creates, renames, orders,
 * deactivates and deletes categories and assigns themes to them from the
 * platform console. Signup ("what do you sell") and the merchant theme
 * library both read that list (GET /api/themes/categories, /api/themes/active).
 *
 * This file only provides:
 *   - the seed used when the collection is empty (fresh database; migration
 *     017 seeds the same list on deploy), and
 *   - the alias rule that maps a theme manifest's free-form `categories`
 *     (['cosmetics', 'beauty']) onto category keys for any theme the owner
 *     has not assigned explicitly yet (Theme.categoryKeys === null).
 *
 * Every signup niche in config/storeNiches.js is a key here, so the old
 * niche ids (and the per-niche theme presets keyed by them) keep working.
 */
export const GENERAL_THEME_CATEGORY = "general";

export const THEME_CATEGORIES = Object.freeze([
  { key: "general", label: "General", labelAr: "عام", icon: "Store", aliases: ["general", "starter", "multi-purpose"] },
  { key: "fashion", label: "Fashion & apparel", labelAr: "أزياء وملابس", icon: "Shirt", aliases: ["fashion", "apparel", "clothing", "luxury"] },
  { key: "beauty", label: "Beauty & cosmetics", labelAr: "تجميل وعناية", icon: "Sparkles", aliases: ["beauty", "cosmetics", "skincare", "perfume"] },
  { key: "jewelry", label: "Jewelry & accessories", labelAr: "مجوهرات وإكسسوارات", icon: "Gem", aliases: ["jewelry", "jewellery", "accessories", "watches"] },
  { key: "electronics", label: "Electronics", labelAr: "إلكترونيات", icon: "Smartphone", aliases: ["electronics", "tech", "gadgets"] },
  { key: "food", label: "Food & beverages", labelAr: "أغذية ومشروبات", icon: "UtensilsCrossed", aliases: ["food", "grocery", "beverages", "coffee", "restaurant"] },
  { key: "health", label: "Health & wellness", labelAr: "صحة ولياقة", icon: "HeartPulse", aliases: ["health", "wellness", "supplements", "fitness", "pharmacy"] },
  { key: "home", label: "Home & living", labelAr: "منزل وديكور", icon: "Sofa", aliases: ["home", "decor", "furniture", "garden"] },
  // Key "toys" (not "kids") so it matches the signup niche id and the
  // per-niche theme presets keyed by it (manifest.presets.toys).
  { key: "toys", label: "Kids & toys", labelAr: "أطفال وألعاب", icon: "Baby", aliases: ["toys", "kids", "baby"] },
  { key: "sports", label: "Sports & outdoors", labelAr: "رياضة", icon: "Dumbbell", aliases: ["sports", "outdoors"] },
  { key: "books", label: "Books & stationery", labelAr: "كتب وقرطاسية", icon: "BookOpen", aliases: ["books", "stationery", "education"] },
]);

/** The defaults as ThemeCategory documents (seed shape). */
export function defaultThemeCategoryDocs() {
  return THEME_CATEGORIES.map((c, i) => ({
    key: c.key,
    name: { en: c.label, ar: c.labelAr },
    icon: c.icon,
    aliases: [...c.aliases],
    order: i,
    active: true,
  }));
}

/**
 * Manifest keys → category keys (deduplicated, in `categories` order).
 * `categories` is a list of `{ key, aliases? }`; a category's own key always
 * counts as an alias. Nothing matched → "general" when that category exists.
 */
export function normaliseThemeCategories(raw = [], categories = THEME_CATEGORIES) {
  const index = new Map();
  for (const c of categories) {
    for (const a of [c.key, ...(c.aliases || [])]) {
      const k = String(a || "").toLowerCase().trim();
      if (k && !index.has(k)) index.set(k, c.key);
    }
  }
  const keys = new Set();
  for (const r of Array.isArray(raw) ? raw : []) {
    const k = index.get(String(r || "").toLowerCase().trim());
    if (k) keys.add(k);
  }
  if (keys.size === 0 && categories.some((c) => c.key === GENERAL_THEME_CATEGORY)) keys.add(GENERAL_THEME_CATEGORY);
  return categories.filter((c) => keys.has(c.key)).map((c) => c.key);
}

/**
 * The category keys a theme belongs to, in `categories` order. Explicit
 * assignment (`Theme.categoryKeys` array) wins, unknown/removed keys dropped;
 * otherwise derived from the manifest categories via aliases.
 */
export function resolveThemeCategoryKeys(theme, categories) {
  if (Array.isArray(theme?.categoryKeys)) {
    const set = new Set(theme.categoryKeys);
    return categories.filter((c) => set.has(c.key)).map((c) => c.key);
  }
  return normaliseThemeCategories(theme?.categories, categories);
}

/** Registry entries with a per-category theme count for the given themes. */
export function summariseThemeCategories(themes = []) {
  const counts = new Map();
  for (const t of themes) {
    for (const k of normaliseThemeCategories(t.categories)) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return THEME_CATEGORIES.filter((c) => counts.get(c.key)).map(({ key, label, labelAr, icon }) => ({ key, label, labelAr, icon, count: counts.get(key) }));
}
