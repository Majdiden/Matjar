/**
 * Brand-kit bindings (PBI 10) — backend mirror of
 * storefront-themes/_shared/theme/brandBindings.ts.
 *
 * The storefront resolves bindings while rendering (ThemeProvider), so the
 * live store, the editor preview and live editor edits agree. The backend
 * needs the SAME rule to tell the dashboard, per setting, whether the value
 * the merchant sees is their own ("override"), comes from the brand kit
 * ("brand") or is the theme's ("default") — see
 * services/themeCustomization.js → getThemeCustomizationService.
 * tests/unit/themeBindingsParity.test.js fails the moment the two drift.
 *
 * Rule: merchant override → brand-kit value (only when set) → manifest
 * default. A setting is overridden when its base key or its `<id>__ar` twin
 * holds a non-default value (blank equals a blank default). Bilingual brand
 * texts fill `<id>` with English (Arabic when there is none) and `<id>__ar`
 * with Arabic.
 */

export const BRAND_BINDINGS = Object.freeze([
  "store.name",
  "store.logo",
  "brand.tagline",
  "brand.coverImage",
  "brand.color",
  "brand.whatsapp",
  "brand.city",
  "brand.hours",
]);

export const BILINGUAL_BRAND_BINDINGS = Object.freeze(["brand.tagline", "brand.city", "brand.hours"]);

/** Setting types each binding may be declared on (no richtext: brand text is plain). */
export const BRAND_BINDING_SETTING_TYPES = Object.freeze({
  "store.name": ["text"],
  "store.logo": ["image"],
  "brand.tagline": ["text", "textarea"],
  "brand.coverImage": ["image"],
  "brand.color": ["color"],
  "brand.whatsapp": ["text"],
  "brand.city": ["text", "textarea"],
  "brand.hours": ["text", "textarea"],
});

export const SETTING_SOURCES = Object.freeze(["override", "brand", "default"]);

export const ARABIC_SETTING_SUFFIX = "__ar";

/** The colour token the brand colour feeds. */
export const BRAND_COLOR_TOKEN = "primary";

const isBlank = (v) => v == null || (typeof v === "string" && v.trim() === "");
const isFilledString = (v) => typeof v === "string" && v.trim() !== "";

function sameAsDefault(value, def) {
  if (value === def) return true;
  return isBlank(value) && isBlank(def);
}

/**
 * Store facts bindings read from, in the shape the storefront receives them
 * (services/storefrontStoreInfo.js): `{ name, logo, brand }` where `brand`
 * is the public brand kit (utils/brandKit.js → publicBrand).
 */
export function brandBindingSourceFor(tenant, publicBrandFn) {
  return {
    name: tenant?.settings?.storeName || tenant?.name || null,
    logo: tenant?.settings?.logo || null,
    brand: publicBrandFn(tenant?.settings?.brand),
  };
}

export function brandBindingValue(binding, source) {
  if (!source) return null;
  if (binding === "store.name") return isFilledString(source.name) ? source.name : null;
  if (binding === "store.logo") return isFilledString(source.logo) ? source.logo : null;
  if (!BRAND_BINDINGS.includes(binding)) return null;
  const value = source.brand?.[binding.slice("brand.".length)];
  if (BILINGUAL_BRAND_BINDINGS.includes(binding)) {
    return value && isFilledString(value.ar) ? value : null;
  }
  return isFilledString(value) ? value : null;
}

export function brandSettingValues(settingId, binding, source) {
  const value = brandBindingValue(binding, source);
  if (value == null) return null;
  if (typeof value === "string") return { [settingId]: value };
  const ar = value.ar;
  const en = isFilledString(value.en) ? value.en : ar;
  return { [settingId]: en, [`${settingId}${ARABIC_SETTING_SUFFIX}`]: ar };
}

export function isSettingOverridden(settingId, values, defaults) {
  const v = values || {};
  const d = defaults || {};
  if (v[settingId] !== undefined && !sameAsDefault(v[settingId], d[settingId])) return true;
  const twin = `${settingId}${ARABIC_SETTING_SUFFIX}`;
  return isFilledString(v[twin]) && !sameAsDefault(v[twin], d[twin]);
}

/**
 * @returns {{ settings: object, sources: Record<string,'override'|'brand'|'default'>, brandValues: Record<string,string> }}
 */
export function resolveBoundSettings(settingDefs, values, defaults, source) {
  const input = values || {};
  const sources = {};
  const brandValues = {};
  for (const def of Array.isArray(settingDefs) ? settingDefs : []) {
    if (!def || typeof def.id !== "string") continue;
    if (isSettingOverridden(def.id, input, defaults)) {
      sources[def.id] = "override";
      continue;
    }
    const filled = def.bind ? brandSettingValues(def.id, def.bind, source) : null;
    if (filled) {
      Object.assign(brandValues, filled);
      sources[def.id] = "brand";
    } else {
      sources[def.id] = "default";
    }
  }
  const settings = Object.keys(brandValues).length ? { ...input, ...brandValues } : input;
  return { settings, sources, brandValues };
}

const sameColor = (a, b) =>
  typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();

export function resolvePrimaryColor(manifestColor, storedColor, source) {
  if (!isBlank(storedColor) && !sameColor(storedColor, manifestColor)) {
    return { color: storedColor, source: "override" };
  }
  const brandColor = brandBindingValue("brand.color", source);
  if (typeof brandColor === "string") return { color: brandColor, source: "brand" };
  return { color: isBlank(storedColor) ? manifestColor : storedColor, source: "default" };
}

/**
 * Manifest default settings per section instance id: the section type's
 * setting defaults overlaid with the template instance of the same id
 * (templates + homeVariants) — the merge ThemeProvider renders with.
 */
export function manifestInstanceDefaults(manifest) {
  const typeDefaults = new Map();
  for (const def of Array.isArray(manifest?.sections) ? manifest.sections : []) {
    const out = {};
    for (const s of Array.isArray(def?.settings) ? def.settings : []) {
      if (s && s.default !== undefined) out[s.id] = s.default;
    }
    typeDefaults.set(def.type, out);
  }
  const byId = new Map();
  const lists = [
    ...Object.values(manifest?.templates || {}),
    ...Object.values(manifest?.homeVariants || {}),
  ];
  for (const list of lists) {
    for (const inst of Array.isArray(list) ? list : []) {
      if (!inst?.id) continue;
      byId.set(inst.id, { ...(typeDefaults.get(inst.type) || {}), ...(inst.settings || {}) });
    }
  }
  return {
    /** Defaults for instance `id` of `type` (type defaults when the id is not a manifest instance). */
    forInstance(id, type) {
      return byId.get(id) || typeDefaults.get(type) || {};
    },
  };
}
