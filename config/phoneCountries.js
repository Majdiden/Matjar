/**
 * Phone-country catalog — the single source of truth for the dial codes the
 * platform can offer on merchant signup / profile forms.
 *
 * The platform operator picks which of these are ENABLED (and which one is the
 * default) from the platform-admin "Phone countries" page; the effective list
 * is resolved by services/phoneCountries.js (defaults merged with the stored
 * operator config, same raw-collection pattern as feature flags).
 *
 * Sudan is the launch market, so it is the only country enabled out of the box
 * and the default selection. `minDigits`/`maxDigits` bound the NATIONAL number
 * (without the dial code, without a trunk "0") — Sudanese mobiles are 9 digits
 * (e.g. 912345678 → +249912345678).
 *
 *   iso2      ISO 3166-1 alpha-2 (uppercase) — the stable identifier
 *   dialCode  E.164 country calling code, "+" prefixed
 *   name      English display name; nameAr Arabic display name
 */
export const PHONE_COUNTRY_CATALOG = Object.freeze([
  { iso2: "SD", name: "Sudan",                nameAr: "السودان",          dialCode: "+249", minDigits: 9, maxDigits: 9 },
  { iso2: "SS", name: "South Sudan",          nameAr: "جنوب السودان",     dialCode: "+211", minDigits: 9, maxDigits: 9 },
  { iso2: "EG", name: "Egypt",                nameAr: "مصر",              dialCode: "+20",  minDigits: 9, maxDigits: 10 },
  { iso2: "SA", name: "Saudi Arabia",         nameAr: "السعودية",         dialCode: "+966", minDigits: 9, maxDigits: 9 },
  { iso2: "AE", name: "United Arab Emirates", nameAr: "الإمارات",         dialCode: "+971", minDigits: 8, maxDigits: 9 },
  { iso2: "QA", name: "Qatar",                nameAr: "قطر",              dialCode: "+974", minDigits: 8, maxDigits: 8 },
  { iso2: "KW", name: "Kuwait",               nameAr: "الكويت",           dialCode: "+965", minDigits: 8, maxDigits: 8 },
  { iso2: "BH", name: "Bahrain",              nameAr: "البحرين",          dialCode: "+973", minDigits: 8, maxDigits: 8 },
  { iso2: "OM", name: "Oman",                 nameAr: "عُمان",            dialCode: "+968", minDigits: 8, maxDigits: 8 },
  { iso2: "JO", name: "Jordan",               nameAr: "الأردن",           dialCode: "+962", minDigits: 8, maxDigits: 9 },
  { iso2: "IQ", name: "Iraq",                 nameAr: "العراق",           dialCode: "+964", minDigits: 9, maxDigits: 10 },
  { iso2: "LB", name: "Lebanon",              nameAr: "لبنان",            dialCode: "+961", minDigits: 7, maxDigits: 8 },
  { iso2: "SY", name: "Syria",                nameAr: "سوريا",            dialCode: "+963", minDigits: 8, maxDigits: 9 },
  { iso2: "YE", name: "Yemen",                nameAr: "اليمن",            dialCode: "+967", minDigits: 8, maxDigits: 9 },
  { iso2: "LY", name: "Libya",                nameAr: "ليبيا",            dialCode: "+218", minDigits: 8, maxDigits: 9 },
  { iso2: "TN", name: "Tunisia",              nameAr: "تونس",             dialCode: "+216", minDigits: 8, maxDigits: 8 },
  { iso2: "DZ", name: "Algeria",              nameAr: "الجزائر",          dialCode: "+213", minDigits: 8, maxDigits: 9 },
  { iso2: "MA", name: "Morocco",              nameAr: "المغرب",           dialCode: "+212", minDigits: 9, maxDigits: 9 },
  { iso2: "MR", name: "Mauritania",           nameAr: "موريتانيا",        dialCode: "+222", minDigits: 8, maxDigits: 8 },
  { iso2: "SO", name: "Somalia",              nameAr: "الصومال",          dialCode: "+252", minDigits: 7, maxDigits: 9 },
  { iso2: "DJ", name: "Djibouti",             nameAr: "جيبوتي",           dialCode: "+253", minDigits: 8, maxDigits: 8 },
  { iso2: "ER", name: "Eritrea",              nameAr: "إريتريا",          dialCode: "+291", minDigits: 7, maxDigits: 7 },
  { iso2: "ET", name: "Ethiopia",             nameAr: "إثيوبيا",          dialCode: "+251", minDigits: 9, maxDigits: 9 },
  { iso2: "KE", name: "Kenya",                nameAr: "كينيا",            dialCode: "+254", minDigits: 9, maxDigits: 9 },
  { iso2: "UG", name: "Uganda",               nameAr: "أوغندا",           dialCode: "+256", minDigits: 9, maxDigits: 9 },
  { iso2: "TZ", name: "Tanzania",             nameAr: "تنزانيا",          dialCode: "+255", minDigits: 9, maxDigits: 9 },
  { iso2: "RW", name: "Rwanda",               nameAr: "رواندا",           dialCode: "+250", minDigits: 9, maxDigits: 9 },
  { iso2: "TD", name: "Chad",                 nameAr: "تشاد",             dialCode: "+235", minDigits: 8, maxDigits: 8 },
  { iso2: "CF", name: "Central African Republic", nameAr: "أفريقيا الوسطى", dialCode: "+236", minDigits: 8, maxDigits: 8 },
  { iso2: "NG", name: "Nigeria",              nameAr: "نيجيريا",          dialCode: "+234", minDigits: 10, maxDigits: 10 },
  { iso2: "GH", name: "Ghana",                nameAr: "غانا",             dialCode: "+233", minDigits: 9, maxDigits: 9 },
  { iso2: "ZA", name: "South Africa",         nameAr: "جنوب أفريقيا",     dialCode: "+27",  minDigits: 9, maxDigits: 9 },
  { iso2: "TR", name: "Turkey",               nameAr: "تركيا",            dialCode: "+90",  minDigits: 10, maxDigits: 10 },
  { iso2: "PK", name: "Pakistan",             nameAr: "باكستان",          dialCode: "+92",  minDigits: 10, maxDigits: 10 },
  { iso2: "IN", name: "India",                nameAr: "الهند",            dialCode: "+91",  minDigits: 10, maxDigits: 10 },
  { iso2: "BD", name: "Bangladesh",           nameAr: "بنغلاديش",         dialCode: "+880", minDigits: 10, maxDigits: 10 },
  { iso2: "MY", name: "Malaysia",             nameAr: "ماليزيا",          dialCode: "+60",  minDigits: 9, maxDigits: 10 },
  { iso2: "GB", name: "United Kingdom",       nameAr: "المملكة المتحدة",  dialCode: "+44",  minDigits: 10, maxDigits: 10 },
  { iso2: "IE", name: "Ireland",              nameAr: "أيرلندا",          dialCode: "+353", minDigits: 9, maxDigits: 9 },
  { iso2: "DE", name: "Germany",              nameAr: "ألمانيا",          dialCode: "+49",  minDigits: 10, maxDigits: 11 },
  { iso2: "FR", name: "France",               nameAr: "فرنسا",            dialCode: "+33",  minDigits: 9, maxDigits: 9 },
  { iso2: "NL", name: "Netherlands",          nameAr: "هولندا",           dialCode: "+31",  minDigits: 9, maxDigits: 9 },
  { iso2: "SE", name: "Sweden",               nameAr: "السويد",           dialCode: "+46",  minDigits: 9, maxDigits: 9 },
  { iso2: "NO", name: "Norway",               nameAr: "النرويج",          dialCode: "+47",  minDigits: 8, maxDigits: 8 },
  { iso2: "US", name: "United States",        nameAr: "الولايات المتحدة", dialCode: "+1",   minDigits: 10, maxDigits: 10 },
  { iso2: "CA", name: "Canada",               nameAr: "كندا",             dialCode: "+1",   minDigits: 10, maxDigits: 10 },
  { iso2: "AU", name: "Australia",            nameAr: "أستراليا",         dialCode: "+61",  minDigits: 9, maxDigits: 9 },
]);

/** ISO2 of the country enabled + selected by default on a fresh platform. */
export const DEFAULT_PHONE_COUNTRY = "SD";

/** Countries enabled on a fresh platform (operator opens more from the admin). */
export const DEFAULT_ENABLED_PHONE_COUNTRIES = Object.freeze([DEFAULT_PHONE_COUNTRY]);

/** Sanity bounds for operator-entered custom countries. */
export const PHONE_DIGIT_BOUNDS = Object.freeze({ min: 4, max: 15 });

export function getCatalogCountry(iso2) {
  const key = String(iso2 || "").toUpperCase();
  return PHONE_COUNTRY_CATALOG.find((c) => c.iso2 === key) || null;
}
