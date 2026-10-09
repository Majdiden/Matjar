/**
 * Bilingual `{ ar, en? }` text helpers (PBI 10-14). Arabic is the primary
 * language and English is optional — the same rule the brand-kit API applies
 * (utils/brandKit.js). Used by components/BilingualField.tsx and its callers.
 */

export interface BilingualValue {
  ar?: string;
  en?: string;
}

export type BilingualError = 'ar_required' | 'en_only';

/** Error kind for a value, or null when it can be saved. */
export function validateBilingual(
  value: BilingualValue,
  { required = false }: { required?: boolean } = {},
): BilingualError | null {
  const ar = (value.ar || '').trim();
  const en = (value.en || '').trim();
  if (!ar && en) return 'en_only';
  if (!ar && required) return 'ar_required';
  return null;
}

/** Trimmed `{ ar, en? }`, or null when both languages are empty. */
export function cleanBilingual(value: BilingualValue): BilingualValue | null {
  const ar = (value.ar || '').trim();
  const en = (value.en || '').trim();
  if (!ar && !en) return null;
  return en ? { ar, en } : { ar };
}

/** Same text in both languages after trimming? (no save needed) */
export const sameBilingual = (a: BilingualValue | null | undefined, b: BilingualValue | null | undefined) =>
  (a?.ar || '').trim() === (b?.ar || '').trim() && (a?.en || '').trim() === (b?.en || '').trim();

