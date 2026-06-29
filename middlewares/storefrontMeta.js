/**
 * Per-tenant <head> injection for the storefront SPA.
 *
 * The theme bundles ship one static `index.html` with a generic
 * `<title>Store</title>` and no favicon/social tags. Social scrapers
 * (Facebook, X/Twitter, WhatsApp, etc.) and the browser tab read the
 * server-rendered HTML head — they don't run the SPA's JS — so per-store
 * branding (favicon, title, OpenGraph/Twitter cards) MUST be injected
 * server-side here.
 *
 *  - Store pages → store name, description, logo as the share image, the
 *    store's own URL (independent of Matjar).
 *  - Product pages → product name, image, and price / discounted price.
 *
 * Everything is escaped; absolute URLs are built from the request host.
 */

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Make a possibly-relative asset URL absolute against the store origin. */
function absUrl(baseUrl, maybeUrl) {
  if (!maybeUrl) return null;
  if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
  return `${baseUrl}${maybeUrl.startsWith("/") ? "" : "/"}${maybeUrl}`;
}

function metaTag(property, content, attr = "property") {
  if (!content) return "";
  return `<meta ${attr}="${property}" content="${escapeHtml(content)}">`;
}

/**
 * Build the <head> tags for a storefront request.
 * @param {object} o
 * @param {object} o.tenant   resolved tenant doc (settings.{storeName,storeDescription,logo,favicon,currency})
 * @param {string} o.baseUrl  e.g. "https://store.invoila.io"
 * @param {string} o.path     req.originalUrl path (for og:url)
 * @param {object} [o.product] optional product for product pages
 */
export function buildStorefrontHead({ tenant, baseUrl, path = "/", product }) {
  const s = tenant?.settings || {};
  const storeName = s.storeName || tenant?.name || "Store";
  const favicon = absUrl(baseUrl, s.favicon || s.logo);
  const logo = absUrl(baseUrl, s.logo);
  const url = `${baseUrl}${path || "/"}`;

  let title;
  let description;
  let image;

  if (product) {
    const priceNum = Number(product.price);
    const cmp = Number(product.compareAtPrice);
    const cur = product.currency || s.currency || "";
    const onSale = cmp && cmp > priceNum;
    const priceLabel = onSale
      ? `${priceNum} ${cur} (was ${cmp} ${cur})`
      : `${priceNum} ${cur}`;
    title = `${product.name} — ${storeName}`;
    description =
      (product.description ? String(product.description).replace(/\s+/g, " ").trim().slice(0, 200) : "") ||
      `${product.name} · ${priceLabel.trim()}`;
    image = absUrl(baseUrl, product.images?.[0]) || logo;
  } else {
    title = storeName;
    description = s.storeDescription || `Shop ${storeName}`;
    image = logo;
  }

  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    metaTag("description", description, "name"),
    favicon ? `<link rel="icon" href="${escapeHtml(favicon)}">` : "",
    // OpenGraph
    metaTag("og:type", product ? "product" : "website"),
    metaTag("og:site_name", storeName),
    metaTag("og:title", title),
    metaTag("og:description", description),
    metaTag("og:url", url),
    image ? metaTag("og:image", image) : "",
    // Twitter
    metaTag("twitter:card", image ? "summary_large_image" : "summary", "name"),
    metaTag("twitter:title", title, "name"),
    metaTag("twitter:description", description, "name"),
    image ? metaTag("twitter:image", image, "name") : "",
    // product price (OpenGraph product extension)
    product ? metaTag("product:price:amount", String(product.price)) : "",
    product ? metaTag("product:price:currency", product.currency || s.currency || "") : "",
  ].filter(Boolean);

  return tags.join("\n    ");
}

/**
 * Inject head tags into an index.html string. Removes the bundle's static
 * <title> first so ours wins, then inserts before </head>.
 */
export function injectHead(html, headTags) {
  if (!headTags) return html;
  const withoutTitle = html.replace(/<title>[\s\S]*?<\/title>/i, "");
  if (withoutTitle.includes("</head>")) {
    return withoutTitle.replace("</head>", `    ${headTags}\n  </head>`);
  }
  return withoutTitle; // no head — leave as-is rather than corrupt the doc
}
