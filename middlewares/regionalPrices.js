/**
 * Storefront product prices in the shopper's region.
 *
 * The storefront shows prices by converting pricing-currency amounts with the
 * region's rate × adjustment. When a product has the merchant's own price for
 * that currency, or the region rounds prices, a plain conversion would show
 * the wrong amount, so product responses are rewritten to the
 * pricing-currency equivalent of what the shopper pays
 * (services/regionalPricing.js). The storefront sends its current region and
 * currency in these headers; without them the visitor's detected region is
 * used, as in the store-info payload.
 */
import { resolveMarket } from "../services/markets.js";
import { resolvePricingContext, contextReshapesPrices, localizeProductsDeep } from "../services/regionalPricing.js";
import { visitorCountry } from "../utils/visitorCountry.js";
import logger from "../utils/logger.js";

export const MARKET_HEADER = "x-matjar-market";
export const CURRENCY_HEADER = "x-matjar-currency";

const headerValue = (req, name, pattern) => {
  const raw = req.headers?.[name];
  const v = String(Array.isArray(raw) ? raw[0] : raw || "").trim();
  return pattern.test(v) ? v : null;
};

/** The browsing shopper's pricing, or null when the store has no tenant. */
export function pricingContextFromRequest(req) {
  const tenant = req.tenant;
  if (!tenant) return null;
  const chosen = headerValue(req, MARKET_HEADER, /^[a-z0-9-]{2,32}$/);
  const known = chosen && (tenant.settings?.markets || []).some((m) => m.enabled && m.code === chosen);
  const marketCode = known ? chosen : resolveMarket(tenant, visitorCountry(req))?.code || null;
  const currency = headerValue(req, CURRENCY_HEADER, /^[A-Z]{3}$/);
  return resolvePricingContext(tenant, { marketCode, currency });
}

/** Rewrite product prices in JSON responses for the shopper's region. */
export function regionalPrices(req, res, next) {
  let ctx = null;
  try {
    ctx = pricingContextFromRequest(req);
  } catch (err) {
    logger.warn("regionalPrices: pricing context failed", { error: err?.message });
  }
  res.vary("X-Matjar-Market");
  res.vary("X-Matjar-Currency");
  if (!contextReshapesPrices(ctx)) return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    if (!body || body.success === false || res.statusCode >= 400) return json(body);
    try {
      return json(localizeProductsDeep(JSON.parse(JSON.stringify(body)), ctx));
    } catch (err) {
      logger.warn("regionalPrices: response not localized", { error: err?.message });
      return json(body);
    }
  };
  next();
}
