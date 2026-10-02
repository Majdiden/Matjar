/**
 * Stripe amount conversion.
 *
 * Stripe takes amounts as integers in the currency's smallest unit, and the
 * size of that unit depends on the currency: most use cents (x100), some
 * have no minor unit (JPY: x1) and a few use three decimals (KWD: x1000).
 * Hardcoding `* 100` mis-charges the last two groups by 100x / 10x.
 *
 * Lists from https://docs.stripe.com/currencies#special-cases
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

/** Minor units per major unit for an ISO-4217 code. */
export function minorUnitFactor(currency) {
  const code = String(currency || "").toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 1;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 1000;
  return 100;
}

/**
 * Major units (e.g. 12.5) → Stripe integer amount. Three-decimal currencies
 * are rounded to a multiple of 10 because Stripe rejects anything finer.
 */
export function toStripeAmount(amount, currency) {
  const factor = minorUnitFactor(currency);
  const units = Math.round(Number(amount) * factor);
  return factor === 1000 ? Math.round(units / 10) * 10 : units;
}

/** Stripe integer amount → major units. */
export function fromStripeAmount(units, currency) {
  return Number(units) / minorUnitFactor(currency);
}
