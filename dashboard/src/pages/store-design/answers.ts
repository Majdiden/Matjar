import type { AnswerText } from '../../lib/api-client';

/**
 * Helpers for the "write my page for me" questions (PBI 10 — About,
 * policies). Answers are Arabic-first `{ ar, en? }`; English is optional.
 */

/** Edit state of one answer: always both strings so inputs stay controlled. */
export interface AnswerDraft {
  ar: string;
  en: string;
}

export const EMPTY_ANSWER: AnswerDraft = { ar: '', en: '' };

export const toDraft = (value?: AnswerText | null): AnswerDraft => ({
  ar: value?.ar || '',
  en: value?.en || '',
});

/** Draft → API value: trimmed, empty languages dropped, null when nothing is left. */
export function fromDraft(draft: AnswerDraft): AnswerText | null {
  const ar = draft.ar.trim();
  const en = draft.en.trim();
  if (!ar && !en) return null;
  return { ...(ar && { ar }), ...(en && { en }) };
}

export const hasArabic = (draft: AnswerDraft) => draft.ar.trim().length > 0;

/** "٢٠١٩" / "۲۰۱۹" → "2019": phones in Sudan often type Arabic-Indic digits. */
export const toAsciiDigits = (s: string): string =>
  s.replace(/[٠-٩۰-۹]/g, (d) => String((d.charCodeAt(0) & 0xf) % 10));

/** True for the 409 the API returns when saving would replace hand edits. */
export function isEditedConflict(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: unknown }).code === 'GENERATED_PAGE_EDITED';
}

/** Routes of the "My store" hub (PBI 10-12) and the brand-kit form these screens link to. */
export const STORE_HUB_PATH = '/dashboard/store';
export const STORE_BRAND_PATH = '/dashboard/store/brand';
