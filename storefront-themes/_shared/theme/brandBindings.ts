/**
 * Brand-kit bindings (PBI 10) — pure value resolution, no React.
 *
 * A manifest setting may declare `bind: 'brand.tagline'` (etc.). Its
 * effective value is then:
 *
 *   1. the merchant's override — the stored value, when it differs from the
 *      manifest default (a blank value equals a blank default);
 *   2. else the brand-kit value, when the merchant has set it;
 *   3. else the manifest default.
 *
 * "Manifest default" for a section instance is the setting's `default`
 * overlaid with the settings of the manifest template instance that has the
 * same id (templates + homeVariants), exactly as ThemeProvider merges them.
 * A setting counts as overridden when its base key OR its `<id>__ar` twin
 * holds a non-default value, so a merchant who typed only one language
 * keeps full control of the setting.
 *
 * Bilingual brand texts `{ ar, en? }` fill two keys: the base key gets the
 * English text (the Arabic one when there is no English) and `<id>__ar` gets
 * the Arabic text. The storefront's per-language resolution
 * (ThemeProvider → resolveI18nSettings) then shows Arabic to Arabic visitors
 * and English — or Arabic when none was given — to English visitors,
 * whatever the store language is.
 *
 * Resolution runs in the storefront (ThemeProvider), so the live store, the
 * editor preview and live editor edits all agree. The backend mirror
 * (utils/themeBindings.js) reports per-setting sources to the dashboard and
 * is kept identical by tests/unit/themeBindingsParity.test.js.
 *
 * Stores without brand-kit data are untouched: with no brand value nothing
 * is filled and the settings object is returned as is.
 */
import type { BrandBinding, NicheId, SettingSource } from '../types/theme';
import type { BrandKit, BrandText } from '../types/commerce';

export const BRAND_BINDINGS: readonly BrandBinding[] = Object.freeze([
  'store.name',
  'store.logo',
  'brand.tagline',
  'brand.coverImage',
  'brand.color',
  'brand.whatsapp',
  'brand.city',
  'brand.hours',
] as const);

/** Bindings whose brand value is a `{ ar, en? }` text. */
export const BILINGUAL_BRAND_BINDINGS: readonly BrandBinding[] = Object.freeze([
  'brand.tagline',
  'brand.city',
  'brand.hours',
] as const);

/**
 * Setting types each binding may be declared on. Rich text is excluded on
 * purpose: brand texts are plain text and must never be rendered as HTML.
 */
export const BRAND_BINDING_SETTING_TYPES: Readonly<Record<BrandBinding, readonly string[]>> = Object.freeze({
  'store.name': ['text'],
  'store.logo': ['image'],
  'brand.tagline': ['text', 'textarea'],
  'brand.coverImage': ['image'],
  'brand.color': ['color'],
  'brand.whatsapp': ['text'],
  'brand.city': ['text', 'textarea'],
  'brand.hours': ['text', 'textarea'],
});

export const SETTING_SOURCES: readonly SettingSource[] = Object.freeze(['override', 'brand', 'default'] as const);

/** Signup niches, in the order the dashboard shows them. */
export const NICHE_IDS: readonly NicheId[] = Object.freeze([
  'fashion',
  'electronics',
  'food',
  'sports',
  'books',
  'toys',
  'home',
  'general',
] as const);

/** Suffix of the Arabic twin of a text setting (`heading` → `heading__ar`). */
export const ARABIC_SETTING_SUFFIX = '__ar';

/** The colour token the brand colour feeds. */
export const BRAND_COLOR_TOKEN = 'primary';

/** The store facts bindings read from (the storefront `store` payload). */
export interface BrandBindingSource {
  name?: string | null;
  logo?: string | null;
  brand?: BrandKit | null;
}

interface BindableSetting {
  id: string;
  bind?: BrandBinding | string;
}

const isBlank = (v: unknown): boolean => v == null || (typeof v === 'string' && v.trim() === '');

const isFilledString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Same value as the default; blank and blank count as the same. */
function sameAsDefault(value: unknown, def: unknown): boolean {
  if (value === def) return true;
  return isBlank(value) && isBlank(def);
}

/**
 * The raw brand-kit value a binding points at, or null when the merchant has
 * not set it. Bilingual values are returned only when the Arabic text is set
 * (Arabic is the required language of every brand text).
 */
export function brandBindingValue(
  binding: BrandBinding | string,
  source: BrandBindingSource | null | undefined,
): string | BrandText | null {
  if (!source) return null;
  switch (binding) {
    case 'store.name':
      return isFilledString(source.name) ? source.name : null;
    case 'store.logo':
      return isFilledString(source.logo) ? source.logo : null;
    default:
      break;
  }
  if (!BRAND_BINDINGS.includes(binding as BrandBinding)) return null;
  const field = binding.slice('brand.'.length) as keyof BrandKit;
  const value = source.brand?.[field];
  if (BILINGUAL_BRAND_BINDINGS.includes(binding as BrandBinding)) {
    const text = value as BrandText | undefined;
    return text && isFilledString(text.ar) ? text : null;
  }
  return isFilledString(value) ? (value as string) : null;
}

/**
 * The setting keys a binding fills for one setting, or null when the brand
 * value is not set. Bilingual: `{ [id]: en || ar, [id__ar]: ar }`.
 */
export function brandSettingValues(
  settingId: string,
  binding: BrandBinding | string,
  source: BrandBindingSource | null | undefined,
): Record<string, string> | null {
  const value = brandBindingValue(binding, source);
  if (value == null) return null;
  if (typeof value === 'string') return { [settingId]: value };
  const ar = value.ar as string;
  const en = isFilledString(value.en) ? value.en : ar;
  return { [settingId]: en, [`${settingId}${ARABIC_SETTING_SUFFIX}`]: ar };
}

/**
 * True when the merchant changed the setting: its base key or its Arabic
 * twin holds something other than the manifest default.
 */
export function isSettingOverridden(
  settingId: string,
  values: Record<string, any> | null | undefined,
  defaults: Record<string, any> | null | undefined,
): boolean {
  const v = values || {};
  const d = defaults || {};
  if (v[settingId] !== undefined && !sameAsDefault(v[settingId], d[settingId])) return true;
  const twin = `${settingId}${ARABIC_SETTING_SUFFIX}`;
  return isFilledString(v[twin]) && !sameAsDefault(v[twin], d[twin]);
}

export interface ResolvedSettings {
  /** Effective values: `values` with brand values filled in. */
  settings: Record<string, any>;
  /** Source of every declared setting, keyed by setting id. */
  sources: Record<string, SettingSource>;
  /** Only the keys the brand kit filled (including `__ar` twins). */
  brandValues: Record<string, string>;
}

/**
 * Apply brand bindings to one settings bag.
 *
 * @param settingDefs  the declared settings (section or theme-level)
 * @param values       merged values (manifest defaults overlaid with stored)
 * @param defaults     manifest defaults for the same bag
 * @param source       store facts (`{ name, logo, brand }`)
 */
export function resolveBoundSettings(
  settingDefs: readonly BindableSetting[] | null | undefined,
  values: Record<string, any> | null | undefined,
  defaults: Record<string, any> | null | undefined,
  source: BrandBindingSource | null | undefined,
): ResolvedSettings {
  const input = values || {};
  const sources: Record<string, SettingSource> = {};
  const brandValues: Record<string, string> = {};
  for (const def of Array.isArray(settingDefs) ? settingDefs : []) {
    if (!def || typeof def.id !== 'string') continue;
    if (isSettingOverridden(def.id, input, defaults)) {
      sources[def.id] = 'override';
      continue;
    }
    const filled = def.bind ? brandSettingValues(def.id, def.bind, source) : null;
    if (filled) {
      Object.assign(brandValues, filled);
      sources[def.id] = 'brand';
    } else {
      sources[def.id] = 'default';
    }
  }
  const settings = Object.keys(brandValues).length ? { ...input, ...brandValues } : input;
  return { settings, sources, brandValues };
}

const sameColor = (a: unknown, b: unknown): boolean =>
  typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Effective primary colour: the merchant's own primary colour when they
 * changed it, else the brand colour when set, else the manifest colour.
 */
export function resolvePrimaryColor(
  manifestColor: string | undefined,
  storedColor: string | undefined | null,
  source: BrandBindingSource | null | undefined,
): { color: string | undefined; source: SettingSource } {
  if (!isBlank(storedColor) && !sameColor(storedColor, manifestColor)) {
    return { color: storedColor as string, source: 'override' };
  }
  const brandColor = brandBindingValue('brand.color', source);
  if (typeof brandColor === 'string') return { color: brandColor, source: 'brand' };
  return { color: isBlank(storedColor) ? manifestColor : (storedColor as string), source: 'default' };
}
