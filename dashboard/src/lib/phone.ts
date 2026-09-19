/**
 * Pure phone helpers — mirror the backend rules in `utils/phone.js` so the
 * signup / profile forms catch mistakes on the field instead of at submit.
 *
 *   - Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits map to ASCII.
 *   - Spaces, dashes, dots and parentheses are ignored.
 *   - A leading "+<dial>" / "00<dial>" for the SAME country is stripped; a
 *     different dial code is rejected (the country selector wins).
 *   - ONE leading trunk "0" is stripped (0912345678 → 912345678).
 *   - National digits must fall within [minDigits, maxDigits].
 */

import type { TFunction } from 'i18next';

export interface PhoneValue {
  /** ISO-3166 alpha-2 of the selected dial code. */
  country: string;
  /** National digits as typed (normalised on validate/submit). */
  national: string;
}

export interface PhoneCountry {
  iso2: string;
  name: string;
  nameAr?: string;
  dialCode: string;
  minDigits: number;
  maxDigits: number;
}

export type PhoneErrorReason =
  | 'empty'
  | 'invalid-characters'
  | 'wrong-country'
  | 'too-short'
  | 'too-long'
  | 'no-country';

export type NormalizeResult =
  | { ok: true; national: string; e164: string }
  | { ok: false; reason: PhoneErrorReason };

/** Launch-market fallback when the countries endpoint is unreachable. */
export const FALLBACK_PHONE_COUNTRY: PhoneCountry = {
  iso2: 'SD',
  name: 'Sudan',
  nameAr: 'السودان',
  dialCode: '+249',
  minDigits: 9,
  maxDigits: 9,
};

const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;

export function toAsciiDigits(input: string): string {
  return String(input || '').replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const base = code >= EASTERN_ARABIC_INDIC_ZERO ? EASTERN_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
    return String(code - base);
  });
}

const dialDigits = (dialCode: string) => String(dialCode || '').replace(/\D/g, '');

export function normalizeNational(raw: string, country: PhoneCountry | null | undefined): NormalizeResult {
  if (!country || !country.dialCode) return { ok: false, reason: 'no-country' };
  const cleaned = toAsciiDigits(raw).replace(/[\s\-().]/g, '');
  if (!cleaned) return { ok: false, reason: 'empty' };
  if (!/^(\+|00)?\d+$/.test(cleaned)) return { ok: false, reason: 'invalid-characters' };

  const dial = dialDigits(country.dialCode);
  let digits = cleaned;
  if (digits.startsWith('+') || digits.startsWith('00')) {
    digits = digits.startsWith('+') ? digits.slice(1) : digits.slice(2);
    if (!digits.startsWith(dial)) return { ok: false, reason: 'wrong-country' };
    digits = digits.slice(dial.length);
  }
  if (digits.length > 1 && digits.startsWith('0')) digits = digits.slice(1);

  const min = Number(country.minDigits) || 4;
  const max = Number(country.maxDigits) || 15;
  if (digits.length < min) return { ok: false, reason: 'too-short' };
  if (digits.length > max) return { ok: false, reason: 'too-long' };
  return { ok: true, national: digits, e164: `+${dial}${digits}` };
}

/** Split a stored E.164 number into { iso2, national } by longest dial-code match. */
export function splitE164(
  e164: string | null | undefined,
  countries: PhoneCountry[],
  preferIso2?: string | null,
): { iso2: string | null; national: string } {
  const value = String(e164 || '');
  if (!/^\+[1-9]\d{4,14}$/.test(value)) {
    return { iso2: null, national: value.replace(/\D/g, '') };
  }
  const digits = value.slice(1);
  let best: PhoneCountry | null = null;
  for (const c of countries) {
    const dial = dialDigits(c.dialCode);
    if (!dial || !digits.startsWith(dial)) continue;
    const bestLen = best ? dialDigits(best.dialCode).length : -1;
    if (!best || dial.length > bestLen || (dial.length === bestLen && c.iso2 === preferIso2)) best = c;
  }
  if (!best) return { iso2: null, national: digits };
  return { iso2: best.iso2, national: digits.slice(dialDigits(best.dialCode).length) };
}

/**
 * Translated validation message for a phone value, or null when valid.
 * Mirrors the backend normalisation so a bad number is caught on the field.
 */
export function validatePhoneValue(
  value: PhoneValue,
  countries: PhoneCountry[],
  t: TFunction,
): string | null {
  const country = countries.find((c) => c.iso2 === value.country) || countries[0] || null;
  const res = normalizeNational(value.national, country);
  if (res.ok) return null;
  const digits = country
    ? `${country.minDigits}${country.minDigits !== country.maxDigits ? `–${country.maxDigits}` : ''}`
    : '';
  switch (res.reason) {
    case 'empty':
      return t('auth:auth.field.phone.error.required');
    case 'too-short':
      return t('auth:auth.field.phone.error.too_short', { digits });
    case 'too-long':
      return t('auth:auth.field.phone.error.too_long', { digits });
    case 'wrong-country':
      return t('auth:auth.field.phone.error.wrong_country', { dialCode: country?.dialCode || '' });
    default:
      return t('auth:auth.field.phone.error.invalid');
  }
}
