/**
 * Curated theme categories shown to merchants. Theme manifests declare
 * free-form category keys (`categories: ['cosmetics', 'beauty']`); this
 * registry groups those keys into a small, labelled set so the Themes page
 * can offer a category filter. Unknown keys fall into "general".
 */
export const THEME_CATEGORIES = Object.freeze([
  { key: "general", label: "General", labelAr: "عام", icon: "Store", aliases: ["general", "starter", "multi-purpose"] },
  { key: "fashion", label: "Fashion & apparel", labelAr: "أزياء وملابس", icon: "Shirt", aliases: ["fashion", "apparel", "clothing", "luxury"] },
  { key: "beauty", label: "Beauty & cosmetics", labelAr: "تجميل وعناية", icon: "Sparkles", aliases: ["beauty", "cosmetics", "skincare", "perfume"] },
  { key: "jewelry", label: "Jewelry & accessories", labelAr: "مجوهرات وإكسسوارات", icon: "Gem", aliases: ["jewelry", "jewellery", "accessories", "watches"] },
  { key: "electronics", label: "Electronics", labelAr: "إلكترونيات", icon: "Smartphone", aliases: ["electronics", "tech", "gadgets"] },
  { key: "food", label: "Food & beverages", labelAr: "أغذية ومشروبات", icon: "UtensilsCrossed", aliases: ["food", "grocery", "beverages", "coffee", "restaurant"] },
  { key: "health", label: "Health & wellness", labelAr: "صحة ولياقة", icon: "HeartPulse", aliases: ["health", "wellness", "supplements", "fitness", "pharmacy"] },
  { key: "home", label: "Home & living", labelAr: "منزل وديكور", icon: "Sofa", aliases: ["home", "decor", "furniture", "garden"] },
  { key: "kids", label: "Kids & toys", labelAr: "أطفال وألعاب", icon: "Baby", aliases: ["kids", "toys", "baby"] },
  { key: "sports", label: "Sports & outdoors", labelAr: "رياضة", icon: "Dumbbell", aliases: ["sports", "outdoors"] },
  { key: "books", label: "Books & stationery", labelAr: "كتب وقرطاسية", icon: "BookOpen", aliases: ["books", "stationery", "education"] },
]);

const ALIAS_INDEX = new Map();
for (const c of THEME_CATEGORIES) for (const a of c.aliases) ALIAS_INDEX.set(a, c.key);

/** Manifest keys → curated category keys (deduplicated, registry order). */
export function normaliseThemeCategories(raw = []) {
  const keys = new Set();
  for (const r of raw) {
    const k = ALIAS_INDEX.get(String(r || "").toLowerCase().trim());
    if (k) keys.add(k);
  }
  if (keys.size === 0) keys.add("general");
  return THEME_CATEGORIES.filter((c) => keys.has(c.key)).map((c) => c.key);
}

/** Registry entries with a per-category theme count for the given themes. */
export function summariseThemeCategories(themes = []) {
  const counts = new Map();
  for (const t of themes) {
    for (const k of normaliseThemeCategories(t.categories)) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return THEME_CATEGORIES.filter((c) => counts.get(c.key)).map(({ key, label, labelAr, icon }) => ({ key, label, labelAr, icon, count: counts.get(key) }));
}
