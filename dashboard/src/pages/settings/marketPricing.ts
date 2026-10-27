/**
 * Helpers for Settings → Markets: the currency a country uses, flags and
 * names, and the price a customer in a market pays — the same rules as the
 * server (services/regionalPricing.js), so the page's examples and preview
 * match the website and checkout exactly.
 */
import { getTenantLocale, uiLanguage } from '../../lib/format';

/** The currency each country pays in (for countries the picker offers). */
const COUNTRY_CURRENCY: Record<string, string> = {
  SD: 'SDG', SA: 'SAR', AE: 'AED', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', EG: 'EGP', JO: 'JOD',
  LB: 'LBP', MA: 'MAD', TN: 'TND', DZ: 'DZD', TR: 'TRY', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD',
  NZ: 'NZD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON',
  BG: 'BGN', RU: 'RUB', UA: 'UAH', IL: 'ILS', ZA: 'ZAR', NG: 'NGN', KE: 'KES', GH: 'GHS', IN: 'INR',
  PK: 'PKR', BD: 'BDT', LK: 'LKR', CN: 'CNY', HK: 'HKD', TW: 'TWD', JP: 'JPY', KR: 'KRW', SG: 'SGD',
  MY: 'MYR', TH: 'THB', ID: 'IDR', PH: 'PHP', VN: 'VND', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP',
  CO: 'COP', PE: 'PEN', UY: 'UYU',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', LU: 'EUR', PT: 'EUR', AT: 'EUR',
  IE: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR', IS: 'ISK',
};

export const currencyForCountry = (country: string): string | null => COUNTRY_CURRENCY[country.toUpperCase()] || null;

/** 🇸🇩 from "SD". */
export const flag = (country: string): string =>
  /^[A-Z]{2}$/i.test(country)
    ? String.fromCodePoint(...country.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : '';

const displayName = (type: 'region' | 'currency', code: string): string => {
  try {
    return new Intl.DisplayNames([uiLanguage()], { type }).of(code) || code;
  } catch {
    return code;
  }
};
/** "السودان" / "Sudan" in the dashboard language. */
export const countryName = (country: string) => displayName('region', country.toUpperCase());
/** "جنيه سوداني" / "Sudanese Pound" in the dashboard language. */
export const currencyName = (currency: string) => displayName('currency', currency.toUpperCase());

/** Rounding a market starts with: tidy amounts in the currencies people round. */
export function defaultRounding(currency: string): string {
  if (currency === 'SDG') return '100';
  if (currency === 'EGP') return '5';
  if (['SAR', 'AED', 'QAR'].includes(currency)) return '1';
  return 'none';
}

const EPSILON = 1e-9;
/** Round a converted amount up by the rule (services/regionalPricing.js applyRounding). */
export function applyRounding(amount: number, rule: string): number {
  if (!(amount > 0)) return 0;
  if (!rule || rule === 'none') return Math.round(amount * 100) / 100;
  if (rule === '0.99') return Math.max(0.99, Math.ceil(amount - EPSILON) - 0.01);
  const step = Number(rule);
  if (!(step > 0)) return Math.round(amount * 100) / 100;
  return Math.ceil(amount / step - EPSILON) * step;
}

export interface MarketPricing {
  /** 1 pricing unit = rate units (1 when the market uses the pricing currency). */
  rate: number;
  /** 0.1 = prices 10% higher in the market. */
  adjustment: number;
  rounding: string;
}

/** What a customer in the market pays for a product, and whether it is the merchant's own price. */
export function customerPrice(
  basePrice: number,
  own: number | null | undefined,
  p: MarketPricing,
): { amount: number; own: boolean } {
  if (typeof own === 'number' && own >= 0) return { amount: own, own: true };
  return { amount: applyRounding(basePrice * (1 + p.adjustment) * p.rate, p.rounding), own: false };
}

/** A short code for a new market from its name or first country ("sd", "sa-2"). */
export function marketCode(seed: string, taken: string[]): string {
  const clean = seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  const base = clean.length >= 2 ? clean : 'market';
  let code = base;
  for (let n = 2; taken.includes(code); n++) code = `${base}-${n}`;
  return code;
}

/** A price as customers read it: "52,000 SDG" without ".00" on whole amounts. */
export function formatAmount(amount: number, currency: string): string {
  const whole = Math.abs(amount - Math.round(amount)) < 1e-9;
  try {
    return new Intl.NumberFormat(getTenantLocale(), {
      style: 'currency',
      currency,
      ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
