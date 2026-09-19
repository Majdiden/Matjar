/**
 * Pure phone-number helpers (no DB, no config) — normalise merchant-entered
 * numbers to E.164 against a country definition, and split a stored E.164
 * back into { country, national } for editing forms.
 *
 * A "country" here is `{ iso2, dialCode: "+249", minDigits, maxDigits }`
 * (see config/phoneCountries.js). Rules are deliberately simple and
 * predictable rather than a full libphonenumber port:
 *
 *   - Arabic-Indic and Eastern Arabic-Indic digits are mapped to ASCII so a
 *     merchant typing "٠٩١٢٣٤٥٦٧٨" on an Arabic keyboard is accepted.
 *   - Spaces, dashes, dots and parentheses are ignored.
 *   - A leading "+<dial>" or "00<dial>" for the SAME country is stripped
 *     (so pasting "+249 912 345 678" into the Sudan field works). A DIFFERENT
 *     dial code is rejected — the country selector is the source of truth.
 *   - A single leading trunk "0" is stripped (Sudanese numbers are commonly
 *     written 0912345678).
 *   - The remaining national digits must fall within [minDigits, maxDigits].
 */

const ARABIC_INDIC_ZERO = 0x0660; // ٠
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0; // ۰

/** Map Arabic-Indic / Eastern Arabic-Indic digits to ASCII digits. */
export function toAsciiDigits(input) {
  return String(input || "").replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const base = code >= EASTERN_ARABIC_INDIC_ZERO ? EASTERN_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
    return String(code - base);
  });
}

function dialDigits(dialCode) {
  return String(dialCode || "").replace(/\D/g, "");
}

/**
 * Normalise a raw phone input for the given country.
 *
 * @returns {{ ok: true, e164: string, national: string } | { ok: false, reason: string }}
 *   reason ∈ "empty" | "invalid-characters" | "wrong-country" | "too-short" | "too-long"
 */
export function normalizePhone(raw, country) {
  if (!country || !country.dialCode) {
    return { ok: false, reason: "no-country" };
  }
  const cleaned = toAsciiDigits(raw).replace(/[\s\-().]/g, "");
  if (!cleaned) return { ok: false, reason: "empty" };
  if (!/^(\+|00)?\d+$/.test(cleaned)) return { ok: false, reason: "invalid-characters" };

  const dial = dialDigits(country.dialCode);
  let digits = cleaned;

  // International prefix present → it must be THIS country's dial code.
  if (digits.startsWith("+") || digits.startsWith("00")) {
    digits = digits.startsWith("+") ? digits.slice(1) : digits.slice(2);
    if (!digits.startsWith(dial)) return { ok: false, reason: "wrong-country" };
    digits = digits.slice(dial.length);
  }

  // Trunk prefix (a single leading 0) is not part of the E.164 number.
  if (digits.length > 1 && digits.startsWith("0")) digits = digits.slice(1);

  const min = Number(country.minDigits) || 4;
  const max = Number(country.maxDigits) || 15;
  if (digits.length < min) return { ok: false, reason: "too-short" };
  if (digits.length > max) return { ok: false, reason: "too-long" };

  return { ok: true, e164: `+${dial}${digits}`, national: digits };
}

/** True when `value` looks like an E.164 number (+ followed by 5–15 digits). */
export function isE164(value) {
  return /^\+[1-9]\d{4,14}$/.test(String(value || ""));
}

/**
 * Split a stored E.164 number back into its country + national digits using
 * the longest matching dial code from `countries`. When `preferIso2` is
 * given and matches, it wins ties (e.g. +1 → US vs CA).
 *
 * @returns {{ iso2: string|null, dialCode: string|null, national: string }}
 */
export function splitE164(e164, countries = [], preferIso2 = null) {
  const value = String(e164 || "");
  if (!isE164(value)) return { iso2: null, dialCode: null, national: value.replace(/\D/g, "") };
  const digits = value.slice(1);
  let best = null;
  for (const c of countries) {
    const dial = dialDigits(c.dialCode);
    if (!dial || !digits.startsWith(dial)) continue;
    const better =
      !best ||
      dial.length > dialDigits(best.dialCode).length ||
      (dial.length === dialDigits(best.dialCode).length && c.iso2 === preferIso2);
    if (better) best = c;
  }
  if (!best) return { iso2: null, dialCode: null, national: digits };
  return { iso2: best.iso2, dialCode: best.dialCode, national: digits.slice(dialDigits(best.dialCode).length) };
}
