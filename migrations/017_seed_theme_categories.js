/**
 * 017_seed_theme_categories
 *
 * Theme categories move from a hard-coded list (config/themeCategories.js
 * for the merchant theme library, config/storeNiches.js + Register.tsx for
 * signup's "what do you sell") into the admin DB, where the platform owner
 * manages them from the console's Themes page (services/themeCategories.js).
 *
 * up():
 *   1. Seeds the `themecategories` collection with the union of the old
 *      theme-library categories and the signup niches (en/ar names, icon,
 *      manifest aliases, order). The old library's "kids" becomes "toys" so
 *      it matches the signup niche id and the per-niche theme presets.
 *      A key that already exists is never overwritten.
 *   2. Records every existing theme's current categories as an explicit
 *      assignment (`Theme.categoryKeys`), computed with the same alias rule
 *      the library used, so the catalog looks exactly the same after deploy
 *      and the owner sees (and owns) each assignment. Themes that already
 *      have an assignment are left alone. Themes registered later (or on a
 *      fresh database, where the catalog sync runs after migrations) keep
 *      `categoryKeys: null` and are derived from their manifest at read time.
 *
 * Idempotent: seeded keys are inserted with $setOnInsert and themes are only
 * touched while `categoryKeys` is unset, so a re-run writes nothing.
 *
 * down(): drops the collection and unsets `Theme.categoryKeys`; the app then
 * re-seeds the built-in defaults on first read and derives every theme's
 * categories from its manifest again.
 */
export const description = "Seed platform-managed theme categories and record current theme assignments";

// Intentionally duplicated from config/themeCategories.js — a migration must
// not follow the app's defaults through future edits.
const CATEGORIES = [
  { key: "general", en: "General", ar: "عام", icon: "Store", aliases: ["general", "starter", "multi-purpose"] },
  { key: "fashion", en: "Fashion & apparel", ar: "أزياء وملابس", icon: "Shirt", aliases: ["fashion", "apparel", "clothing", "luxury"] },
  { key: "beauty", en: "Beauty & cosmetics", ar: "تجميل وعناية", icon: "Sparkles", aliases: ["beauty", "cosmetics", "skincare", "perfume"] },
  { key: "jewelry", en: "Jewelry & accessories", ar: "مجوهرات وإكسسوارات", icon: "Gem", aliases: ["jewelry", "jewellery", "accessories", "watches"] },
  { key: "electronics", en: "Electronics", ar: "إلكترونيات", icon: "Smartphone", aliases: ["electronics", "tech", "gadgets"] },
  { key: "food", en: "Food & beverages", ar: "أغذية ومشروبات", icon: "UtensilsCrossed", aliases: ["food", "grocery", "beverages", "coffee", "restaurant"] },
  { key: "health", en: "Health & wellness", ar: "صحة ولياقة", icon: "HeartPulse", aliases: ["health", "wellness", "supplements", "fitness", "pharmacy"] },
  { key: "home", en: "Home & living", ar: "منزل وديكور", icon: "Sofa", aliases: ["home", "decor", "furniture", "garden"] },
  { key: "toys", en: "Kids & toys", ar: "أطفال وألعاب", icon: "Baby", aliases: ["toys", "kids", "baby"] },
  { key: "sports", en: "Sports & outdoors", ar: "رياضة", icon: "Dumbbell", aliases: ["sports", "outdoors"] },
  { key: "books", en: "Books & stationery", ar: "كتب وقرطاسية", icon: "BookOpen", aliases: ["books", "stationery", "education"] },
];

const COLLECTION = "themecategories";

/** Manifest category strings → category keys, in category order; none → general. */
export function deriveCategoryKeys(raw, categories) {
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
  if (keys.size === 0 && categories.some((c) => c.key === "general")) keys.add("general");
  return categories.filter((c) => keys.has(c.key)).map((c) => c.key);
}

export async function up(db, { logger, session } = {}) {
  const opt = session ? { session } : undefined;
  const col = db.collection(COLLECTION);
  // Index outside the transaction (index builds can't join one everywhere).
  await col.createIndex({ key: 1 }, { unique: true });

  const now = new Date();
  let seeded = 0;
  for (const [i, c] of CATEGORIES.entries()) {
    const res = await col.updateOne(
      { key: c.key },
      {
        $setOnInsert: {
          key: c.key,
          name: { en: c.en, ar: c.ar },
          icon: c.icon,
          aliases: c.aliases,
          order: i,
          active: true,
          updatedBy: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, ...opt }
    );
    if (res.upsertedCount) seeded++;
  }

  // Resolve against what is in the collection now (owner edits included).
  const categories = await col.find({}, opt).sort({ order: 1, key: 1 }).toArray();
  const themes = await db
    .collection("themes")
    .find({ $or: [{ categoryKeys: { $exists: false } }, { categoryKeys: null }] }, { ...opt, projection: { slug: 1, categories: 1 } })
    .toArray();
  let assigned = 0;
  for (const t of themes) {
    const keys = deriveCategoryKeys(t.categories, categories);
    await db.collection("themes").updateOne({ _id: t._id }, { $set: { categoryKeys: keys } }, opt);
    assigned++;
  }
  logger?.info?.(`[017] theme categories seeded=${seeded}, themes assigned=${assigned}`);
}

export async function down(db, { logger, session } = {}) {
  const opt = session ? { session } : undefined;
  await db.collection("themes").updateMany({}, { $unset: { categoryKeys: "" } }, opt);
  const exists = await db.listCollections({ name: COLLECTION }).hasNext();
  if (exists) await db.collection(COLLECTION).drop();
  logger?.info?.("[017] theme categories dropped, theme assignments cleared");
}
