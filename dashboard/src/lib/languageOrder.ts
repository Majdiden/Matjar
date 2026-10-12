/**
 * Which language's field comes first in a form (one rule for the whole
 * dashboard): the current UI language first, then the other one. In the
 * Arabic dashboard a pair reads "Arabic, English"; in the English dashboard
 * "English, Arabic". The order never changes where a value is saved; the
 * load/save helpers further down do that, the same way for every form.
 *
 * Each input still follows its own language's direction (Arabic rtl, English
 * ltr), whatever the page direction is: see `langDir`.
 *
 * Kept free of React/i18next so tests/unit can import it directly; components
 * use hooks/useLanguageOrder.ts.
 */

export type FieldLang = 'ar' | 'en';

/** UI language from an i18next language code ('ar', 'ar-SD', 'en-US'…). Arabic when unknown. */
export function uiLang(language?: string | null): FieldLang {
  const code = (language || 'ar').toLowerCase();
  return code.startsWith('ar') ? 'ar' : code.startsWith('en') ? 'en' : 'ar';
}

/** ['ar', 'en'] in the Arabic UI, ['en', 'ar'] in the English UI. */
export function languageOrder(language?: string | null): [FieldLang, FieldLang] {
  return uiLang(language) === 'ar' ? ['ar', 'en'] : ['en', 'ar'];
}

/**
 * The same items, with those in the UI language first. Items keep their
 * relative order within each language (a stable reorder), so a group like
 * [en title, en body, ar title, ar body] becomes [ar title, ar body, en title,
 * en body] in the Arabic UI.
 */
export function uiLanguageFirst<T extends { lang: FieldLang }>(items: readonly T[], language?: string | null): T[] {
  const first = uiLang(language);
  return [...items.filter((i) => i.lang === first), ...items.filter((i) => i.lang !== first)];
}

/** Text direction for an input written in `lang`. */
export const langDir = (lang: FieldLang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');

// ── One box per language ─────────────────────────────────────────────────
//
// Products, categories, content sections and menu items keep a base field
// (`name`, `label`…) that the storefront falls back to, plus per-language
// `translations.ar.X` / `translations.en.X` that it shows first. The forms
// edit exactly one Arabic and one English box; these helpers turn stored data
// into those two boxes and back.

/** The two boxes of one field. */
export interface LangText {
  ar: string;
  en: string;
}

export const EMPTY_LANG_TEXT: LangText = Object.freeze({ ar: '', en: '' }) as LangText;

const ARABIC_LETTERS = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** Does the text contain any Arabic letter? */
export const hasArabicLetters = (text?: string | null): boolean => ARABIC_LETTERS.test(text || '');

/** Store language from tenant settings ('ar', 'ar-SD', 'en-US'…). Arabic when unknown, as on the server. */
export function storeLanguage(language?: string | null): FieldLang {
  return (language || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
}

/**
 * Stored data → the two boxes. A translation wins; otherwise the base value
 * goes to the box of the language it is written in. Covers every legacy
 * shape: quick add (Arabic in base only), the old forms (English base +
 * `translations.ar`) and seeded menus (store language in base +
 * `translations.en`).
 */
export function splitByLanguage(
  base: string | null | undefined,
  translations?: { ar?: string | null; en?: string | null } | null,
): LangText {
  const b = base || '';
  const arabicBase = hasArabicLetters(b);
  return {
    ar: translations?.ar || (arabicBase ? b : ''),
    en: translations?.en || (!arabicBase ? b : ''),
  };
}

type Translated<K extends string> = Partial<Record<K, unknown>> & {
  translations?: Partial<Record<FieldLang, Partial<Record<K, unknown>> | null | undefined>> | null;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** `splitByLanguage` for field `key` of a stored document (product, category, menu item…). */
export function readLangText<K extends string>(doc: Translated<K> | null | undefined, key: K): LangText {
  return splitByLanguage(str(doc?.[key]), {
    ar: str(doc?.translations?.ar?.[key]),
    en: str(doc?.translations?.en?.[key]),
  });
}

/**
 * The two boxes → what to store, trimmed: both translations written out
 * (an emptied box clears its translation with ''), and the base set to the
 * store language's text, or the other language's when that box is empty.
 */
export function writeLangText(value: LangText, storeLang: FieldLang): { base: string; ar: string; en: string } {
  const ar = (value.ar || '').trim();
  const en = (value.en || '').trim();
  return { ar, en, base: storeLang === 'ar' ? ar || en : en || ar };
}

/**
 * Several fields at once → `{ base: { name, … }, translations: { ar: {…}, en: {…} } }`,
 * ready to spread into a payload.
 */
export function writeLangFields<K extends string>(
  fields: Record<K, LangText>,
  storeLang: FieldLang,
): { base: Record<K, string>; translations: { ar: Record<K, string>; en: Record<K, string> } } {
  const base = {} as Record<K, string>;
  const ar = {} as Record<K, string>;
  const en = {} as Record<K, string>;
  for (const key of Object.keys(fields) as K[]) {
    const out = writeLangText(fields[key], storeLang);
    base[key] = out.base;
    ar[key] = out.ar;
    en[key] = out.en;
  }
  return { base, translations: { ar, en } };
}

/** Both boxes empty (after trimming)? */
export const isLangTextEmpty = (value: LangText): boolean => !(value.ar || '').trim() && !(value.en || '').trim();

/** Text to show for a field in `language` (UI or shopper), the other language as fallback. */
export function langTextIn(value: LangText, language?: string | null): string {
  const first = uiLang(language);
  const other: FieldLang = first === 'ar' ? 'en' : 'ar';
  return (value[first] || '').trim() || (value[other] || '').trim();
}
