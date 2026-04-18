import { getATenantRepo } from "../repositories/tenant.js";

/**
 * Markets service. The merchant defines geographic markets in
 * `tenant.settings.markets`; each market binds a set of countries to a
 * presentment currency, language and price adjustment. The checkout uses
 * `resolveMarket` to figure out which market a buyer falls into based on
 * their shipping country and `applyPresentment` to convert a base-currency
 * quote into the buyer-facing presentment numbers.
 *
 * Why a separate service rather than inlining into checkout: the same
 * lookup is needed by the storefront product detail / cart pages so the
 * customer sees prices in their local currency BEFORE they hit checkout.
 * Keeping it pure (tenant in, market out, no DB writes) lets both call
 * sites share the rules.
 */

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Resolve a market for a given country code.
 *
 * Lookup order:
 *   1. enabled market that lists the country (case-insensitive)
 *   2. enabled market flagged isDefault
 *   3. null — caller treats this as "use base currency, no adjustment"
 *
 * The country argument may be `null`/`undefined` (e.g. for an unauthenticated
 * storefront page render); we still return the default market in that case
 * so the customer sees the merchant's intended fallback pricing.
 */
export function resolveMarket(tenant, country) {
  const markets = (tenant?.settings?.markets || []).filter((m) => m.enabled);
  if (markets.length === 0) return null;
  const upper = country ? String(country).toUpperCase() : null;
  if (upper) {
    const explicit = markets.find((m) =>
      (m.countries || []).some((c) => String(c).toUpperCase() === upper)
    );
    if (explicit) return explicit;
  }
  return markets.find((m) => m.isDefault) || null;
}

/**
 * Convert an amount between currencies using the merchant's FX table.
 *
 * The rates map is { CODE: multiplier-vs-base }, so:
 *   base → other:  amount * rates[other]
 *   other → base:  amount / rates[other]
 *   other → other: amount / rates[from] * rates[to]   (round-trip via base)
 *
 * Same-currency conversions short-circuit. Missing rate throws so callers
 * surface a clear error rather than silently mispricing — the dashboard
 * blocks publishing a market whose currency has no rate, so this should
 * only fire on misconfiguration.
 */
export function convertCurrency(amount, from, to, currencies) {
  if (!from || !to || from === to) return amount;
  const base = (currencies?.base || "SDG").toUpperCase();
  const rates = currencies?.rates || {};
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();
  const rateOf = (code) => {
    if (code === base) return 1;
    const r = rates[code] ?? rates[code.toLowerCase()] ?? rates[code.toUpperCase()];
    if (typeof r !== "number" || !(r > 0)) {
      throw new Error(`Missing FX rate for ${code} (base ${base})`);
    }
    return r;
  };
  // Convert from → base → to.
  const inBase = amount / rateOf(fromUpper);
  return inBase * rateOf(toUpper);
}

/**
 * Apply a market's pricing transform to a base-currency checkout quote.
 *
 * Returns the presentment fields that should be merged onto the quote /
 * persisted on the order. When the resolved market's currency matches the
 * base currency the function still returns the price-adjusted numbers in
 * base currency so a domestic-only adjustment (e.g. "EU prices are 5%
 * higher") still flows through, but `presentmentCurrency === baseCurrency`
 * and `fxRate === 1`.
 *
 * Pure: no DB access, safe to call from a price-display hook.
 */
export function applyPresentment(quote, market, currencies) {
  const base = (currencies?.base || "SDG").toUpperCase();
  if (!market) {
    return {
      baseCurrency: base,
      presentmentCurrency: base,
      presentmentSubtotal: quote.subtotal,
      presentmentTotal: quote.totalAmount,
      presentmentTax: quote.tax,
      presentmentShipping: quote.shippingCost,
      fxRate: 1,
      marketCode: null,
    };
  }
  const adjust = 1 + (market.priceAdjustmentPct || 0);
  const adjustedSubtotal = quote.subtotal * adjust;
  const adjustedTax = quote.tax * adjust;
  const adjustedShipping = quote.shippingCost; // shipping is rate-card based, don't double-apply
  const adjustedTotal = adjustedSubtotal + adjustedShipping + (quote.taxIncluded ? 0 : adjustedTax);

  const presentmentCurrency = (market.currency || base).toUpperCase();
  const fxRate = presentmentCurrency === base
    ? 1
    : convertCurrency(1, base, presentmentCurrency, currencies);

  return {
    baseCurrency: base,
    presentmentCurrency,
    presentmentSubtotal: round2(adjustedSubtotal * fxRate),
    presentmentTax: round2(adjustedTax * fxRate),
    presentmentShipping: round2(adjustedShipping * fxRate),
    presentmentTotal: round2(adjustedTotal * fxRate),
    fxRate,
    marketCode: market.code,
  };
}

/**
 * Convenience wrapper used by checkout.priceCheckout — fetches the tenant,
 * resolves the market, and returns the presentment block ready to merge.
 */
export async function presentmentForCheckout({ tenantId, country, quote }) {
  const tenant = await getATenantRepo({}, { _id: tenantId });
  if (!tenant) return applyPresentment(quote, null, null);
  const market = resolveMarket(tenant, country);
  return applyPresentment(quote, market, tenant.settings?.currencies);
}
