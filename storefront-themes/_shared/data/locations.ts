/**
 * Shared location data for storefront address forms (checkout + account).
 *
 * The platform's primary market is Sudan, so Sudan is the default/top country
 * and ships with a full state + major-city list; the Gulf, Egypt, Jordan,
 * South Sudan and Turkey have their major cities. Other countries fall back
 * to a free-text city input, and a city missing from a list is typed in
 * ("Other city").
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
  /** ISO-3166 alpha-2 code (countries only): what markets and delivery areas use. */
  code?: string;
}

/** Return the display label for the active language. */
export function locationLabel(opt: LocalizedOption, lang: string): string {
  return lang.startsWith('ar') ? opt.ar : opt.en;
}

// Sudan first (primary market), then a reasonable common-country list.
export const COUNTRIES: (LocalizedOption & { code: string })[] = [
  { code: 'SD', value: 'Sudan', en: 'Sudan', ar: 'السودان' },
  { code: 'SA', value: 'Saudi Arabia', en: 'Saudi Arabia', ar: 'السعودية' },
  { code: 'AE', value: 'United Arab Emirates', en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة' },
  { code: 'QA', value: 'Qatar', en: 'Qatar', ar: 'قطر' },
  { code: 'KW', value: 'Kuwait', en: 'Kuwait', ar: 'الكويت' },
  { code: 'BH', value: 'Bahrain', en: 'Bahrain', ar: 'البحرين' },
  { code: 'OM', value: 'Oman', en: 'Oman', ar: 'عُمان' },
  { code: 'EG', value: 'Egypt', en: 'Egypt', ar: 'مصر' },
  { code: 'JO', value: 'Jordan', en: 'Jordan', ar: 'الأردن' },
  { code: 'LB', value: 'Lebanon', en: 'Lebanon', ar: 'لبنان' },
  { code: 'IQ', value: 'Iraq', en: 'Iraq', ar: 'العراق' },
  { code: 'SY', value: 'Syria', en: 'Syria', ar: 'سوريا' },
  { code: 'YE', value: 'Yemen', en: 'Yemen', ar: 'اليمن' },
  { code: 'LY', value: 'Libya', en: 'Libya', ar: 'ليبيا' },
  { code: 'TN', value: 'Tunisia', en: 'Tunisia', ar: 'تونس' },
  { code: 'DZ', value: 'Algeria', en: 'Algeria', ar: 'الجزائر' },
  { code: 'MA', value: 'Morocco', en: 'Morocco', ar: 'المغرب' },
  { code: 'TD', value: 'Chad', en: 'Chad', ar: 'تشاد' },
  { code: 'SS', value: 'South Sudan', en: 'South Sudan', ar: 'جنوب السودان' },
  { code: 'ET', value: 'Ethiopia', en: 'Ethiopia', ar: 'إثيوبيا' },
  { code: 'ER', value: 'Eritrea', en: 'Eritrea', ar: 'إريتريا' },
  { code: 'KE', value: 'Kenya', en: 'Kenya', ar: 'كينيا' },
  { code: 'UG', value: 'Uganda', en: 'Uganda', ar: 'أوغندا' },
  { code: 'NG', value: 'Nigeria', en: 'Nigeria', ar: 'نيجيريا' },
  { code: 'GH', value: 'Ghana', en: 'Ghana', ar: 'غانا' },
  { code: 'ZA', value: 'South Africa', en: 'South Africa', ar: 'جنوب أفريقيا' },
  { code: 'TR', value: 'Turkey', en: 'Turkey', ar: 'تركيا' },
  { code: 'US', value: 'United States', en: 'United States', ar: 'الولايات المتحدة' },
  { code: 'GB', value: 'United Kingdom', en: 'United Kingdom', ar: 'المملكة المتحدة' },
  { code: 'CA', value: 'Canada', en: 'Canada', ar: 'كندا' },
  { code: 'AU', value: 'Australia', en: 'Australia', ar: 'أستراليا' },
  { code: 'DE', value: 'Germany', en: 'Germany', ar: 'ألمانيا' },
  { code: 'FR', value: 'France', en: 'France', ar: 'فرنسا' },
  { code: 'ES', value: 'Spain', en: 'Spain', ar: 'إسبانيا' },
  { code: 'IT', value: 'Italy', en: 'Italy', ar: 'إيطاليا' },
  { code: 'NL', value: 'Netherlands', en: 'Netherlands', ar: 'هولندا' },
  { code: 'SE', value: 'Sweden', en: 'Sweden', ar: 'السويد' },
  { code: 'CH', value: 'Switzerland', en: 'Switzerland', ar: 'سويسرا' },
  { code: 'IN', value: 'India', en: 'India', ar: 'الهند' },
  { code: 'PK', value: 'Pakistan', en: 'Pakistan', ar: 'باكستان' },
  { code: 'BD', value: 'Bangladesh', en: 'Bangladesh', ar: 'بنغلاديش' },
  { code: 'CN', value: 'China', en: 'China', ar: 'الصين' },
  { code: 'JP', value: 'Japan', en: 'Japan', ar: 'اليابان' },
  { code: 'MY', value: 'Malaysia', en: 'Malaysia', ar: 'ماليزيا' },
  { code: 'ID', value: 'Indonesia', en: 'Indonesia', ar: 'إندونيسيا' },
  { code: 'BR', value: 'Brazil', en: 'Brazil', ar: 'البرازيل' },
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

// Major cities of the other countries stores deliver to (a shopper elsewhere
// picks "Other city" and types it).
export const SAUDI_ARABIA_CITIES: LocalizedOption[] = [
  { value: 'Riyadh', en: 'Riyadh', ar: 'الرياض' },
  { value: 'Jeddah', en: 'Jeddah', ar: 'جدة' },
  { value: 'Mecca', en: 'Mecca', ar: 'مكة المكرمة' },
  { value: 'Medina', en: 'Medina', ar: 'المدينة المنورة' },
  { value: 'Dammam', en: 'Dammam', ar: 'الدمام' },
  { value: 'Khobar', en: 'Khobar', ar: 'الخبر' },
  { value: 'Dhahran', en: 'Dhahran', ar: 'الظهران' },
  { value: 'Taif', en: 'Taif', ar: 'الطائف' },
  { value: 'Tabuk', en: 'Tabuk', ar: 'تبوك' },
  { value: 'Buraidah', en: 'Buraidah', ar: 'بريدة' },
  { value: 'Abha', en: 'Abha', ar: 'أبها' },
  { value: 'Khamis Mushait', en: 'Khamis Mushait', ar: 'خميس مشيط' },
  { value: 'Hail', en: 'Hail', ar: 'حائل' },
  { value: 'Najran', en: 'Najran', ar: 'نجران' },
  { value: 'Jazan', en: 'Jazan', ar: 'جازان' },
  { value: 'Al Ahsa', en: 'Al Ahsa', ar: 'الأحساء' },
  { value: 'Jubail', en: 'Jubail', ar: 'الجبيل' },
  { value: 'Yanbu', en: 'Yanbu', ar: 'ينبع' },
  { value: 'Al Kharj', en: 'Al Kharj', ar: 'الخرج' },
  { value: 'Qatif', en: 'Qatif', ar: 'القطيف' },
  { value: 'Al Baha', en: 'Al Baha', ar: 'الباحة' },
  { value: 'Arar', en: 'Arar', ar: 'عرعر' },
  { value: 'Sakaka', en: 'Sakaka', ar: 'سكاكا' },
];

export const UNITED_ARAB_EMIRATES_CITIES: LocalizedOption[] = [
  { value: 'Abu Dhabi', en: 'Abu Dhabi', ar: 'أبوظبي' },
  { value: 'Dubai', en: 'Dubai', ar: 'دبي' },
  { value: 'Sharjah', en: 'Sharjah', ar: 'الشارقة' },
  { value: 'Ajman', en: 'Ajman', ar: 'عجمان' },
  { value: 'Umm Al Quwain', en: 'Umm Al Quwain', ar: 'أم القيوين' },
  { value: 'Ras Al Khaimah', en: 'Ras Al Khaimah', ar: 'رأس الخيمة' },
  { value: 'Fujairah', en: 'Fujairah', ar: 'الفجيرة' },
  { value: 'Al Ain', en: 'Al Ain', ar: 'العين' },
];

export const QATAR_CITIES: LocalizedOption[] = [
  { value: 'Doha', en: 'Doha', ar: 'الدوحة' },
  { value: 'Al Rayyan', en: 'Al Rayyan', ar: 'الريان' },
  { value: 'Al Wakrah', en: 'Al Wakrah', ar: 'الوكرة' },
  { value: 'Al Khor', en: 'Al Khor', ar: 'الخور' },
  { value: 'Umm Salal', en: 'Umm Salal', ar: 'أم صلال' },
  { value: 'Lusail', en: 'Lusail', ar: 'لوسيل' },
  { value: 'Mesaieed', en: 'Mesaieed', ar: 'مسيعيد' },
  { value: 'Al Shamal', en: 'Al Shamal', ar: 'الشمال' },
];

export const KUWAIT_CITIES: LocalizedOption[] = [
  { value: 'Kuwait City', en: 'Kuwait City', ar: 'مدينة الكويت' },
  { value: 'Hawalli', en: 'Hawalli', ar: 'حولي' },
  { value: 'Salmiya', en: 'Salmiya', ar: 'السالمية' },
  { value: 'Farwaniya', en: 'Farwaniya', ar: 'الفروانية' },
  { value: 'Jahra', en: 'Jahra', ar: 'الجهراء' },
  { value: 'Ahmadi', en: 'Ahmadi', ar: 'الأحمدي' },
  { value: 'Mubarak Al-Kabeer', en: 'Mubarak Al-Kabeer', ar: 'مبارك الكبير' },
  { value: 'Fahaheel', en: 'Fahaheel', ar: 'الفحيحيل' },
];

export const BAHRAIN_CITIES: LocalizedOption[] = [
  { value: 'Manama', en: 'Manama', ar: 'المنامة' },
  { value: 'Muharraq', en: 'Muharraq', ar: 'المحرق' },
  { value: 'Riffa', en: 'Riffa', ar: 'الرفاع' },
  { value: 'Hamad Town', en: 'Hamad Town', ar: 'مدينة حمد' },
  { value: 'Isa Town', en: 'Isa Town', ar: 'مدينة عيسى' },
  { value: 'Sitra', en: 'Sitra', ar: 'سترة' },
];

export const OMAN_CITIES: LocalizedOption[] = [
  { value: 'Muscat', en: 'Muscat', ar: 'مسقط' },
  { value: 'Salalah', en: 'Salalah', ar: 'صلالة' },
  { value: 'Sohar', en: 'Sohar', ar: 'صحار' },
  { value: 'Nizwa', en: 'Nizwa', ar: 'نزوى' },
  { value: 'Sur', en: 'Sur', ar: 'صور' },
  { value: 'Ibri', en: 'Ibri', ar: 'عبري' },
  { value: 'Barka', en: 'Barka', ar: 'بركاء' },
  { value: 'Rustaq', en: 'Rustaq', ar: 'الرستاق' },
];

export const EGYPT_CITIES: LocalizedOption[] = [
  { value: 'Cairo', en: 'Cairo', ar: 'القاهرة' },
  { value: 'Giza', en: 'Giza', ar: 'الجيزة' },
  { value: 'Alexandria', en: 'Alexandria', ar: 'الإسكندرية' },
  { value: 'Port Said', en: 'Port Said', ar: 'بورسعيد' },
  { value: 'Suez', en: 'Suez', ar: 'السويس' },
  { value: 'Ismailia', en: 'Ismailia', ar: 'الإسماعيلية' },
  { value: 'Mansoura', en: 'Mansoura', ar: 'المنصورة' },
  { value: 'Tanta', en: 'Tanta', ar: 'طنطا' },
  { value: 'Zagazig', en: 'Zagazig', ar: 'الزقازيق' },
  { value: 'Damietta', en: 'Damietta', ar: 'دمياط' },
  { value: 'Faiyum', en: 'Faiyum', ar: 'الفيوم' },
  { value: 'Beni Suef', en: 'Beni Suef', ar: 'بني سويف' },
  { value: 'Minya', en: 'Minya', ar: 'المنيا' },
  { value: 'Asyut', en: 'Asyut', ar: 'أسيوط' },
  { value: 'Sohag', en: 'Sohag', ar: 'سوهاج' },
  { value: 'Qena', en: 'Qena', ar: 'قنا' },
  { value: 'Luxor', en: 'Luxor', ar: 'الأقصر' },
  { value: 'Aswan', en: 'Aswan', ar: 'أسوان' },
  { value: 'Hurghada', en: 'Hurghada', ar: 'الغردقة' },
  { value: 'Sharm El Sheikh', en: 'Sharm El Sheikh', ar: 'شرم الشيخ' },
];

export const JORDAN_CITIES: LocalizedOption[] = [
  { value: 'Amman', en: 'Amman', ar: 'عمّان' },
  { value: 'Zarqa', en: 'Zarqa', ar: 'الزرقاء' },
  { value: 'Irbid', en: 'Irbid', ar: 'إربد' },
  { value: 'Aqaba', en: 'Aqaba', ar: 'العقبة' },
  { value: 'Salt', en: 'Salt', ar: 'السلط' },
  { value: 'Madaba', en: 'Madaba', ar: 'مادبا' },
  { value: 'Jerash', en: 'Jerash', ar: 'جرش' },
  { value: 'Mafraq', en: 'Mafraq', ar: 'المفرق' },
  { value: 'Karak', en: 'Karak', ar: 'الكرك' },
];

export const SOUTH_SUDAN_CITIES: LocalizedOption[] = [
  { value: 'Juba', en: 'Juba', ar: 'جوبا' },
  { value: 'Wau', en: 'Wau', ar: 'واو' },
  { value: 'Malakal', en: 'Malakal', ar: 'ملكال' },
  { value: 'Bor', en: 'Bor', ar: 'بور' },
  { value: 'Yei', en: 'Yei', ar: 'ياي' },
  { value: 'Rumbek', en: 'Rumbek', ar: 'رمبيك' },
  { value: 'Aweil', en: 'Aweil', ar: 'أويل' },
  { value: 'Torit', en: 'Torit', ar: 'توريت' },
  { value: 'Bentiu', en: 'Bentiu', ar: 'بانتيو' },
];

export const TURKEY_CITIES: LocalizedOption[] = [
  { value: 'Istanbul', en: 'Istanbul', ar: 'إسطنبول' },
  { value: 'Ankara', en: 'Ankara', ar: 'أنقرة' },
  { value: 'Izmir', en: 'Izmir', ar: 'إزمير' },
  { value: 'Bursa', en: 'Bursa', ar: 'بورصة' },
  { value: 'Antalya', en: 'Antalya', ar: 'أنطاليا' },
  { value: 'Gaziantep', en: 'Gaziantep', ar: 'غازي عنتاب' },
  { value: 'Konya', en: 'Konya', ar: 'قونية' },
  { value: 'Adana', en: 'Adana', ar: 'أضنة' },
];

/** Cities/states keyed by country value. Countries absent here use free text. */
export const CITIES_BY_COUNTRY: Record<string, LocalizedOption[]> = {
  Sudan: SUDAN_LOCATIONS,
  'Saudi Arabia': SAUDI_ARABIA_CITIES,
  'United Arab Emirates': UNITED_ARAB_EMIRATES_CITIES,
  'Qatar': QATAR_CITIES,
  'Kuwait': KUWAIT_CITIES,
  'Bahrain': BAHRAIN_CITIES,
  'Oman': OMAN_CITIES,
  'Egypt': EGYPT_CITIES,
  'Jordan': JORDAN_CITIES,
  'South Sudan': SOUTH_SUDAN_CITIES,
  'Turkey': TURKEY_CITIES,
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
