import { getATenantRepo } from "../repositories/tenant.js";

/**
 * Resolve the most specific tax rate for a given product class + address.
 *
 * Specificity order (most → least):
 *   1. country + state + class
 *   2. country + state + (no class — generic)
 *   3. country + wildcard state + class
 *   4. country + wildcard state + generic
 *   5. wildcard/default country + class
 *   6. wildcard/default country + generic
 *
 * The class-specific rate ALWAYS beats a generic rate at the same
 * jurisdiction level. This lets a merchant configure
 *   { country:"GB", state:"*", rate:0.20 }                 // standard
 *   { country:"GB", state:"*", rate:0.05, productClass:"food" }
 * and have food taxed at 5% while everything else is 20%, without
 * having to enumerate every other class.
 */
function findRate(rates, country, state, productClass) {
  const isWildcardCountry = (c) => !c || c === "*" || c === "default";
  const isWildcardState = (s) => !s || s === "*";
  const matchCountry = (r) => r.country === country;
  const matchState = (r) => r.state === state;
  const matchClass = (r) => r.productClass === productClass;
  const noClass = (r) => !r.productClass;

  return (
    rates.find((r) => matchCountry(r) && matchState(r) && matchClass(r)) ||
    rates.find((r) => matchCountry(r) && matchState(r) && noClass(r)) ||
    rates.find((r) => matchCountry(r) && isWildcardState(r.state) && matchClass(r)) ||
    rates.find((r) => matchCountry(r) && isWildcardState(r.state) && noClass(r)) ||
    rates.find((r) => isWildcardCountry(r.country) && matchClass(r)) ||
    rates.find((r) => isWildcardCountry(r.country) && noClass(r)) ||
    null
  );
}

/**
 * Calculate tax for a checkout.
 *
 * @param {Object} cart
 * @param {number} cart.subtotal - post-discount subtotal (legacy callers)
 * @param {Array}  [cart.lines]  - priced lines `[{lineTotal, taxClass, taxExempt}]`
 *                                  When provided, per-line classification is used.
 * @param {number} [cart.shippingCost]
 * @param {Object} address - { country, state }
 * @param {string} tenantId
 */
export const calculateTax = async (cart, address, tenantId) => {
  const tenant = await getATenantRepo({}, { _id: tenantId });
  const settings = tenant.settings?.tax || {
    enabled: false,
    rates: [],
    includeInPrice: false,
    taxShipping: false,
  };

  if (!settings.enabled) {
    return { amount: 0, rate: 0, included: false, breakdown: [] };
  }

  const rates = settings.rates || [];
  const country = address.country || "default";
  const state = address.state || "*";
  const included = !!settings.includeInPrice;

  // Helper that converts a taxable amount into actual tax owed,
  // honouring inclusive vs additive pricing semantics.
  //   inclusive:  price already contains tax → tax = price - price/(1+r)
  //   additive:   tax sits on top of price   → tax = price * r
  const taxOf = (amount, r) => {
    if (!r) return 0;
    return included ? amount - amount / (1 + r) : amount * r;
  };

  let total = 0;
  const breakdown = [];

  // Per-line path — required for product class overrides to work.
  if (Array.isArray(cart.lines) && cart.lines.length > 0) {
    for (const line of cart.lines) {
      if (line.taxExempt) continue;
      const cls = line.taxClass || "standard";
      const match = findRate(rates, country, state, cls);
      if (!match) continue;
      const tax = taxOf(line.lineTotal, match.rate);
      total += tax;
      const existing = breakdown.find((b) => b.name === (match.name || cls));
      if (existing) {
        existing.amount += tax;
      } else {
        breakdown.push({
          name: match.name || cls,
          rate: match.rate,
          amount: tax,
          productClass: match.productClass || null,
        });
      }
    }
  } else {
    // Legacy / simple path — single subtotal, no per-line classes.
    const match = findRate(rates, country, state, null) || findRate(rates, country, state, "standard");
    if (match) {
      const tax = taxOf(cart.subtotal || 0, match.rate);
      total += tax;
      breakdown.push({
        name: match.name || "Tax",
        rate: match.rate,
        amount: tax,
        productClass: null,
      });
    }
  }

  // Optional: tax the shipping cost too. Only when caller provided one
  // and the tenant has opted in. Tax class for shipping uses the
  // generic rate at the resolved jurisdiction.
  if (settings.taxShipping && cart.shippingCost && cart.shippingCost > 0) {
    const shipMatch = findRate(rates, country, state, null);
    if (shipMatch) {
      const tax = taxOf(cart.shippingCost, shipMatch.rate);
      total += tax;
      breakdown.push({
        name: `${shipMatch.name || "Tax"} (shipping)`,
        rate: shipMatch.rate,
        amount: tax,
        productClass: "_shipping",
      });
    }
  }

  // Round each line and the total to 2dp at the end so the receipt
  // doesn't drift due to floating-point accumulation.
  const round2 = (n) => Math.round(n * 100) / 100;
  for (const b of breakdown) b.amount = round2(b.amount);
  const rounded = round2(total);

  // Effective rate is informational — useful for displaying "incl. ~17%"
  // on a multi-class cart. Falls back to the first match's rate.
  const subtotalRef =
    Array.isArray(cart.lines) && cart.lines.length > 0
      ? cart.lines.reduce((s, l) => s + (l.lineTotal || 0), 0)
      : cart.subtotal || 0;
  const effectiveRate = subtotalRef > 0 ? rounded / subtotalRef : 0;

  return {
    amount: rounded,
    rate: effectiveRate,
    included,
    breakdown,
    name: breakdown[0]?.name || "Tax",
  };
};
