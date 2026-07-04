/**
 * Shared location data for storefront address forms (checkout + account).
 *
 * The platform's primary market is Sudan, so Sudan is the default/top country
 * and ships with a full state + major-city list. Other countries fall back to
 * a free-text city input (no city list defined).
 *
 * The stored `value` is the canonical English name for both country and city —
 * this keeps the submitted order/address payload a plain human-readable string
 * (unchanged field shape: `country` / `city`) regardless of the UI language.
 * Labels are localised (en/ar) purely for display.
 */

export interface LocalizedOption {
  /** Canonical value stored in the payload (English name). */
  value: string;
  en: string;
  ar: string;
}

/** Return the display label for the active language. */
export function locationLabel(opt: LocalizedOption, lang: string): string {
  return lang.startsWith('ar') ? opt.ar : opt.en;
}

// Sudan first (primary market), then a reasonable common-country list.
export const COUNTRIES: LocalizedOption[] = [
  { value: 'Sudan', en: 'Sudan', ar: 'السودان' },
  { value: 'Saudi Arabia', en: 'Saudi Arabia', ar: 'السعودية' },
  { value: 'United Arab Emirates', en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة' },
  { value: 'Qatar', en: 'Qatar', ar: 'قطر' },
  { value: 'Kuwait', en: 'Kuwait', ar: 'الكويت' },
  { value: 'Bahrain', en: 'Bahrain', ar: 'البحرين' },
  { value: 'Oman', en: 'Oman', ar: 'عُمان' },
  { value: 'Egypt', en: 'Egypt', ar: 'مصر' },
  { value: 'Jordan', en: 'Jordan', ar: 'الأردن' },
  { value: 'Lebanon', en: 'Lebanon', ar: 'لبنان' },
  { value: 'Iraq', en: 'Iraq', ar: 'العراق' },
  { value: 'Syria', en: 'Syria', ar: 'سوريا' },
  { value: 'Yemen', en: 'Yemen', ar: 'اليمن' },
  { value: 'Libya', en: 'Libya', ar: 'ليبيا' },
  { value: 'Tunisia', en: 'Tunisia', ar: 'تونس' },
  { value: 'Algeria', en: 'Algeria', ar: 'الجزائر' },
  { value: 'Morocco', en: 'Morocco', ar: 'المغرب' },
  { value: 'Chad', en: 'Chad', ar: 'تشاد' },
  { value: 'South Sudan', en: 'South Sudan', ar: 'جنوب السودان' },
  { value: 'Ethiopia', en: 'Ethiopia', ar: 'إثيوبيا' },
  { value: 'Eritrea', en: 'Eritrea', ar: 'إريتريا' },
  { value: 'Kenya', en: 'Kenya', ar: 'كينيا' },
  { value: 'Uganda', en: 'Uganda', ar: 'أوغندا' },
  { value: 'Nigeria', en: 'Nigeria', ar: 'نيجيريا' },
  { value: 'Ghana', en: 'Ghana', ar: 'غانا' },
  { value: 'South Africa', en: 'South Africa', ar: 'جنوب أفريقيا' },
  { value: 'Turkey', en: 'Turkey', ar: 'تركيا' },
  { value: 'United States', en: 'United States', ar: 'الولايات المتحدة' },
  { value: 'United Kingdom', en: 'United Kingdom', ar: 'المملكة المتحدة' },
  { value: 'Canada', en: 'Canada', ar: 'كندا' },
  { value: 'Australia', en: 'Australia', ar: 'أستراليا' },
  { value: 'Germany', en: 'Germany', ar: 'ألمانيا' },
  { value: 'France', en: 'France', ar: 'فرنسا' },
  { value: 'Spain', en: 'Spain', ar: 'إسبانيا' },
  { value: 'Italy', en: 'Italy', ar: 'إيطاليا' },
  { value: 'Netherlands', en: 'Netherlands', ar: 'هولندا' },
  { value: 'Sweden', en: 'Sweden', ar: 'السويد' },
  { value: 'Switzerland', en: 'Switzerland', ar: 'سويسرا' },
  { value: 'India', en: 'India', ar: 'الهند' },
  { value: 'Pakistan', en: 'Pakistan', ar: 'باكستان' },
  { value: 'Bangladesh', en: 'Bangladesh', ar: 'بنغلاديش' },
  { value: 'China', en: 'China', ar: 'الصين' },
  { value: 'Japan', en: 'Japan', ar: 'اليابان' },
  { value: 'Malaysia', en: 'Malaysia', ar: 'ماليزيا' },
  { value: 'Indonesia', en: 'Indonesia', ar: 'إندونيسيا' },
  { value: 'Brazil', en: 'Brazil', ar: 'البرازيل' },
];

// Sudan's 18 states plus its major cities. Values are unique English names.
export const SUDAN_LOCATIONS: LocalizedOption[] = [
  // 18 states
  { value: 'Khartoum', en: 'Khartoum', ar: 'الخرطوم' },
  { value: 'Al Jazirah', en: 'Al Jazirah', ar: 'الجزيرة' },
  { value: 'Red Sea', en: 'Red Sea', ar: 'البحر الأحمر' },
  { value: 'Kassala', en: 'Kassala', ar: 'كسلا' },
  { value: 'Gedaref', en: 'Gedaref', ar: 'القضارف' },
  { value: 'White Nile', en: 'White Nile', ar: 'النيل الأبيض' },
  { value: 'Blue Nile', en: 'Blue Nile', ar: 'النيل الأزرق' },
  { value: 'Northern', en: 'Northern', ar: 'الشمالية' },
  { value: 'River Nile', en: 'River Nile', ar: 'نهر النيل' },
  { value: 'North Darfur', en: 'North Darfur', ar: 'شمال دارفور' },
  { value: 'South Darfur', en: 'South Darfur', ar: 'جنوب دارفور' },
  { value: 'West Darfur', en: 'West Darfur', ar: 'غرب دارفور' },
  { value: 'East Darfur', en: 'East Darfur', ar: 'شرق دارفور' },
  { value: 'Central Darfur', en: 'Central Darfur', ar: 'وسط دارفور' },
  { value: 'North Kordofan', en: 'North Kordofan', ar: 'شمال كردفان' },
  { value: 'South Kordofan', en: 'South Kordofan', ar: 'جنوب كردفان' },
  { value: 'West Kordofan', en: 'West Kordofan', ar: 'غرب كردفان' },
  { value: 'Sennar', en: 'Sennar', ar: 'سنار' },
  // Major cities
  { value: 'Omdurman', en: 'Omdurman', ar: 'أم درمان' },
  { value: 'Bahri', en: 'Bahri (Khartoum North)', ar: 'بحري (الخرطوم بحري)' },
  { value: 'Port Sudan', en: 'Port Sudan', ar: 'بورتسودان' },
  { value: 'El Obeid', en: 'El Obeid', ar: 'الأبيض' },
  { value: 'Nyala', en: 'Nyala', ar: 'نيالا' },
  { value: 'Wad Madani', en: 'Wad Madani', ar: 'ود مدني' },
  { value: 'Kosti', en: 'Kosti', ar: 'كوستي' },
  { value: 'El Fasher', en: 'El Fasher', ar: 'الفاشر' },
  { value: 'Ad-Damazin', en: 'Ad-Damazin', ar: 'الدمازين' },
  { value: 'Atbara', en: 'Atbara', ar: 'عطبرة' },
  { value: 'Dongola', en: 'Dongola', ar: 'دنقلا' },
  { value: 'Geneina', en: 'Geneina', ar: 'الجنينة' },
];

/** Cities/states keyed by country value. Countries absent here use free text. */
export const CITIES_BY_COUNTRY: Record<string, LocalizedOption[]> = {
  Sudan: SUDAN_LOCATIONS,
};

/** City/state options for a country, or null when the country has no list. */
export function getCitiesForCountry(country: string): LocalizedOption[] | null {
  if (!country) return null;
  return CITIES_BY_COUNTRY[country] || null;
}

/**
 * Build a `<select>` option list, guaranteeing the current value survives even
 * when it isn't one of the known options (e.g. a legacy free-text address).
 */
export function optionsWithCurrent(
  options: LocalizedOption[],
  current: string,
): LocalizedOption[] {
  if (!current || options.some((o) => o.value === current)) return options;
  return [{ value: current, en: current, ar: current }, ...options];
}
