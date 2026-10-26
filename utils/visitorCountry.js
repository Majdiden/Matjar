/**
 * The visitor's country from the request, as hosts and CDNs report it
 * (Cloudflare, Vercel, CloudFront, App Engine, or a proxy's x-country-code).
 * Returns an upper-case ISO-3166 alpha-2 code, or null when unknown. Used to
 * pick the storefront region (market) on a first visit; the visitor can
 * change it, and checkout always prices by the shipping address.
 */
export const VISITOR_COUNTRY_HEADERS = Object.freeze([
  "cf-ipcountry",
  "x-vercel-ip-country",
  "cloudfront-viewer-country",
  "x-appengine-country",
  "x-country-code",
]);

// Placeholders some CDNs send for "unknown" / Tor.
const UNKNOWN = new Set(["XX", "T1", "ZZ", "A1", "A2", "O1"]);

export function visitorCountry(req) {
  for (const name of VISITOR_COUNTRY_HEADERS) {
    const raw = req?.headers?.[name];
    const code = String(Array.isArray(raw) ? raw[0] : raw || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code) && !UNKNOWN.has(code)) return code;
  }
  return null;
}
