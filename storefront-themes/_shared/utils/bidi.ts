/**
 * Merchant text in the right reading order everywhere (PBI 10-49).
 *
 * A product named «1000جرام بخور عنبر ملكي» shown in an English page has its
 * leading number pushed to the far side of the Arabic words: the page's
 * left-to-right direction wins for the number. Wrapping such text in a
 * first-strong isolate (U+2068 … U+2069) lets it take the direction of its
 * own first letter wherever it is rendered — card, product page, cart,
 * search, alt text — like `dir="auto"`, without touching every component.
 * Latin-only text is left untouched.
 *
 * Pure: unit tested directly.
 */

const FSI = '⁨';
const PDI = '⁩';
/** Hebrew, Arabic, Syriac, Thaana, NKo and the Arabic presentation forms. */
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

/** The text isolated when it holds right-to-left letters (idempotent). */
export function isolateBidi<T>(text: T): T {
  if (typeof text !== 'string' || !text || !RTL_CHAR.test(text)) return text;
  if (text.startsWith(FSI) && text.endsWith(PDI)) return text;
  return `${FSI}${text}${PDI}` as unknown as T;
}

/** The text without the isolate marks (for comparing, searching, sending). */
export const stripBidi = (text: string): string => String(text ?? '').replace(/[⁦-⁩]/g, '');
