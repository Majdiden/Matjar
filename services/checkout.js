import { calculateTax } from "./tax.js";
import { calculateShipping } from "./shipping.js";
import { validateDiscount, validateDiscountCombination } from "./discount.js";
import { applyPresentment } from "./markets.js";
import { getATenantRepo } from "../repositories/tenant.js";
import { resolvePricingContext, unitPresentmentPrice, baseEquivalent } from "./regionalPricing.js";

/**
 * Bump this whenever the pricing algorithm changes. Persisted on every
 * order so we can audit which version priced it.
 */
export const CALCULATION_VERSION = 1;

/**
 * Build a priced checkout quote from cart lines.
 * This is the single source of truth for all order economics.
 *
 * @param {Object} params
 * @param {Array} params.lines - [{product, quantity, variant?}] with populated product docs
 * @param {Object} params.shippingAddress
 * @param {string} params.discountCode - optional
 * @param {Object} params.models - scoped models
 * @param {string} params.tenantId
 * @returns {Object} Priced checkout quote
 */
export async function priceCheckout({ lines, shippingAddress, discountCode, discountCodes, models, tenantId, userId, marketCode = null }) {
  // Backward-compat: a caller may pass a single `discountCode` (string) OR
  // an array `discountCodes`. Internally we always operate on the array
  // form so the combination validator is the single source of truth.
  const codeList = Array.isArray(discountCodes) && discountCodes.length > 0
    ? discountCodes
    : (discountCode ? [discountCode] : []);
  // 1. Compute line totals.
  // Variant price (when set) fully overrides the product price; an unset
  // variant price means "inherit". This matches how merchants expect to
  // configure things — change a single variant's price without re-deriving
  // a delta against the parent.
  // The shopper's region decides what they pay per unit: the merchant's own
  // price for that currency, or the converted price rounded by the region's
  // rule (services/regionalPricing.js). Such a line is priced here at the
  // pricing-currency equivalent of that amount so discounts, tax and the
  // presentment conversion below all land on exactly what was shown.
  // A pricing failure must not block checkout: fall back to plain prices.
  let pricing = null;
  let tenant = null;
  try {
    tenant = tenantId ? await getATenantRepo({}, { _id: tenantId }) : null;
    pricing = tenant ? resolvePricingContext(tenant, { country: shippingAddress?.country, marketCode }) : null;
  } catch {
    pricing = null;
  }
  const regional = !!pricing && (pricing.factor !== 1 || pricing.rounding !== "none" || pricing.currency !== pricing.base);

  const pricedLines = lines.map(line => {
    const variant = line.variant || null;
    let unitPrice =
      variant && typeof variant.price === "number" && variant.price >= 0
        ? variant.price
        : line.product.price;
    let presentmentPrice = null;
    if (regional) {
      const unit = unitPresentmentPrice(line.product, variant, pricing);
      presentmentPrice = unit.amount;
      if (unit.own || pricing.rounding !== "none") unitPrice = baseEquivalent(unit.amount, pricing);
    }
    const lineTotal = unitPrice * line.quantity;
    const variantOptions = variant?.optionValues || [];
    const variantLabel = variantOptions.length
      ? variantOptions.map((o) => `${o.name}: ${o.value}`).join(" / ")
      : null;
    return {
      product: line.product._id,
      name: line.product.name,
      sku: variant?.sku || line.product.sku,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
      // What the shopper pays per unit in the presentment currency.
      presentmentPrice,
      variant: variant
        ? {
            id: variant._id,
            label: variantLabel,
            sku: variant.sku,
            optionValues: variantOptions,
          }
        : null,
      // Tax classification snapshot — passed to calculateTax so per-class
      // rates and exemptions are respected. Snapshotted here (rather than
      // looked up later) so price changes to the product after the order
      // is placed don't retroactively change the tax breakdown.
      taxClass: line.product.taxClass || "standard",
      taxExempt: !!line.product.taxExempt,
      // Forward pre-order flags so the order line snapshot can record
      // whether this line consumed pre-order capacity instead of stock.
      isPreorder: !!line.isPreorder,
      preorderExpectedShipDate: line.preorderExpectedShipDate || null,
    };
  });

  const subtotal = pricedLines.reduce((sum, l) => sum + l.lineTotal, 0);

  // 2. Product/order discount portion. Shipping discounts come AFTER
  // shipping is calculated (step 3a) because they reduce the rate-card
  // shipping price, not the subtotal. We do a two-pass walk over the
  // discount list: first apply the non-shipping discounts here, then
  // apply shipping discounts after the shipping cost is known.
  let combinationResult = {
    codes: [],
    breakdown: [],
    productOrderAmount: 0,
    shippingAmount: 0,
  };
  let discountError = null;
  if (codeList.length > 0) {
    try {
      const cartLines = pricedLines.map(l => ({
        product: l.product,
        category: lines.find(ol => ol.product._id.toString() === l.product.toString())?.product.category,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      }));
      // First pass: apply only product/order discounts to the subtotal.
      // Shipping discounts need shippingCost (computed below) so we defer
      // them. Stackability is still validated against the FULL set so a
      // shipping+order conflict throws here, before any work is wasted.
      const nonShippingCodes = [];
      const shippingOnlyCodes = [];
      // Cheap pre-fetch — we look up each discount once to triage by kind
      // before delegating the full validation to validateDiscountCombination.
      for (const c of codeList) {
        const norm = String(c || "").trim().toUpperCase();
        const d = await models.Discount.findOne({ code: norm, isActive: true });
        if (!d) throw new Error(`Invalid discount code: ${norm}`);
        if (d.kind === "shipping") shippingOnlyCodes.push(norm);
        else nonShippingCodes.push(norm);
      }
      // Run the FULL combination validator first (with shippingCost=0) to
      // enforce stackability and capture the product/order amount. Shipping
      // amount from this call is approximate; we recompute it below once
      // we know the actual shipping cost.
      combinationResult = await validateDiscountCombination(
        models,
        codeList,
        cartLines,
        userId,
        0
      );
    } catch (err) {
      discountError = err?.message || "Invalid discount code";
      combinationResult = { codes: [], breakdown: [], productOrderAmount: 0, shippingAmount: 0 };
    }
  }
  const discountAmount = combinationResult.productOrderAmount || 0;
  const afterDiscount = Math.max(0, subtotal - discountAmount);

  // 3. Shipping (rate-card)
  const cartForShipping = { subtotal: afterDiscount, items: lines };
  const shippingResult = await calculateShipping(cartForShipping, shippingAddress || {}, tenantId);
  const rateCardShipping = shippingResult.cost || 0;

  // 3a. Shipping discount — recompute now that we know rateCardShipping.
  // We mutate the breakdown entries in place so the order receipt has the
  // accurate per-code amounts (the earlier pass used 0).
  let shippingDiscountAmount = 0;
  if (codeList.length > 0 && !discountError) {
    for (const entry of combinationResult.breakdown) {
      if (entry.kind !== "shipping") continue;
      const discount = await models.Discount.findOne({ code: entry.code, isActive: true });
      if (!discount) continue;
      let amt = 0;
      if (discount.type === "percentage") amt = (rateCardShipping * discount.value) / 100;
      else if (discount.type === "fixed") amt = discount.value;
      amt = Math.min(amt, rateCardShipping - shippingDiscountAmount);
      if (amt < 0) amt = 0;
      entry.amount = Math.round(amt * 100) / 100;
      shippingDiscountAmount += amt;
    }
    combinationResult.shippingAmount = Math.round(shippingDiscountAmount * 100) / 100;
  }
  const shippingCost = Math.max(0, rateCardShipping - shippingDiscountAmount);

  // 4. Tax — pass per-line classification + shipping cost so the
  // calculator can apply class-specific rates and (optionally) tax
  // shipping. The discount is distributed over lines pro-rata so the
  // taxable amount matches the post-discount line totals.
  const discountFactor = subtotal > 0 ? afterDiscount / subtotal : 1;
  const linesForTax = pricedLines.map((l) => ({
    lineTotal: l.lineTotal * discountFactor,
    taxClass: l.taxClass,
    taxExempt: l.taxExempt,
  }));
  const cartForTax = {
    subtotal: afterDiscount,
    lines: linesForTax,
    shippingCost,
  };
  const taxResult = await calculateTax(cartForTax, shippingAddress || {}, tenantId);
  const taxAmount = taxResult.amount || 0;

  // 5. Total — when prices are tax-inclusive the tax is already inside
  // afterDiscount and must NOT be added on top, otherwise the customer
  // would pay tax twice.
  const totalAmount = taxResult.included
    ? Math.round((afterDiscount + shippingCost) * 100) / 100
    : Math.round((afterDiscount + shippingCost + taxAmount) * 100) / 100;

  const baseQuote = {
    lines: pricedLines,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round((discountAmount + shippingDiscountAmount) * 100) / 100,
    // Single-code shorthand for legacy clients — the FIRST applied code wins
    // when multiple are present. New clients should read `discountCodes`
    // and `discountBreakdown` to render the full picture.
    discountCode: combinationResult.breakdown[0]?.code || null,
    discountCodes: combinationResult.codes,
    discountBreakdown: combinationResult.breakdown,
    discountError,
    shippingCost: Math.round(shippingCost * 100) / 100,
    rateCardShippingCost: Math.round(rateCardShipping * 100) / 100,
    shippingDiscount: Math.round(shippingDiscountAmount * 100) / 100,
    shippingMethod: { name: shippingResult.description || shippingResult.type, price: shippingCost },
    // Delivery area picked at checkout (zone shipping), or that one is needed.
    deliveryZone: shippingResult.deliveryZone || null,
    deliveryZoneMissing: !!shippingResult.deliveryZoneMissing,
    tax: Math.round(taxAmount * 100) / 100,
    taxRate: taxResult.rate || 0,
    taxIncluded: taxResult.included || false,
    taxBreakdown: taxResult.breakdown || [],
    totalAmount,
  };

  // 6. Presentment: the base-currency numbers above stay authoritative;
  // `presentment*` is the shopper-facing overlay (their currency, the
  // region's adjustment). A market whose currency has no rate keeps its
  // adjustment in the pricing currency (resolvePricingContext).
  // Converted from the unrounded amounts so a line priced at exactly 349 SAR
  // isn't shifted by rounding its pricing-currency equivalent to cents.
  const exactQuote = {
    ...baseQuote,
    subtotal,
    discount: discountAmount + shippingDiscountAmount,
    shippingCost,
    shippingDiscount: shippingDiscountAmount,
    tax: taxAmount,
    totalAmount: taxResult.included ? afterDiscount + shippingCost : afterDiscount + shippingCost + taxAmount,
  };
  let presentment = {};
  try {
    presentment = pricing
      ? applyPresentment(
          exactQuote,
          pricing.marketCode || pricing.currency !== pricing.base || pricing.factor !== 1
            ? { code: pricing.marketCode, currency: pricing.currency, priceAdjustmentPct: pricing.adjust - 1 }
            : null,
          { base: pricing.base, rates: tenant?.settings?.currencies?.rates || {} }
        )
      : applyPresentment(baseQuote, null, null);
  } catch {
    presentment = {};
  }

  return { ...baseQuote, ...presentment, calculationVersion: CALCULATION_VERSION };
}
