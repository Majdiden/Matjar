/**
 * Brand kit (PBI 10) — pure normalisation rules, no DB, no config.
 *
 * The brand kit is the set of facts a merchant gives us once (tagline, cover
 * photo, colour, WhatsApp, city, opening hours) and every theme can read
 * (`tenant.settings.brand`). Values are rendered by themes straight into
 * `src`, `href` and CSS, so every write goes through these helpers:
 *
 *   - images are absolute `https:` URLs or our own root-relative
 *     "/uploads/..." paths — never `javascript:`, `data:`, `http:` or
 *     protocol-relative ("//evil.example");
 *   - the colour is "#rrggbb", stored lowercase;
 *   - bilingual text is `{ ar, en }` (Arabic primary, English optional),
 *     trimmed, length-capped, and an empty language is dropped rather than
 *     stored as "";
 *   - WhatsApp is stored E.164 — the country-aware normalisation lives in
 *     services/storeProfile.js (it needs the operator's phone countries);
 *     this file only unwraps a pasted wa.me link and checks the stored form.
 *
 * `publicBrand` re-applies the same rules on read, so legacy or hand-edited
 * values never reach a theme (same convention as utils/socialLinks.js).
 */
import { isE164 } from "./phone.js";

/** Languages of a bilingual brand text. Arabic first: it is the primary one. */
export const BRAND_TEXT_LANGS = Object.freeze(["ar", "en"]);
/** Arabic is required whenever a bilingual text is set; English is optional. */
export const BRAND_TEXT_REQUIRED_LANG = "ar";

/** Bilingual brand fields → max length per language (after trimming). */
export const BRAND_TEXT_MAX_LENGTH = Object.freeze({
  tagline: 140,
  city: 80,
  hours: 200,
});

export const BRAND_TEXT_FIELDS = Object.freeze(Object.keys(BRAND_TEXT_MAX_LENGTH));

/** Max stored image URL length (cover photo, logo). */
export const BRAND_IMAGE_URL_MAX_LENGTH = 2048;

/** Root-relative prefix of files served by our own upload pipeline. */
export const UPLOADS_PATH_PREFIX = "/uploads/";

export const BRAND_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/** Public brand keys, in the order themes receive them. */
export const BRAND_PUBLIC_FIELDS = Object.freeze([
  "tagline",
  "coverImage",
  "color",
  "whatsapp",
  "city",
  "hours",
]);

/** True for null/undefined and whitespace-only strings — "clear this field". */
export const isBlankBrandValue = (value) =>
  value == null || (typeof value === "string" && !value.trim());

/** "#A1B2C3" → "#a1b2c3"; null when not a 6-digit hex colour. */
export function normalizeBrandColor(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return BRAND_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

/**
 * Image URL a theme may put in `src`: absolute https, or our own
 * "/uploads/..." path. Returns the normalised URL or null.
 */
export function normalizeBrandImageUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > BRAND_IMAGE_URL_MAX_LENGTH) return null;

  if (trimmed.startsWith("/")) {
    // Root-relative: only our upload paths, no traversal, no backslashes
    // (some browsers read "/\evil.example" as protocol-relative).
    if (!trimmed.startsWith(UPLOADS_PATH_PREFIX)) return null;
    if (trimmed.includes("\\") || trimmed.includes("..") || trimmed.includes("//")) return null;
    return trimmed;
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const out = url.toString();
  return out.length > BRAND_IMAGE_URL_MAX_LENGTH ? null : out;
}

/**
 * Normalise a `{ ar, en }` text for one brand field. Each language is
 * trimmed; an empty one is dropped. Returns `{ value, invalid }` — `value` is
 * null when nothing is left (null/"" input clears), `invalid` lists the
 * languages that were not strings or exceeded the field's max length, plus
 * "ar" when only English was given (Arabic is required, English optional) —
 * or the field itself when the input is not a `{ ar, en }` object.
 */
export function normalizeBilingualText(field, input) {
  const max = BRAND_TEXT_MAX_LENGTH[field];
  const value = {};
  const invalid = [];
  if (!max) return { value: null, invalid: [field] };
  if (isBlankBrandValue(input)) return { value: null, invalid };
  if (typeof input !== "object" || Array.isArray(input)) return { value: null, invalid: [field] };
  for (const lang of BRAND_TEXT_LANGS) {
    const raw = input[lang];
    if (isBlankBrandValue(raw)) continue;
    if (typeof raw !== "string" || raw.trim().length > max) {
      invalid.push(lang);
      continue;
    }
    value[lang] = raw.trim();
  }
  if (Object.keys(value).length && !value[BRAND_TEXT_REQUIRED_LANG] && !invalid.includes(BRAND_TEXT_REQUIRED_LANG)) {
    invalid.push(BRAND_TEXT_REQUIRED_LANG);
  }
  return { value: Object.keys(value).length ? value : null, invalid };
}

/**
 * A WhatsApp value may arrive as a pasted chat link ("https://wa.me/249912…",
 * "wa.me/+249…", "api.whatsapp.com/send?phone=249…"). Unwrap it to
 * "+<digits>" so the phone normaliser sees an international number; any
 * other input is returned trimmed and unchanged.
 */
export function unwrapWhatsappLink(raw) {
  const trimmed = String(raw ?? "").trim();
  const waMe = /^(?:https?:\/\/)?(?:www\.)?wa\.me\/\+?(\d+)\/?(?:\?.*)?$/i.exec(trimmed);
  if (waMe) return `+${waMe[1]}`;
  const api = /^(?:https?:\/\/)?api\.whatsapp\.com\/send\/?\?(?:.*&)?phone=\+?(\d+)/i.exec(trimmed);
  if (api) return `+${api[1]}`;
  return trimmed;
}

/**
 * Public storefront view of the stored brand kit: only non-empty values that
 * still pass the write rules, or null when nothing is set. Themes treat a
 * present key as "the merchant set this", so empty or invalid values must
 * never reach them.
 */
export function publicBrand(stored) {
  if (!stored || typeof stored !== "object") return null;
  const out = {};
  for (const field of BRAND_TEXT_FIELDS) {
    const { value } = normalizeBilingualText(field, stored[field]);
    if (value) out[field] = value;
  }
  const coverImage = normalizeBrandImageUrl(stored.coverImage);
  if (coverImage) out.coverImage = coverImage;
  const color = normalizeBrandColor(stored.color);
  if (color) out.color = color;
  if (isE164(stored.whatsapp)) out.whatsapp = stored.whatsapp;

  const ordered = {};
  for (const key of BRAND_PUBLIC_FIELDS) if (out[key] !== undefined) ordered[key] = out[key];
  return Object.keys(ordered).length ? ordered : null;
}
