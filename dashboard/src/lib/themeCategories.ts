// =============================================================================
// Platform-managed theme categories (backend services/themeCategories.js).
// The platform owner curates them in the console; signup's "what do you
// sell" step reads GET /api/themes/categories and the theme library reads
// the `categories` + per-theme `categoryKeys` of GET /api/themes/active.
// =============================================================================

export interface ThemeCategoryInfo {
  key: string;
  name?: { en?: string; ar?: string };
  /** Legacy fields (same values as name.en / name.ar). */
  label?: string;
  labelAr?: string;
  /** Lucide icon name, may be empty. */
  icon?: string;
  /** Themes in the category (library: `count`, signup endpoint: `themeCount`). */
  count?: number;
  themeCount?: number;
}

/** The catch-all category: always offered, shows every theme. */
export const GENERAL_CATEGORY = 'general';

/** The category's name in the UI language (Arabic falls back to English). */
export function categoryName(c: ThemeCategoryInfo, language: string | undefined): string {
  const en = c.name?.en || c.label || c.key;
  const ar = c.name?.ar || c.labelAr || '';
  return language?.startsWith('ar') && ar ? ar : en;
}

/**
 * Signup niche choices: the active categories in the owner's order, with
 * "general" always available (last, unless the owner placed it).
 */
export function nicheChoices<T extends ThemeCategoryInfo>(categories: T[], general: T): T[] {
  if (categories.some((c) => c.key === GENERAL_CATEGORY)) return categories;
  return [...categories, general];
}
