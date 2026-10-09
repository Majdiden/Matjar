/**
 * Platform-managed theme categories (admin DB).
 *
 * One list drives three screens:
 *   - platform console Themes page: CRUD + per-theme assignment
 *     (routes/platform/storefront.js),
 *   - signup's "what do you sell" step and its theme pick
 *     (GET /api/themes/categories, /api/themes/active),
 *   - the merchant theme library's category chips (/api/themes/active).
 *
 * A theme's categories are `Theme.categoryKeys` when the owner assigned them
 * explicitly, otherwise derived from the manifest's free-form `categories`
 * through each category's aliases (config/themeCategories.js rule).
 *
 * The collection seeds itself with the built-in defaults when empty (fresh
 * database before migration 017 ran, tests). "general" is the catch-all —
 * it can be renamed and reordered but never deactivated or deleted, so the
 * list is never empty and signup always has an "all / general" choice.
 */
import { APIError } from "../middlewares/errorHandler.js";
import {
  GENERAL_THEME_CATEGORY,
  defaultThemeCategoryDocs,
  resolveThemeCategoryKeys,
} from "../config/themeCategories.js";
import { STORE_NICHES } from "../config/storeNiches.js";
import {
  countThemeCategoriesRepo,
  insertMissingThemeCategoriesRepo,
  listThemeCategoriesRepo,
  findThemeCategoryRepo,
  createThemeCategoryRepo,
  updateThemeCategoryRepo,
  deleteThemeCategoryRepo,
  maxThemeCategoryOrderRepo,
  setThemeCategoryOrderRepo,
  listThemesForCategoriesRepo,
  findThemeForCategoriesRepo,
  setThemeCategoryKeysRepo,
  pullCategoryFromThemesRepo,
} from "../repositories/themeCategory.js";

export { GENERAL_THEME_CATEGORY, resolveThemeCategoryKeys };

/** Max categories one theme may be assigned to. */
export const MAX_CATEGORIES_PER_THEME = 12;

/** Seed the built-in defaults when the collection is empty. Returns inserted count. */
export async function ensureThemeCategoriesSeeded() {
  if ((await countThemeCategoriesRepo()) > 0) return 0;
  return insertMissingThemeCategoriesRepo(defaultThemeCategoryDocs());
}

/** Every category in display order (seeding first when empty). */
export async function listThemeCategories({ activeOnly = false } = {}) {
  await ensureThemeCategoriesSeeded();
  return listThemeCategoriesRepo(activeOnly ? { active: true } : {});
}

/** Public shape of one category (both languages + legacy label fields). */
function publicCategory(c) {
  return {
    key: c.key,
    name: { en: c.name?.en || c.key, ar: c.name?.ar || "" },
    // Legacy fields the merchant theme library already reads.
    label: c.name?.en || c.key,
    labelAr: c.name?.ar || "",
    icon: c.icon || "",
    order: c.order,
  };
}

/**
 * Merchant theme library / signup theme step: each theme with its active
 * `categoryKeys`, plus the active categories that have at least one theme
 * (with counts), in the owner's order.
 */
export async function decorateThemesWithCategories(themes = []) {
  const categories = await listThemeCategories({ activeOnly: true });
  const counts = new Map();
  const decorated = themes.map((t) => {
    const categoryKeys = resolveThemeCategoryKeys(t, categories);
    for (const k of categoryKeys) counts.set(k, (counts.get(k) || 0) + 1);
    return { ...t, categoryKeys };
  });
  return {
    themes: decorated,
    categories: categories.filter((c) => counts.get(c.key)).map((c) => ({ ...publicCategory(c), count: counts.get(c.key) })),
  };
}

/**
 * Public read (signup runs before login): every ACTIVE category in order
 * with en/ar names and its theme count, plus each offered theme's keys.
 */
export async function getPublicThemeCategories(themes = []) {
  const categories = await listThemeCategories({ activeOnly: true });
  const counts = new Map();
  const themeKeys = themes.map((t) => {
    const categoryKeys = resolveThemeCategoryKeys(t, categories);
    for (const k of categoryKeys) counts.set(k, (counts.get(k) || 0) + 1);
    return { slug: t.slug, categoryKeys };
  });
  return {
    categories: categories.map((c) => ({ ...publicCategory(c), themeCount: counts.get(c.key) || 0 })),
    themes: themeKeys,
  };
}

/**
 * The niche to store on a new tenant: a known signup niche
 * (config/storeNiches.js — the ids theme presets are keyed by) or any
 * active category key. Anything else → null, as before.
 */
export async function resolveStoreNicheKey(raw) {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (STORE_NICHES.includes(key)) return key;
  const cat = await findThemeCategoryRepo(key);
  return cat?.active ? key : null;
}

// --- Platform console --------------------------------------------------

/** All categories (active and not) with the number of themes in each. */
export async function listThemeCategoriesForConsole() {
  const [categories, themes] = await Promise.all([listThemeCategories(), listThemesForCategoriesRepo()]);
  const counts = new Map();
  for (const t of themes) for (const k of resolveThemeCategoryKeys(t, categories)) counts.set(k, (counts.get(k) || 0) + 1);
  return categories.map((c) => ({ ...c, themeCount: counts.get(c.key) || 0, protected: c.key === GENERAL_THEME_CATEGORY }));
}

/** Console theme rows + their effective category keys (all categories). */
export async function decorateConsoleThemes(rows) {
  const categories = await listThemeCategories();
  return {
    categories,
    rows: rows.map((r) => ({
      ...r,
      categoryKeys: resolveThemeCategoryKeys(r, categories),
      categoryKeysManaged: Array.isArray(r.categoryKeys),
    })),
  };
}

const snapshot = (c) => (c ? { key: c.key, name: c.name, icon: c.icon, aliases: c.aliases, order: c.order, active: c.active } : null);

export async function createThemeCategory(input, actor) {
  await ensureThemeCategoriesSeeded();
  const key = input.key;
  if (await findThemeCategoryRepo(key)) throw new APIError(`A category with the key "${key}" already exists`, 409);
  const order = (await maxThemeCategoryOrderRepo()) + 1;
  try {
    const created = await createThemeCategoryRepo({
      key,
      name: { en: input.name.en, ar: input.name.ar },
      icon: input.icon || "",
      aliases: input.aliases || [],
      active: input.active !== false,
      order,
      updatedBy: actor?.email || null,
    });
    return { after: snapshot(created), row: created };
  } catch (err) {
    if (err?.code === 11000) throw new APIError(`A category with the key "${key}" already exists`, 409);
    throw err;
  }
}

export async function updateThemeCategory(key, patch, actor) {
  const before = await findThemeCategoryRepo(key);
  if (!before) throw new APIError("Category not found", 404);
  if (key === GENERAL_THEME_CATEGORY && patch.active === false) {
    throw new APIError('"General" is the catch-all category and cannot be deactivated', 409);
  }
  const set = { updatedBy: actor?.email || null };
  if (patch.name?.en !== undefined) set["name.en"] = patch.name.en;
  if (patch.name?.ar !== undefined) set["name.ar"] = patch.name.ar;
  for (const k of ["icon", "aliases", "active", "order"]) if (patch[k] !== undefined) set[k] = patch[k];
  const after = await updateThemeCategoryRepo(key, set);
  return { before: snapshot(before), after: snapshot(after), row: after };
}

/** `keys` must be every existing category key exactly once. */
export async function reorderThemeCategories(keys, actor) {
  const all = await listThemeCategories();
  const existing = all.map((c) => c.key);
  const same = keys.length === existing.length && new Set(keys).size === keys.length && keys.every((k) => existing.includes(k));
  if (!same) throw new APIError("The new order must list every category exactly once", 400);
  await setThemeCategoryOrderRepo(keys, actor?.email || null);
  return { before: existing, after: keys };
}

export async function deleteThemeCategory(key) {
  if (key === GENERAL_THEME_CATEGORY) throw new APIError('"General" is the catch-all category and cannot be deleted', 409);
  const before = await findThemeCategoryRepo(key);
  if (!before) throw new APIError("Category not found", 404);
  await deleteThemeCategoryRepo(key);
  const themesUpdated = await pullCategoryFromThemesRepo(key);
  return { before: snapshot(before), themesUpdated };
}

/**
 * Assign a theme to categories. `keys` null = back to automatic (derived
 * from the manifest); an array (possibly empty) is stored as given.
 */
export async function setThemeCategories(themeId, keys) {
  const theme = await findThemeForCategoriesRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  const categories = await listThemeCategories();
  const known = new Set(categories.map((c) => c.key));
  let next = null;
  if (Array.isArray(keys)) {
    const unknown = keys.filter((k) => !known.has(k));
    if (unknown.length) throw new APIError(`Unknown categor${unknown.length > 1 ? "ies" : "y"}: ${unknown.join(", ")}`, 400);
    // Store in the owner's category order, deduplicated.
    next = categories.filter((c) => keys.includes(c.key)).map((c) => c.key);
  }
  const before = { categoryKeys: resolveThemeCategoryKeys(theme, categories), managed: Array.isArray(theme.categoryKeys) };
  const updated = await setThemeCategoryKeysRepo(themeId, next);
  const after = { categoryKeys: resolveThemeCategoryKeys(updated, categories), managed: Array.isArray(updated.categoryKeys) };
  return { before, after, row: { ...updated, categoryKeys: after.categoryKeys, categoryKeysManaged: after.managed } };
}
