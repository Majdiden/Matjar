/**
 * Regional prices: what a shopper in a region (market) or website currency
 * pays per unit.
 *
 * A unit price is, in order:
 *   1. the merchant's own price for that currency (product / variant
 *      `prices`, e.g. { SAR: 99 }), exactly as entered;
 *   2. otherwise the pricing-currency price × the region's adjustment × the
 *      exchange rate, rounded by the region's rounding rule.
 *
 * Everything else (cart, discounts, tax, orders) keeps working in the pricing
 * currency. A line priced by rule 1 or rounded by rule 2 carries the
 * pricing-currency equivalent of what the shopper pays
 * (`baseEquivalent`), so converting it back gives the exact shown amount.
 */
import { resolveMarket, websiteCurrencyMarket } from "./markets.js";
import { getATenantRepo } from "../repositories/tenant.js";

/** Rounding rules a region can use. "none" keeps cents; "0.99" ends prices in .99. */
export const ROUNDING_RULES = ["none", "1", "5", "10", "50", "100", "500", "1000", "0.99"];

const round2 = (n) => Math.round(n * 100) / 100;
// Float noise guard so 120.0000001 doesn't round up to the next step.
const EPSILON = 1e-9;

/** Round a converted amount up by the rule ("none" → cents). */
export function applyRounding(amount, rule) {
  if (!(amount > 0)) return 0;
  if (!rule || rule === "none") return round2(amount);
  if (rule === "0.99") return Math.max(0.99, Math.ceil(amount - EPSILON) - 0.01);
  const step = Number(rule);
  if (!(step > 0)) return round2(amount);
  return Math.ceil(amount / step - EPSILON) * step;
}

/** The rate for `code` from the pricing currency, or null when none is set. */
function rateFor(currencies, code) {
  const base = String(currencies?.base || "SDG").toUpperCase();
  if (!code || code === base) return 1;
  const r = Number(currencies?.rates?.[code]);
  return r > 0 ? r : null;
}

/**
 * The pricing for one market (or the website currency). A market whose
 * currency has no exchange rate keeps its adjustment and rounding in the
 * pricing currency rather than showing unconverted numbers as another
 * currency.
 */
export function contextForMarket(market, currencies) {
  const base = String(currencies?.base || "SDG").toUpperCase();
  const wanted = market?.currency ? String(market.currency).toUpperCase() : base;
  const rate = rateFor(currencies, wanted);
  const currency = rate ? wanted : base;
  const fx = rate || 1;
  const adjust = 1 + (Number(market?.priceAdjustmentPct) || 0);
  const rounding = market?.rounding || "none";
  return {
    base,
    currency,
    fx,
    adjust,
    factor: adjust * fx,
    rounding: ROUNDING_RULES.includes(rounding) ? rounding : "none",
    marketCode: market?.code || null,
    missingRate: !rate,
  };
}

/**
 * Resolve the shopper's pricing: a shipping country picks the market; before
 * one is known, the region the shopper chose; else the website currency.
 * `currency` is a currency the shopper switched to (currency menu, no regions).
 */
export function resolvePricingContext(tenant, { country = null, marketCode = null, currency = null } = {}) {
  const currencies = { ...(tenant?.settings?.currencies || {}) };
  currencies.base = String(tenant?.settings?.currency || currencies.base || "SDG").toUpperCase();
  const markets = (tenant?.settings?.markets || []).filter((m) => m.enabled);
  const chosen = !country && marketCode ? markets.find((m) => m.code === marketCode) : null;
  const market = chosen || resolveMarket(tenant, country);
  if (market) return contextForMarket(market, currencies);
  const switched = currency ? String(currency).toUpperCase() : null;
  if (switched && switched !== currencies.base && !markets.length && currencies.showSwitcher && rateFor(currencies, switched)) {
    // A switched-to currency is approximate except the website currency's
    // own rounding, which belongs to the website currency only.
    const isDisplay = switched === String(currencies.display || "").toUpperCase();
    return contextForMarket(
      { code: null, currency: switched, priceAdjustmentPct: 0, rounding: isDisplay ? currencies.rounding || "none" : "none" },
      currencies
    );
  }
  if (switched === currencies.base && currencies.showSwitcher) return contextForMarket(null, currencies);
  const website = websiteCurrencyMarket(currencies);
  return website
    ? contextForMarket({ ...website, rounding: currencies.rounding || "none" }, currencies)
    : contextForMarket(null, currencies);
}

/** The merchant's own price for the context's currency, from a `prices` map. */
function ownPrice(prices, ctx) {
  if (!prices || typeof prices !== "object" || ctx.currency === ctx.base) return null;
  const v = prices[ctx.currency];
  const n = Number(v);
  return v != null && v !== "" && n >= 0 ? n : null;
}

/**
 * What the shopper pays per unit, in the context's currency. A variant with
 * its own price uses only its own regional prices (the product's would be for
 * a different amount).
 */
export function unitPresentmentPrice(product, variant, ctx) {
  const variantPriced = variant && typeof variant.price === "number" && variant.price >= 0;
  const basePrice = variantPriced ? variant.price : Number(product?.price) || 0;
  const own = ownPrice(variantPriced ? variant.prices : product?.prices, ctx);
  if (own != null) return { amount: own, own: true };
  return { amount: applyRounding(basePrice * ctx.factor, ctx.rounding), own: false };
}

/** True when shown prices can differ from a plain conversion (own prices or rounding). */
export function contextReshapesPrices(ctx) {
  return !!ctx && (ctx.rounding !== "none" || ctx.currency !== ctx.base);
}

/** The pricing-currency amount that converts back to `amount` in the context. */
export const baseEquivalent = (amount, ctx) => (ctx.factor > 0 ? amount / ctx.factor : amount);

/**
 * Compare-at price that keeps the same "was" ratio as the price when the
 * price is the merchant's own (they enter only the price per currency).
 */
function presentmentCompareAt(compareAt, basePrice, unit, ctx) {
  if (!(compareAt > 0)) return compareAt;
  if (unit.own && basePrice > 0) return round2((compareAt / basePrice) * unit.amount);
  return applyRounding(compareAt * ctx.factor, ctx.rounding);
}

/**
 * Rewrite a storefront product (plain object) so its prices are the
 * pricing-currency equivalents of what the shopper pays; the storefront then
 * converts them with the plain rate × adjustment and shows the exact amounts.
 * Removes the `prices` maps (not needed by the storefront).
 */
export function localizeProduct(product, ctx) {
  if (!product || typeof product !== "object") return product;
  const reshape = contextReshapesPrices(ctx);
  if (reshape && typeof product.price === "number") {
    const unit = unitPresentmentPrice(product, null, ctx);
    if (product.compareAtPrice != null) {
      product.compareAtPrice = baseEquivalent(presentmentCompareAt(product.compareAtPrice, product.price, unit, ctx), ctx);
    }
    if (Array.isArray(product.variants)) {
      product.variants = product.variants.map((v) => {
        if (!v || typeof v !== "object") return v;
        const out = { ...v };
        const vUnit = unitPresentmentPrice(product, v, ctx);
        const vBase = typeof v.price === "number" && v.price >= 0 ? v.price : product.price;
        // A variant without its own price inherits the (rewritten) product price.
        if (typeof v.price === "number" && v.price >= 0) out.price = baseEquivalent(vUnit.amount, ctx);
        if (out.compareAtPrice != null) {
          out.compareAtPrice = baseEquivalent(presentmentCompareAt(v.compareAtPrice, vBase, vUnit, ctx), ctx);
        }
        delete out.prices;
        return out;
      });
    }
    product.price = baseEquivalent(unit.amount, ctx);
  } else if (Array.isArray(product.variants)) {
    product.variants = product.variants.map((v) => {
      if (!v || typeof v !== "object" || !("prices" in v)) return v;
      const { prices, ...rest } = v;
      return rest;
    });
  }
  delete product.prices;
  return product;
}

/**
 * Walk a JSON response and localize every product in it (anything with a
 * numeric price and a slug), including nested ones (related products).
 */
export function localizeProductsDeep(value, ctx, depth = 0) {
  if (depth > 8 || value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = localizeProductsDeep(value[i], ctx, depth + 1);
    return value;
  }
  if (value instanceof Date) return value;
  for (const key of Object.keys(value)) {
    if (key === "variants") continue;
    const child = value[key];
    if (child && typeof child === "object") value[key] = localizeProductsDeep(child, ctx, depth + 1);
  }
  if (typeof value.price === "number" && typeof value.slug === "string") localizeProduct(value, ctx);
  return value;
}

/**
 * Payment method codes a region offers, or null when it offers all (no
 * region, or the region lists none).
 */
export function marketPaymentMethods(tenant, marketCode) {
  if (!marketCode) return null;
  const market = (tenant?.settings?.markets || []).find((m) => m.enabled && m.code === marketCode);
  const codes = Array.isArray(market?.paymentMethods) ? market.paymentMethods.filter(Boolean) : [];
  return codes.length ? codes : null;
}

/** Whether a payment method may be used for an order in this region. */
export async function paymentMethodAllowedInMarket(tenantId, marketCode, methodCode) {
  if (!marketCode || !methodCode) return true;
  const tenant = await getATenantRepo({ "settings.markets": 1 }, { _id: tenantId });
  const allowed = marketPaymentMethods(tenant, marketCode);
  return !allowed || allowed.includes(methodCode);
}
