/**
 * Quick add product (PBI 10): reading what a merchant types into the price
 * and quantity fields on a phone. Arabic keyboards give Arabic-Indic digits
 * ("١٥٠٠٠"), the Arabic decimal mark ("١٢٫٥") and thousands separators
 * ("15,000", "١٥٬٠٠٠"); all of them should just work.
 *
 * Limits mirror QUICK_PRODUCT_LIMITS in validators/product.validator.js.
 */
import { toAsciiDigits } from './phone.ts';

export const QUICK_PRODUCT_LIMITS = Object.freeze({
  nameMax: 200,
  descriptionMax: 5000,
  imagesMax: 10,
  stockMax: 1_000_000,
  priceMax: 1_000_000_000,
});

export const QUICK_PRODUCT_ROUTE = '/dashboard/products/quick';
export const FULL_PRODUCT_ROUTE = '/dashboard/products/new';

/** New products start with one in stock; zero would show "Out of stock". */
export const QUICK_PRODUCT_DEFAULT_STOCK = 1;

const ARABIC_DECIMAL_MARK = /٫/g;
// Thousands separators: ASCII comma, Arabic thousands mark, Arabic comma, spaces.
const GROUP_SEPARATORS = /[,٬،\s]/g;
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;
const PLAIN_WHOLE_NUMBER = /^\d+$/;

const normalizeNumberText = (raw: string): string =>
  toAsciiDigits(String(raw ?? ''))
    .replace(ARABIC_DECIMAL_MARK, '.')
    .replace(GROUP_SEPARATORS, '');

/** "١٥٬٠٠٠" → 15000. null when empty, not a number, zero/negative or too large. */
export function parsePriceInput(raw: string): number | null {
  const text = normalizeNumberText(raw);
  if (!PLAIN_NUMBER.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0 || value > QUICK_PRODUCT_LIMITS.priceMax) return null;
  return value;
}

/** "٣" → 3. null when empty, not a whole number or out of range. */
export function parseQuantityInput(raw: string): number | null {
  const text = normalizeNumberText(raw);
  if (!PLAIN_WHOLE_NUMBER.test(text)) return null;
  const value = Number(text);
  return value <= QUICK_PRODUCT_LIMITS.stockMax ? value : null;
}

/** Quantity after tapping − / +, kept within 0…stockMax. */
export function stepQuantity(current: number | null, delta: number): number {
  const next = (current ?? 0) + delta;
  return Math.min(QUICK_PRODUCT_LIMITS.stockMax, Math.max(0, next));
}

/** Public product link: "https://<host>/products/<slug>", or the path alone without a host. */
export function productLink(host: string, slug: string): string {
  const path = `/products/${encodeURIComponent(slug)}`;
  return host ? `https://${host}${path}` : path;
}
