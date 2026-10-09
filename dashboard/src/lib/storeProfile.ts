/**
 * Store profile / brand kit (PBI 10) — dashboard types and pure helpers.
 *
 * Mirrors GET/PUT /api/store-profile (services/storeProfile.js). Length
 * limits mirror utils/brandKit.js and validators/storeProfile.validator.js —
 * keep them in sync (same convention as SOCIAL_HOSTS in ./storeLink).
 *
 * PUT is a partial update: only the keys sent change, null clears a field,
 * and a bilingual text (`{ ar, en }`) is replaced as a whole.
 */
import type { SocialPlatform } from './storeLink';
import type { BilingualValue } from './bilingual';

export type BrandTextField = 'tagline' | 'city' | 'hours';

export interface StoreBrand {
  tagline?: BilingualValue;
  city?: BilingualValue;
  hours?: BilingualValue;
  coverImage?: string;
  /** "#rrggbb", lowercase. */
  color?: string;
  /** E.164, e.g. "+249912345678". */
  whatsapp?: string;
}

export interface StoreProfile {
  storeName: string | null;
  logo: string | null;
  brand: StoreBrand;
  socialLinks: Partial<Record<SocialPlatform, string>>;
  contact: { email: string | null; phone: string | null; address: string | null };
}

export interface StoreProfilePatch {
  storeName?: string | null;
  logo?: string | null;
  brand?: {
    tagline?: BilingualValue | null;
    city?: BilingualValue | null;
    hours?: BilingualValue | null;
    coverImage?: string | null;
    color?: string | null;
    whatsapp?: string | null;
    whatsappCountry?: string;
  };
  socialLinks?: Partial<Record<SocialPlatform, string | null>>;
}

export const STORE_NAME_MIN_LENGTH = 2;
export const STORE_NAME_MAX_LENGTH = 100;

export const BRAND_TEXT_MAX_LENGTH: Record<BrandTextField, number> = {
  tagline: 140,
  city: 80,
  hours: 200,
};

/** Social pages the brand form asks for (the API accepts a few more). */
export const BRAND_SOCIAL_PLATFORMS = ['facebook', 'instagram', 'tiktok'] as const;
export type BrandSocialPlatform = (typeof BRAND_SOCIAL_PLATFORMS)[number];

/**
 * Main-colour swatches: strong enough for white button text, and familiar
 * shop colours (Nile blue, green, red, gold…). The last entry is the
 * "custom" picker in the form.
 */
export const BRAND_COLOR_PRESETS = [
  '#1d4ed8',
  '#0f766e',
  '#15803d',
  '#b91c1c',
  '#be185d',
  '#7c3aed',
  '#b45309',
  '#111827',
] as const;

export const BRAND_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export const EMPTY_STORE_PROFILE: StoreProfile = {
  storeName: null,
  logo: null,
  brand: {},
  socialLinks: {},
  contact: { email: null, phone: null, address: null },
};

/** Fill missing objects so the form can bind without null checks. */
export function toStoreProfile(raw: Partial<StoreProfile> | null | undefined): StoreProfile {
  return {
    ...EMPTY_STORE_PROFILE,
    ...(raw || {}),
    brand: { ...(raw?.brand || {}) },
    socialLinks: { ...(raw?.socialLinks || {}) },
    contact: { ...EMPTY_STORE_PROFILE.contact, ...(raw?.contact || {}) },
  };
}

/**
 * The brand-kit facts the hub nudges for, in the order a merchant should
 * fill them. Each key doubles as the i18n key of its "Add your …" status.
 */
export const BRAND_CHECKLIST = ['logo', 'whatsapp', 'tagline', 'color', 'cover'] as const;
export type BrandChecklistItem = (typeof BRAND_CHECKLIST)[number];

/** First missing brand-kit fact, or null when everything is filled in. */
export function firstMissingBrandItem(profile: StoreProfile): BrandChecklistItem | null {
  const has: Record<BrandChecklistItem, boolean> = {
    logo: !!profile.logo,
    whatsapp: !!profile.brand.whatsapp,
    tagline: !!profile.brand.tagline?.ar,
    color: !!profile.brand.color,
    cover: !!profile.brand.coverImage,
  };
  return BRAND_CHECKLIST.find((key) => !has[key]) ?? null;
}

/**
 * Turn what merchants actually type for a social page into a link the API
 * accepts: "@nile.perfumes" or "nile.perfumes" → "https://instagram.com/nile.perfumes",
 * a TikTok handle gets its "@". Anything that already looks like a link (has
 * a dot followed by a path or a known host) is returned trimmed and unchanged
 * so the server stays the single judge of hosts.
 */
export function socialInputToLink(platform: BrandSocialPlatform, raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/[/:]/.test(value) || /\.(com|me|am)\b/i.test(value)) return value;
  const handle = value.replace(/^@+/, '');
  if (!/^[\w.-]{1,100}$/.test(handle)) return value;
  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
  }
}

/**
 * A WhatsApp chat link pasted into the number field ("https://wa.me/249912…",
 * "api.whatsapp.com/send?phone=…") → "+<digits>". Same rule as the
 * backend's unwrapWhatsappLink; any other input is returned unchanged.
 */
export function unwrapWhatsappLink(raw: string): string {
  const trimmed = raw.trim();
  const waMe = /^(?:https?:\/\/)?(?:www\.)?wa\.me\/\+?(\d+)\/?(?:\?.*)?$/i.exec(trimmed);
  if (waMe) return `+${waMe[1]}`;
  const apiLink = /^(?:https?:\/\/)?api\.whatsapp\.com\/send\/?\?(?:.*&)?phone=\+?(\d+)/i.exec(trimmed);
  if (apiLink) return `+${apiLink[1]}`;
  return raw;
}

/**
 * Friendly, localized message for a rejected profile save. `apiCall` has
 * already localized the envelope (lib/api-errors.ts) and kept the server's
 * English on `serverMessage`; the brand-kit service's own 400s (see
 * services/storeProfile.js) are matched here and explained in plain words
 * for the field that failed. Anything else falls back to the localized text.
 */
export function profileErrorMessage(err: unknown, t: (key: string) => string): string {
  const env = err && typeof err === 'object' ? (err as { message?: string; serverMessage?: string }) : null;
  const server = env?.serverMessage || '';
  if (/needs an Arabic text/i.test(server)) return t('storeDesign:bilingual.error.en_only');
  if (/^WhatsApp:/i.test(server)) return t('storeDesign:errors.whatsapp');
  const social = /^Invalid social link for: (\w+)/i.exec(server);
  if (social) {
    const platform = social[1].toLowerCase();
    return (BRAND_SOCIAL_PLATFORMS as readonly string[]).includes(platform)
      ? t(`storeDesign:errors.social_${platform}`)
      : t('storeDesign:errors.generic');
  }
  if (/colou?r must/i.test(server)) return t('storeDesign:errors.color');
  if (/^(Logo|Cover image) must be/i.test(server)) return t('storeDesign:errors.image');
  if (/^Store name must be/i.test(server)) return t('storeDesign:errors.store_name');
  if (typeof err === 'string') return err;
  return env?.message || t('storeDesign:errors.generic');
}
