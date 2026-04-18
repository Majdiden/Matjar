/**
 * Currency formatting utilities.
 */

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amount: number, currency = 'SDG', locale = 'en-US'): string {
  const key = `${locale}-${currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    formatterCache.set(key, formatter);
  }
  return formatter.format(amount);
}

export function calculateDiscount(price: number, compareAtPrice?: number): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round((1 - price / compareAtPrice) * 100);
}
