/**
 * Geo pricing for the public plan catalog (quick FX conversion).
 *
 * Subscription plans are stored in a single base currency (SDG). Visitors
 * outside Sudan should see an APPROXIMATE local-currency price rather than a
 * raw SDG figure. This module detects the visitor's country from edge
 * headers and converts the base amount using a static FX table.
 *
 * Scope (deliberately small — this is the "quick fix"):
 *   • No per-region admin pricing — one base price, converted for display.
 *   • Rates are static + approximate (SDG is volatile); they can be
 *     overridden at deploy time via GEO_FX_RATES_JSON (a JSON object of
 *     { CURRENCY: unitsPerUSD }). The displayed amount is indicative only.
 *
 * Everything is best-effort: on any gap (unknown country, missing rate) we
 * fall back to the plan's own base currency so a price is always shown.
 */

// Approximate USD anchor for SDG. SDG is highly volatile — this is a
// display convenience, not a billing rate. Override the whole table via
// GEO_FX_RATES_JSON if you need something closer to the day's market.
const SDG_PER_USD = 600;

// Units of each currency per 1 USD. Extend as needed.
const DEFAULT_PER_USD = {
  USD: 1,
  SDG: SDG_PER_USD,
  EGP: 49,
  SAR: 3.75,
  AED: 3.67,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.38,
  OMR: 0.38,
  JOD: 0.71,
  EUR: 0.92,
  GBP: 0.79,
  TRY: 34,
};

// Country (ISO-3166 alpha-2) → display currency.
const COUNTRY_CURRENCY = {
  SD: "SDG",
  EG: "EGP",
  SA: "SAR",
  AE: "AED",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  JO: "JOD",
  US: "USD",
  GB: "GBP",
  TR: "TRY",
  // Eurozone (common subset)
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR",
  IE: "EUR", PT: "EUR", AT: "EUR", BE: "EUR", FI: "EUR",
};

function ratesPerUsd() {
  const raw = process.env.GEO_FX_RATES_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_PER_USD, ...parsed };
      }
    } catch {
      // Bad override JSON — ignore and use defaults.
    }
  }
  return DEFAULT_PER_USD;
}

/**
 * Detect the visitor's ISO-3166 alpha-2 country from edge/proxy headers.
 * Returns an uppercase 2-letter code, or null when undeterminable.
 */
export function detectCountry(req) {
  const h = req?.headers || {};
  const candidates = [
    h["cf-ipcountry"], // Cloudflare
    h["x-vercel-ip-country"], // Vercel
    h["x-country-code"],
    h["x-appengine-country"], // Google
  ];
  for (const c of candidates) {
    const v = String(c || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && v !== "XX") return v;
  }
  // Fall back to the region in the first Accept-Language tag (e.g. en-EG).
  const al = String(h["accept-language"] || "");
  const m = al.match(/[a-z]{2,3}-([A-Z]{2})/);
  if (m) return m[1].toUpperCase();
  return null;
}

/** Map a country code to a display currency (null when unknown). */
export function countryToCurrency(country) {
  if (!country) return null;
  return COUNTRY_CURRENCY[country.toUpperCase()] || null;
}

/**
 * Convert a base amount into a target currency using the static table.
 * Rounds to a clean integer for whole-currency display. Returns null when
 * either currency has no rate.
 */
export function convert(amount, fromCurrency, toCurrency) {
  const rates = ratesPerUsd();
  const from = String(fromCurrency || "").toUpperCase();
  const to = String(toCurrency || "").toUpperCase();
  if (!from || !to) return null;
  if (from === to) return Math.round(amount);
  const rFrom = rates[from];
  const rTo = rates[to];
  if (!rFrom || !rTo) return null;
  const inUsd = amount / rFrom;
  return Math.round(inUsd * rTo);
}

/**
 * Localize a plan's base price for a request. Always returns a usable
 * shape; `converted` is false when we fell back to the base currency.
 */
export function localizePrice(req, basePrice, baseCurrency = "SDG") {
  const base = String(baseCurrency || "SDG").toUpperCase();
  const country = detectCountry(req);
  const target = countryToCurrency(country);
  if (!target || target === base) {
    return {
      country,
      displayPrice: Math.round(Number(basePrice) || 0),
      displayCurrency: base,
      converted: false,
    };
  }
  const displayPrice = convert(Number(basePrice) || 0, base, target);
  if (displayPrice == null) {
    return {
      country,
      displayPrice: Math.round(Number(basePrice) || 0),
      displayCurrency: base,
      converted: false,
    };
  }
  return { country, displayPrice, displayCurrency: target, converted: true };
}
