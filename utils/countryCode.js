/**
 * ISO-3166 alpha-2 code for a country as addresses carry it. Storefront
 * address forms store the English country name ("Saudi Arabia",
 * storefront-themes/_shared/data/locations.ts) while markets, delivery zones
 * and tax rates are keyed by code ("SA"); compare through this.
 */
const NAME_TO_CODE = {
  "sudan": "SD", "saudi arabia": "SA", "united arab emirates": "AE", "uae": "AE", "qatar": "QA",
  "kuwait": "KW", "bahrain": "BH", "oman": "OM", "egypt": "EG", "jordan": "JO", "lebanon": "LB",
  "iraq": "IQ", "syria": "SY", "yemen": "YE", "libya": "LY", "tunisia": "TN", "algeria": "DZ",
  "morocco": "MA", "chad": "TD", "south sudan": "SS", "ethiopia": "ET", "eritrea": "ER", "kenya": "KE",
  "uganda": "UG", "nigeria": "NG", "ghana": "GH", "south africa": "ZA", "turkey": "TR", "türkiye": "TR",
  "united states": "US", "united kingdom": "GB", "canada": "CA", "australia": "AU", "germany": "DE",
  "france": "FR", "spain": "ES", "italy": "IT", "netherlands": "NL", "sweden": "SE", "switzerland": "CH",
  "india": "IN", "pakistan": "PK", "bangladesh": "BD", "china": "CN", "japan": "JP", "malaysia": "MY",
  "indonesia": "ID", "brazil": "BR",
};

/** "SA" for "SA", "sa" or "Saudi Arabia"; null when unknown or empty. */
export function toCountryCode(country) {
  const v = String(country || "").trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return NAME_TO_CODE[v.toLowerCase()] || null;
}
