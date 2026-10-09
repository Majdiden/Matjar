/**
 * Theme switch carry-over: the homepage words and photo the merchant typed in
 * the simple editor follow them to the new theme.
 *
 * Every theme's hero names the same few things differently (`heading` vs
 * `heading_line1`, `cta_text` vs `primary_button_text`, ...). The subtitle
 * already follows because every hero binds it to the brand tagline. The rest
 * is matched here by role: the outgoing hero's value for a role is written to
 * the first key of that role the incoming hero declares, with its Arabic twin.
 * The top strip (theme-level settings) carries over as is.
 *
 * Only values the merchant set are carried (non-empty, not a stock image), and
 * only into a fresh customization: a theme the merchant used before comes back
 * as they left it (see installThemeService).
 *
 * Pure: no database access, so it is unit tested directly.
 */

export const ARABIC_TWIN_SUFFIX = "__ar";

/** Hero setting keys by role, in order of preference. */
export const HERO_ROLES = Object.freeze({
  heading: Object.freeze(["heading", "heading_line1", "title"]),
  subheading: Object.freeze(["subheading", "subtitle"]),
  cta: Object.freeze(["cta_text", "primary_button_text", "button_text"]),
  image: Object.freeze(["image", "background_image", "image_left"]),
});

/** Roles whose value is text (and so may have an Arabic twin). */
const TEXT_ROLES = new Set(["heading", "subheading", "cta"]);

/** Theme-level top strip keys (storefront-themes/_shared/theme/topStrip.tsx). */
export const TOP_STRIP_KEYS = Object.freeze([
  "show_announcement_bar",
  "announcement_text",
  `announcement_text${ARABIC_TWIN_SUFFIX}`,
]);

const HERO_TYPE = /hero/i;

const isBlank = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());

/** Theme demo photos are stock; a merchant's own photo is anything else. */
const isStockImage = (url) => typeof url !== "string" || !url.trim() || /(^|\/\/)images\.unsplash\.com\//.test(url);

/** The homepage hero: the first enabled section whose type names a hero. */
export function findHero(sections) {
  if (!Array.isArray(sections)) return null;
  const sorted = [...sections].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  return sorted.find((s) => s && HERO_TYPE.test(String(s.type || "")) && s.enabled !== false) || null;
}

/** The role values the merchant set on a hero: { role: { value, twin? } }. */
export function readHeroRoles(settings) {
  const out = {};
  if (!settings || typeof settings !== "object") return out;
  for (const [role, keys] of Object.entries(HERO_ROLES)) {
    for (const key of keys) {
      const value = settings[key];
      const twin = TEXT_ROLES.has(role) ? settings[`${key}${ARABIC_TWIN_SUFFIX}`] : undefined;
      if (role === "image" ? isStockImage(value) : isBlank(value) && isBlank(twin)) continue;
      out[role] = isBlank(twin) ? { value } : { value: isBlank(value) ? twin : value, twin };
      break;
    }
  }
  return out;
}

/**
 * `sectionsByTemplate` of the incoming theme with the outgoing hero's values
 * written into its hero. `declaredKeys(type)` returns the setting ids the
 * incoming theme declares for a section type; a role the incoming hero
 * doesn't declare is dropped.
 */
export function carryHero(fromSections, toSectionsByTemplate, declaredKeys) {
  const toIndex = toSectionsByTemplate?.index;
  const target = findHero(toIndex);
  const source = findHero(fromSections);
  if (!target || !source) return toSectionsByTemplate;

  const roles = readHeroRoles(source.settings);
  const declared = new Set(declaredKeys(target.type) || []);
  const patch = {};
  for (const [role, { value, twin }] of Object.entries(roles)) {
    const key = HERO_ROLES[role].find((k) => declared.has(k));
    if (!key) continue;
    patch[key] = value;
    if (twin !== undefined) patch[`${key}${ARABIC_TWIN_SUFFIX}`] = twin;
  }
  if (!Object.keys(patch).length) return toSectionsByTemplate;

  return {
    ...toSectionsByTemplate,
    index: toIndex.map((s) => (s === target ? { ...s, settings: { ...(s.settings || {}), ...patch } } : s)),
  };
}

/** The top strip settings to carry into the incoming theme's `settings.theme`. */
export function carryTopStrip(fromThemeSettings) {
  const out = {};
  if (!fromThemeSettings || typeof fromThemeSettings !== "object") return out;
  for (const key of TOP_STRIP_KEYS) {
    if (fromThemeSettings[key] !== undefined) out[key] = fromThemeSettings[key];
  }
  return out;
}

/** A fresh customization `{ settings, sectionsByTemplate }` with both carried in. */
export function carryCustomization(from, to, declaredKeys) {
  if (!from) return to;
  return {
    ...to,
    sectionsByTemplate: carryHero(from.sectionsByTemplate?.index, to.sectionsByTemplate, declaredKeys),
    settings: { ...to.settings, theme: { ...(to.settings?.theme || {}), ...carryTopStrip(from.settings?.theme) } },
  };
}
