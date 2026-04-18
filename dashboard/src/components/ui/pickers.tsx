/**
 * Pickers — site-wide searchable dropdowns built on <Combobox>.
 * Use these anywhere the user needs to pick a country, currency,
 * timezone or language so UX stays identical across pages.
 */
import * as React from 'react';
import { Combobox, type ComboboxOption } from './combobox';

// ---------------- Data ----------------

// ISO 4217 — the currencies merchants actually use.
const CURRENCIES: ComboboxOption[] = [
  { value: 'SDG', label: 'Sudanese Pound', hint: 'SDG · ج.س' },
  { value: 'USD', label: 'US Dollar', hint: 'USD · $' },
  { value: 'EUR', label: 'Euro', hint: 'EUR · €' },
  { value: 'GBP', label: 'British Pound', hint: 'GBP · £' },
  { value: 'AED', label: 'UAE Dirham', hint: 'AED · د.إ' },
  { value: 'SAR', label: 'Saudi Riyal', hint: 'SAR · ﷼' },
  { value: 'EGP', label: 'Egyptian Pound', hint: 'EGP · £' },
  { value: 'JPY', label: 'Japanese Yen', hint: 'JPY · ¥' },
  { value: 'CNY', label: 'Chinese Yuan', hint: 'CNY · ¥' },
  { value: 'INR', label: 'Indian Rupee', hint: 'INR · ₹' },
  { value: 'CAD', label: 'Canadian Dollar', hint: 'CAD · $' },
  { value: 'AUD', label: 'Australian Dollar', hint: 'AUD · $' },
  { value: 'CHF', label: 'Swiss Franc', hint: 'CHF · Fr' },
  { value: 'SEK', label: 'Swedish Krona', hint: 'SEK · kr' },
  { value: 'NOK', label: 'Norwegian Krone', hint: 'NOK · kr' },
  { value: 'DKK', label: 'Danish Krone', hint: 'DKK · kr' },
  { value: 'PLN', label: 'Polish Złoty', hint: 'PLN · zł' },
  { value: 'CZK', label: 'Czech Koruna', hint: 'CZK · Kč' },
  { value: 'TRY', label: 'Turkish Lira', hint: 'TRY · ₺' },
  { value: 'RUB', label: 'Russian Ruble', hint: 'RUB · ₽' },
  { value: 'BRL', label: 'Brazilian Real', hint: 'BRL · R$' },
  { value: 'MXN', label: 'Mexican Peso', hint: 'MXN · $' },
  { value: 'ARS', label: 'Argentine Peso', hint: 'ARS · $' },
  { value: 'ZAR', label: 'South African Rand', hint: 'ZAR · R' },
  { value: 'NGN', label: 'Nigerian Naira', hint: 'NGN · ₦' },
  { value: 'KES', label: 'Kenyan Shilling', hint: 'KES · KSh' },
  { value: 'MAD', label: 'Moroccan Dirham', hint: 'MAD · د.م.' },
  { value: 'SGD', label: 'Singapore Dollar', hint: 'SGD · $' },
  { value: 'HKD', label: 'Hong Kong Dollar', hint: 'HKD · $' },
  { value: 'KRW', label: 'South Korean Won', hint: 'KRW · ₩' },
  { value: 'THB', label: 'Thai Baht', hint: 'THB · ฿' },
  { value: 'IDR', label: 'Indonesian Rupiah', hint: 'IDR · Rp' },
  { value: 'MYR', label: 'Malaysian Ringgit', hint: 'MYR · RM' },
  { value: 'PHP', label: 'Philippine Peso', hint: 'PHP · ₱' },
  { value: 'VND', label: 'Vietnamese Dong', hint: 'VND · ₫' },
  { value: 'NZD', label: 'New Zealand Dollar', hint: 'NZD · $' },
  { value: 'ILS', label: 'Israeli Shekel', hint: 'ILS · ₪' },
  { value: 'QAR', label: 'Qatari Riyal', hint: 'QAR · ﷼' },
  { value: 'KWD', label: 'Kuwaiti Dinar', hint: 'KWD · د.ك' },
  { value: 'BHD', label: 'Bahraini Dinar', hint: 'BHD · .د.ب' },
  { value: 'OMR', label: 'Omani Rial', hint: 'OMR · ﷼' },
  { value: 'JOD', label: 'Jordanian Dinar', hint: 'JOD · د.ا' },
  { value: 'LBP', label: 'Lebanese Pound', hint: 'LBP · ل.ل' },
  { value: 'PKR', label: 'Pakistani Rupee', hint: 'PKR · ₨' },
  { value: 'BDT', label: 'Bangladeshi Taka', hint: 'BDT · ৳' },
];

// ISO 3166-1 alpha-2 — common countries. Start with a sensible subset;
// expand as needed when merchants ask for more.
const COUNTRIES: ComboboxOption[] = [
  { value: 'SD', label: 'Sudan', hint: 'SD' },
  { value: 'US', label: 'United States', hint: 'US' },
  { value: 'GB', label: 'United Kingdom', hint: 'GB' },
  { value: 'CA', label: 'Canada', hint: 'CA' },
  { value: 'AU', label: 'Australia', hint: 'AU' },
  { value: 'NZ', label: 'New Zealand', hint: 'NZ' },
  { value: 'IE', label: 'Ireland', hint: 'IE' },
  { value: 'DE', label: 'Germany', hint: 'DE' },
  { value: 'FR', label: 'France', hint: 'FR' },
  { value: 'ES', label: 'Spain', hint: 'ES' },
  { value: 'IT', label: 'Italy', hint: 'IT' },
  { value: 'NL', label: 'Netherlands', hint: 'NL' },
  { value: 'BE', label: 'Belgium', hint: 'BE' },
  { value: 'LU', label: 'Luxembourg', hint: 'LU' },
  { value: 'PT', label: 'Portugal', hint: 'PT' },
  { value: 'AT', label: 'Austria', hint: 'AT' },
  { value: 'CH', label: 'Switzerland', hint: 'CH' },
  { value: 'SE', label: 'Sweden', hint: 'SE' },
  { value: 'NO', label: 'Norway', hint: 'NO' },
  { value: 'DK', label: 'Denmark', hint: 'DK' },
  { value: 'FI', label: 'Finland', hint: 'FI' },
  { value: 'IS', label: 'Iceland', hint: 'IS' },
  { value: 'PL', label: 'Poland', hint: 'PL' },
  { value: 'CZ', label: 'Czechia', hint: 'CZ' },
  { value: 'SK', label: 'Slovakia', hint: 'SK' },
  { value: 'HU', label: 'Hungary', hint: 'HU' },
  { value: 'RO', label: 'Romania', hint: 'RO' },
  { value: 'BG', label: 'Bulgaria', hint: 'BG' },
  { value: 'GR', label: 'Greece', hint: 'GR' },
  { value: 'TR', label: 'Turkey', hint: 'TR' },
  { value: 'RU', label: 'Russia', hint: 'RU' },
  { value: 'UA', label: 'Ukraine', hint: 'UA' },
  { value: 'AE', label: 'United Arab Emirates', hint: 'AE' },
  { value: 'SA', label: 'Saudi Arabia', hint: 'SA' },
  { value: 'QA', label: 'Qatar', hint: 'QA' },
  { value: 'KW', label: 'Kuwait', hint: 'KW' },
  { value: 'BH', label: 'Bahrain', hint: 'BH' },
  { value: 'OM', label: 'Oman', hint: 'OM' },
  { value: 'JO', label: 'Jordan', hint: 'JO' },
  { value: 'LB', label: 'Lebanon', hint: 'LB' },
  { value: 'IL', label: 'Israel', hint: 'IL' },
  { value: 'EG', label: 'Egypt', hint: 'EG' },
  { value: 'MA', label: 'Morocco', hint: 'MA' },
  { value: 'TN', label: 'Tunisia', hint: 'TN' },
  { value: 'DZ', label: 'Algeria', hint: 'DZ' },
  { value: 'ZA', label: 'South Africa', hint: 'ZA' },
  { value: 'NG', label: 'Nigeria', hint: 'NG' },
  { value: 'KE', label: 'Kenya', hint: 'KE' },
  { value: 'GH', label: 'Ghana', hint: 'GH' },
  { value: 'IN', label: 'India', hint: 'IN' },
  { value: 'PK', label: 'Pakistan', hint: 'PK' },
  { value: 'BD', label: 'Bangladesh', hint: 'BD' },
  { value: 'LK', label: 'Sri Lanka', hint: 'LK' },
  { value: 'CN', label: 'China', hint: 'CN' },
  { value: 'HK', label: 'Hong Kong', hint: 'HK' },
  { value: 'TW', label: 'Taiwan', hint: 'TW' },
  { value: 'JP', label: 'Japan', hint: 'JP' },
  { value: 'KR', label: 'South Korea', hint: 'KR' },
  { value: 'SG', label: 'Singapore', hint: 'SG' },
  { value: 'MY', label: 'Malaysia', hint: 'MY' },
  { value: 'TH', label: 'Thailand', hint: 'TH' },
  { value: 'ID', label: 'Indonesia', hint: 'ID' },
  { value: 'PH', label: 'Philippines', hint: 'PH' },
  { value: 'VN', label: 'Vietnam', hint: 'VN' },
  { value: 'MX', label: 'Mexico', hint: 'MX' },
  { value: 'BR', label: 'Brazil', hint: 'BR' },
  { value: 'AR', label: 'Argentina', hint: 'AR' },
  { value: 'CL', label: 'Chile', hint: 'CL' },
  { value: 'CO', label: 'Colombia', hint: 'CO' },
  { value: 'PE', label: 'Peru', hint: 'PE' },
  { value: 'UY', label: 'Uruguay', hint: 'UY' },
];

// IANA timezones — major zones grouped by region. Prefer broad coverage
// over exhaustive: merchants just need their own zone and the common
// regional ones.
const TIMEZONES: ComboboxOption[] = [
  { value: 'UTC', label: 'UTC', hint: 'Coordinated Universal Time' },
  // Americas
  { value: 'America/New_York', label: 'New York', hint: 'US Eastern' },
  { value: 'America/Chicago', label: 'Chicago', hint: 'US Central' },
  { value: 'America/Denver', label: 'Denver', hint: 'US Mountain' },
  { value: 'America/Los_Angeles', label: 'Los Angeles', hint: 'US Pacific' },
  { value: 'America/Anchorage', label: 'Anchorage', hint: 'Alaska' },
  { value: 'America/Toronto', label: 'Toronto', hint: 'Canada Eastern' },
  { value: 'America/Vancouver', label: 'Vancouver', hint: 'Canada Pacific' },
  { value: 'America/Mexico_City', label: 'Mexico City' },
  { value: 'America/Bogota', label: 'Bogotá' },
  { value: 'America/Lima', label: 'Lima' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  { value: 'America/Santiago', label: 'Santiago' },
  // Europe
  { value: 'Europe/London', label: 'London', hint: 'GMT/BST' },
  { value: 'Europe/Dublin', label: 'Dublin' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Madrid', label: 'Madrid' },
  { value: 'Europe/Rome', label: 'Rome' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam' },
  { value: 'Europe/Brussels', label: 'Brussels' },
  { value: 'Europe/Vienna', label: 'Vienna' },
  { value: 'Europe/Zurich', label: 'Zurich' },
  { value: 'Europe/Stockholm', label: 'Stockholm' },
  { value: 'Europe/Oslo', label: 'Oslo' },
  { value: 'Europe/Copenhagen', label: 'Copenhagen' },
  { value: 'Europe/Helsinki', label: 'Helsinki' },
  { value: 'Europe/Warsaw', label: 'Warsaw' },
  { value: 'Europe/Prague', label: 'Prague' },
  { value: 'Europe/Budapest', label: 'Budapest' },
  { value: 'Europe/Athens', label: 'Athens' },
  { value: 'Europe/Istanbul', label: 'Istanbul' },
  { value: 'Europe/Moscow', label: 'Moscow' },
  { value: 'Europe/Kyiv', label: 'Kyiv' },
  // Africa / Middle East
  { value: 'Africa/Khartoum', label: 'Khartoum', hint: 'Sudan' },
  { value: 'Africa/Cairo', label: 'Cairo' },
  { value: 'Africa/Casablanca', label: 'Casablanca' },
  { value: 'Africa/Lagos', label: 'Lagos' },
  { value: 'Africa/Nairobi', label: 'Nairobi' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Riyadh', label: 'Riyadh' },
  { value: 'Asia/Qatar', label: 'Doha' },
  { value: 'Asia/Kuwait', label: 'Kuwait City' },
  { value: 'Asia/Bahrain', label: 'Manama' },
  { value: 'Asia/Muscat', label: 'Muscat' },
  { value: 'Asia/Amman', label: 'Amman' },
  { value: 'Asia/Beirut', label: 'Beirut' },
  { value: 'Asia/Jerusalem', label: 'Jerusalem' },
  // Asia / Pacific
  { value: 'Asia/Tehran', label: 'Tehran' },
  { value: 'Asia/Karachi', label: 'Karachi' },
  { value: 'Asia/Kolkata', label: 'Kolkata', hint: 'India' },
  { value: 'Asia/Dhaka', label: 'Dhaka' },
  { value: 'Asia/Bangkok', label: 'Bangkok' },
  { value: 'Asia/Jakarta', label: 'Jakarta' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Manila', label: 'Manila' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Taipei', label: 'Taipei' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Seoul', label: 'Seoul' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Australia/Melbourne', label: 'Melbourne' },
  { value: 'Australia/Perth', label: 'Perth' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
];

// ISO 639-1 language codes.
const LANGUAGES: ComboboxOption[] = [
  { value: 'en', label: 'English', hint: 'en' },
  { value: 'ar', label: 'Arabic · العربية', hint: 'ar' },
  { value: 'es', label: 'Spanish · Español', hint: 'es' },
  { value: 'fr', label: 'French · Français', hint: 'fr' },
  { value: 'de', label: 'German · Deutsch', hint: 'de' },
  { value: 'it', label: 'Italian · Italiano', hint: 'it' },
  { value: 'pt', label: 'Portuguese · Português', hint: 'pt' },
  { value: 'nl', label: 'Dutch · Nederlands', hint: 'nl' },
  { value: 'sv', label: 'Swedish · Svenska', hint: 'sv' },
  { value: 'no', label: 'Norwegian · Norsk', hint: 'no' },
  { value: 'da', label: 'Danish · Dansk', hint: 'da' },
  { value: 'fi', label: 'Finnish · Suomi', hint: 'fi' },
  { value: 'pl', label: 'Polish · Polski', hint: 'pl' },
  { value: 'cs', label: 'Czech · Čeština', hint: 'cs' },
  { value: 'el', label: 'Greek · Ελληνικά', hint: 'el' },
  { value: 'tr', label: 'Turkish · Türkçe', hint: 'tr' },
  { value: 'ru', label: 'Russian · Русский', hint: 'ru' },
  { value: 'uk', label: 'Ukrainian · Українська', hint: 'uk' },
  { value: 'he', label: 'Hebrew · עברית', hint: 'he' },
  { value: 'fa', label: 'Persian · فارسی', hint: 'fa' },
  { value: 'ur', label: 'Urdu · اردو', hint: 'ur' },
  { value: 'hi', label: 'Hindi · हिन्दी', hint: 'hi' },
  { value: 'bn', label: 'Bengali · বাংলা', hint: 'bn' },
  { value: 'th', label: 'Thai · ไทย', hint: 'th' },
  { value: 'vi', label: 'Vietnamese · Tiếng Việt', hint: 'vi' },
  { value: 'id', label: 'Indonesian · Bahasa Indonesia', hint: 'id' },
  { value: 'ms', label: 'Malay · Bahasa Melayu', hint: 'ms' },
  { value: 'tl', label: 'Filipino · Tagalog', hint: 'tl' },
  { value: 'zh', label: 'Chinese · 中文', hint: 'zh' },
  { value: 'ja', label: 'Japanese · 日本語', hint: 'ja' },
  { value: 'ko', label: 'Korean · 한국어', hint: 'ko' },
];

// ---------------- Picker components ----------------
//
// The underlying ComboboxOption arrays (CURRENCIES/COUNTRIES/TIMEZONES/
// LANGUAGES) are kept private to this module. Consumers use the picker
// components below; nobody needs raw access to the lists today and
// re-exporting them from a file that also exports components trips the
// `react-refresh/only-export-components` rule.

interface PickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencyPicker(props: PickerProps) {
  return (
    <Combobox
      {...props}
      options={CURRENCIES}
      placeholder={props.placeholder || 'Select currency'}
      searchPlaceholder="Search currencies..."
    />
  );
}

export function CountryPicker(props: PickerProps) {
  return (
    <Combobox
      {...props}
      options={COUNTRIES}
      placeholder={props.placeholder || 'Select country'}
      searchPlaceholder="Search countries..."
    />
  );
}

export function TimezonePicker(props: PickerProps) {
  return (
    <Combobox
      {...props}
      options={TIMEZONES}
      placeholder={props.placeholder || 'Select timezone'}
      searchPlaceholder="Search timezones..."
    />
  );
}

export function LanguagePicker(props: PickerProps) {
  return (
    <Combobox
      {...props}
      options={LANGUAGES}
      placeholder={props.placeholder || 'Select language'}
      searchPlaceholder="Search languages..."
    />
  );
}
