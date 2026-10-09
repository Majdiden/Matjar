// =============================================================================
// URL slugs (product / category / collection / page / menu handles).
//
// The single backend slug implementation. Merchants (mostly Arabic speakers)
// never have to invent a slug: we derive a readable Latin one from whatever
// name they typed, Arabic included ("عطر الورد" → "atr-alward").
//
// The Arabic → Latin mapping is a port of dashboard/src/lib/storeLink.ts
// (`transliterateArabic`, `cleanInput`, `slugifyLink`) so the dashboard's live
// link preview equals what the server stores. KEEP THE TWO IN SYNC —
// tests/unit/slugifyParity.test.js fails when they drift.
// =============================================================================
import crypto from "node:crypto";

/** Default cap; matches the product/page slug validators (max 100). */
export const SLUG_MAX_LENGTH = 100;
// Uniqueness probing: -2, -3, … then a random suffix so we always finish.
const UNIQUE_SLUG_MAX_ATTEMPTS = 50;
const FALLBACK_RANDOM_BYTES = 3; // → 6 hex chars ("product-3f9a1c")

// ─── Arabic → Latin (mirror of storeLink.ts) ─────────────────────────────────
// Readable, not scholarly: everyday Sudanese spelling in Latin letters
// (ق → g as in "Gadarif", ذ → z as spoken).
const ARABIC_LETTERS = {
  "ا": "a", "أ": "a", "إ": "e", "آ": "a", "ٱ": "a", "ء": "", "ؤ": "o", "ئ": "e",
  "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "z",
  "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z",
  "ع": "a", "غ": "gh", "ف": "f", "ق": "g", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "ة": "a", "ى": "a", "پ": "p", "چ": "ch", "ڤ": "v", "گ": "g", "ک": "k", "ی": "i",
};
// و / ي are consonants at the start of a word (ward, yasmin) and long vowels
// inside it (nour → "nor", zein → "zin").
const ARABIC_SEMIVOWELS = {
  "و": ["w", "o"],
  "ي": ["y", "i"],
};
const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g; // incl. tatweel
const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/g;
const LATIN_COMBINING_MARKS = /[̀-ͯ]/g;

// Invisible formatting characters (Unicode "Cf": bidi marks/isolates,
// zero-width joiners, BOM) that Arabic-interface apps wrap copied text in.
const INVISIBLE_FORMAT_CHARS = /\p{Cf}/gu;
const UNICODE_SPACES = /[\s  -   　]+/g;

/** Strip invisible formatting characters and normalise spaces. */
export const cleanInput = (text) =>
  String(text ?? "").replace(INVISIBLE_FORMAT_CHARS, "").replace(UNICODE_SPACES, " ").trim();

/** Transliterate Arabic letters/digits to Latin; other characters pass through. */
export function transliterateArabic(text) {
  const cleaned = String(text ?? "")
    .replace(ARABIC_DIACRITICS, "")
    .replace(ARABIC_INDIC_DIGIT, (d) => String(d.charCodeAt(0) & 0xf));
  let out = "";
  let prevIsArabicLetter = false;
  for (const ch of cleaned) {
    const semivowel = ARABIC_SEMIVOWELS[ch];
    if (semivowel) {
      out += prevIsArabicLetter ? semivowel[1] : semivowel[0];
      prevIsArabicLetter = true;
    } else if (Object.hasOwn(ARABIC_LETTERS, ch)) {
      out += ARABIC_LETTERS[ch];
      prevIsArabicLetter = true;
    } else {
      out += ch;
      prevIsArabicLetter = false;
    }
  }
  return out;
}

const trimHyphens = (s) => s.replace(/^-+|-+$/g, "");

/**
 * Any name (Arabic, English, mixed) or a merchant-typed slug → URL slug:
 * lowercase `[a-z0-9]` segments joined by single hyphens, at most
 * `maxLength` chars, never a leading/trailing hyphen. May return "" when
 * nothing usable is left (e.g. only emoji) — callers fall back.
 */
export function slugify(input, { maxLength = SLUG_MAX_LENGTH } = {}) {
  const latin = transliterateArabic(cleanInput(input).toLowerCase())
    .normalize("NFKD")
    .replace(LATIN_COMBINING_MARKS, "")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-");
  return trimHyphens(trimHyphens(latin).slice(0, maxLength));
}

/** "product-3f9a1c" — used when a name yields no slug at all. */
export const randomSlug = (prefix) =>
  `${prefix}-${crypto.randomBytes(FALLBACK_RANDOM_BYTES).toString("hex")}`;

/**
 * First free slug for `base`: base, base-2, base-3, … `exists(candidate)`
 * reports whether a candidate is taken (callers scope it to the tenant and,
 * on update, exclude the document itself). An empty base becomes
 * `<fallback>-<6 hex>` so a slug always exists. Suffixed candidates are kept
 * within `maxLength`. The unique index stays the final authority under races.
 */
export async function ensureUniqueSlug(
  exists,
  base,
  { fallback = "item", maxLength = SLUG_MAX_LENGTH } = {}
) {
  const root = base || randomSlug(fallback);
  for (let n = 1; n <= UNIQUE_SLUG_MAX_ATTEMPTS; n++) {
    const suffix = n === 1 ? "" : `-${n}`;
    const candidate = `${trimHyphens(root.slice(0, maxLength - suffix.length))}${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(candidate))) return candidate;
  }
  const tail = randomSlug("").slice(1); // "-3f9a1c" without the leading dash
  return `${trimHyphens(root.slice(0, maxLength - tail.length - 1))}-${tail}`;
}
