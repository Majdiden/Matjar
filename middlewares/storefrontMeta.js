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
 * @param {string} o.baseUrl  e.g. "https://store.matjar.to"
 * @param {string} o.path     req.originalUrl path (for og:url)
 * @param {object} [o.product] optional product for product pages
 */
export function buildStorefrontHead({ tenant, baseUrl, path = "/", product }) {
  const s = tenant?.settings || {};
  const storeName = s.storeName || tenant?.name || "Store";
  const favicon = absUrl(baseUrl, s.favicon || s.logo);
  const url = `${baseUrl}${path || "/"}`;

  // The dynamically composed store SHARE CARD (logo + 3 featured products),
  // served by GET /og/store-card.png on the tenant's own host. Absolute so
  // social crawlers can fetch it. Used as the store/home OG image and the
  // site-wide default; product pages keep their own product image below.
  const storeCardUrl = `${baseUrl}/og/store-card.png`;

  let title;
  let description;
  let image;
  // Whether `image` is the 1200×630 composed card (drives og:image:width/height
  // and the large Twitter card). Product images have unknown dimensions.
  let isComposedCard = false;

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
    // Product page keeps its product image; fall back to the composed store
    // card (never the bare logo) when the product has no image.
    image = absUrl(baseUrl, product.images?.[0]);
    if (!image) {
      image = storeCardUrl;
      isComposedCard = true;
    }
  } else {
    title = storeName;
    description = s.storeDescription || `Shop ${storeName}`;
    image = storeCardUrl;
    isComposedCard = true;
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
    isComposedCard ? metaTag("og:image:width", "1200") : "",
    isComposedCard ? metaTag("og:image:height", "630") : "",
    isComposedCard ? metaTag("og:image:type", "image/png") : "",
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

/**
 * Build a lightweight, fixed-position "DRAFT — preview only" banner shown when
 * a store is being previewed or still has unpublished starter content. Injected
 * server-side so it works for ANY theme without per-theme edits. Bilingual via
 * the tenant language; dismissible (inline onclick removes it — CSP allows
 * 'unsafe-inline' for the storefront).
 *
 * @param {object} o
 * @param {string} [o.lang] tenant language ("ar" → RTL/Arabic copy)
 */
export function buildDraftBanner({ lang } = {}) {
  const isAr = String(lang || "").toLowerCase().startsWith("ar");
  const dir = isAr ? "rtl" : "ltr";
  const text = isAr
    ? "مسودة — للمعاينة فقط، لم تُنشر بعد"
    : "DRAFT — preview only, not yet published";
  const dismissLabel = isAr ? "إغلاق" : "Dismiss";

  // Single self-contained node with inline styles so it renders identically on
  // every theme and survives the SPA mount (it lives outside #root). z-index is
  // high enough to sit above storefront chrome; pointer-events stay on the bar
  // only so it never blocks the page underneath once dismissed.
  return (
    `<div id="matjar-draft-banner" dir="${dir}" role="status" ` +
    `style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;` +
    `display:flex;align-items:center;justify-content:center;gap:12px;` +
    `padding:10px 16px;` +
    `font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;` +
    `font-size:14px;font-weight:600;line-height:1.3;` +
    `background:#111827;color:#fff;box-shadow:0 -2px 10px rgba(0,0,0,.25);">` +
    `<span style="display:inline-flex;align-items:center;gap:8px;">` +
    `<span aria-hidden="true" style="display:inline-block;width:8px;height:8px;` +
    `border-radius:50%;background:#f59e0b;"></span>` +
    `${escapeHtml(text)}</span>` +
    `<button type="button" aria-label="${escapeHtml(dismissLabel)}" ` +
    `onclick="document.getElementById('matjar-draft-banner').remove()" ` +
    `style="background:transparent;border:0;color:#fff;cursor:pointer;` +
    `font-size:18px;line-height:1;padding:0 4px;opacity:.8;">&times;</button>` +
    `</div>`
  );
}

/**
 * Inject a banner (or any markup) just before </body>. No-ops if the doc has
 * no </body> so we never corrupt the document.
 */
export function injectBodyBanner(html, bannerHtml) {
  if (!bannerHtml) return html;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${bannerHtml}\n</body>`);
  }
  return html;
}
