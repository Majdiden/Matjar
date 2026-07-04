/**
 * Store SHARE CARD — dynamically composed Open Graph image.
 *
 * When a merchant shares their store link (WhatsApp / Facebook / X / etc.),
 * the social crawler reads `<meta property="og:image">` from the storefront
 * HTML head (injected in middlewares/storefrontMeta.js) and renders a preview.
 * That image is THIS card: a 1200×630 PNG showing the store logo + name and a
 * row of 3 featured products with prices, composed server-side.
 *
 * Compose approach: sharp has no text primitive, so text (store name, product
 * names, prices, domain, "Shop now") is authored as an SVG and rasterised by
 * sharp. Product/logo bitmaps (Cloudinary / Unsplash / local URLs) are fetched,
 * resized `cover`, rounded via a `dest-in` mask, and composited over the SVG
 * base. Missing/broken images degrade to a neutral placeholder tile.
 *
 * Arabic note: SVG text shaping for Arabic depends on the platform's SVG text
 * engine (Pango/librsvg) and joining is not guaranteed; Latin text and numerals
 * always render correctly. Store/product names are rendered as-is with an
 * Arabic-capable font family in the fallback stack.
 */

import crypto from "crypto";
import sharp from "sharp";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { getShareCardProductsRepo } from "../repositories/product.js";

// ─── Canvas + layout constants ──────────────────────────────────────
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const PAD = 56; // outer padding
const BRAND_BLUE = "#2563eb";
const BRAND_BLUE_DARK = "#1d4ed8";
const INK = "#0f172a";
const SUBTLE = "#64748b";
const CARD_BG = "#ffffff";
const PAGE_BG = "#eef2f7";
const TILE_BG = "#f1f5f9";
const BORDER = "#e2e8f0";

// Header (logo + store name)
const LOGO = 96;
const HEADER_Y = 44;

// Product row
const PROD_COUNT = 3;
const PROD_GAP = 32;
const PROD_TOP = 184;
const PROD_W = Math.round((CARD_WIDTH - 2 * PAD - (PROD_COUNT - 1) * PROD_GAP) / PROD_COUNT); // 341
const PROD_IMG_H = 250;
const TILE_RADIUS = 20;

// ─── Cache ──────────────────────────────────────────────────────────
//
// Composing the card fetches 1–4 remote images + rasterises SVG, so it must
// not run on every crawler hit. Keyed by `tenantId:version` where `version` is
// a hash of the exact inputs (logo, name, currency, the 3 products' ids/prices/
// images) — so a changed logo or a re-curated featured set yields a new key and
// the stale entry ages out. Entries also carry a short TTL. A tiny LRU cap keeps
// memory bounded across many tenants.
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const CACHE_MAX = 500;
const cache = new Map(); // "tenantId:version" → { buffer, expiresAt }

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  // LRU touch
  cache.delete(key);
  cache.set(key, hit);
  return hit.buffer;
}

function cacheSet(key, buffer) {
  cache.set(key, { buffer, expiresAt: Date.now() + CACHE_TTL_MS });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/** Test/ops hook: drop the whole card cache. */
export function clearOgCardCache() {
  cache.clear();
}

// ─── Helpers ────────────────────────────────────────────────────────

function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Truncate to `max` chars, appending an ellipsis when clipped. */
function clip(str, max) {
  const s = String(str ?? "").trim();
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

/** Absolute URL against the store origin for possibly-relative asset paths. */
function absUrl(baseUrl, maybeUrl) {
  if (!maybeUrl) return null;
  if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
  return `${baseUrl}${String(maybeUrl).startsWith("/") ? "" : "/"}${maybeUrl}`;
}

/** Format a price with the store currency, e.g. `110 SDG`. */
function formatPrice(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  let num;
  try {
    num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
  } catch {
    num = String(n);
  }
  return currency ? `${num} ${currency}` : num;
}

const FONT_STACK =
  "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', 'Cairo', 'Noto Sans Arabic', sans-serif";

/**
 * Fetch a remote/absolute image and rasterise it into a rounded tile of
 * `w×h`. Returns null on any failure (network, decode, timeout) so the caller
 * can fall back to a neutral placeholder — a broken image must never fail the
 * whole card.
 */
async function renderImageTile(url, w, h, radius) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    let input;
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) return null;
      input = Buffer.from(await resp.arrayBuffer());
    } finally {
      clearTimeout(t);
    }

    const mask = Buffer.from(
      `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
    );
    return await sharp(input)
      .resize(w, h, { fit: "cover", position: "attention" })
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
  } catch (e) {
    logger.warn("OG card image fetch/resize failed; using placeholder", {
      url: String(url).slice(0, 120),
      error: e.message,
    });
    return null;
  }
}

/** A neutral placeholder tile (light card + a subtle image glyph). */
function placeholderTileSvg(w, h, radius) {
  const cx = w / 2;
  const cy = h / 2;
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="${TILE_BG}"/>
    <g fill="none" stroke="#cbd5e1" stroke-width="3">
      <rect x="${cx - 44}" y="${cy - 34}" width="88" height="68" rx="8"/>
      <circle cx="${cx - 20}" cy="${cy - 12}" r="9"/>
      <path d="M ${cx - 40} ${cy + 28} L ${cx - 8} ${cy - 2} L ${cx + 12} ${cy + 14} L ${cx + 26} ${cy + 2} L ${cx + 40} ${cy + 28} Z"/>
    </g>
  </svg>`;
}

// ─── Version / signature ────────────────────────────────────────────

function computeVersion({ storeName, logo, currency, domain, products }) {
  const sig = JSON.stringify({
    storeName,
    logo,
    currency,
    domain,
    p: (products || []).map((p) => ({
      i: String(p._id),
      n: p.name,
      pr: p.price,
      c: p.compareAtPrice,
      im: p.images?.[0] || null,
    })),
  });
  return crypto.createHash("sha1").update(sig).digest("hex").slice(0, 16);
}

// ─── SVG base ───────────────────────────────────────────────────────

/**
 * Build the vector base of the card: page/card background, a brand accent bar,
 * the logo tile (initial-letter fallback when the store has no logo), the store
 * name, the three product tiles' frames + name + price text, and the footer
 * (domain + "Shop now" pill). Bitmaps are composited on top afterwards.
 */
function buildBaseSvg({ storeName, hasLogo, logoInitial, products, tiles, domain, currency }) {
  const nameText = clip(storeName, 30);
  const nameFontSize = nameText.length > 20 ? 46 : 54;

  const logoX = PAD;
  const logoY = HEADER_Y;
  const nameX = logoX + LOGO + 30;
  const nameBaseline = logoY + LOGO / 2 + nameFontSize / 2 - 6;

  // Product tiles
  const tileParts = tiles.map((t, i) => {
    const p = products[i];
    const x = PAD + i * (PROD_W + PROD_GAP);
    const imgY = PROD_TOP;
    const name = clip(p?.name || "", 20);
    const price = formatPrice(p?.price, p?.currency || currency);
    const cmp = Number(p?.compareAtPrice);
    const onSale = cmp && cmp > Number(p?.price);
    const cmpText = onSale ? formatPrice(cmp, p?.currency || currency) : "";
    const textY = imgY + PROD_IMG_H + 42;
    const priceY = textY + 40;
    return `
      <rect x="${x}" y="${imgY}" width="${PROD_W}" height="${PROD_IMG_H}" rx="${TILE_RADIUS}" ry="${TILE_RADIUS}" fill="${TILE_BG}" stroke="${BORDER}" stroke-width="1"/>
      <text x="${x + 6}" y="${textY}" font-family="${FONT_STACK}" font-size="26" font-weight="600" fill="${INK}">${escapeXml(name)}</text>
      <text x="${x + 6}" y="${priceY}" font-family="${FONT_STACK}" font-size="27" font-weight="700" fill="${BRAND_BLUE}">${escapeXml(price)}${
        cmpText
          ? `<tspan dx="12" font-size="20" font-weight="500" fill="${SUBTLE}" text-decoration="line-through">${escapeXml(cmpText)}</tspan>`
          : ""
      }</text>`;
  });

  // Footer
  const footerY = CARD_HEIGHT - 46;
  const pillW = 176;
  const pillH = 52;
  const pillX = CARD_WIDTH - PAD - pillW;
  const pillY = footerY - pillH + 12;

  const logoTile = hasLogo
    ? "" // real logo bitmap composited on top
    : `<rect x="${logoX}" y="${logoY}" width="${LOGO}" height="${LOGO}" rx="24" ry="24" fill="${BRAND_BLUE}"/>
       <text x="${logoX + LOGO / 2}" y="${logoY + LOGO / 2 + 20}" text-anchor="middle" font-family="${FONT_STACK}" font-size="52" font-weight="700" fill="#ffffff">${escapeXml(logoInitial)}</text>`;

  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${PAGE_BG}"/>
    <rect x="16" y="16" width="${CARD_WIDTH - 32}" height="${CARD_HEIGHT - 32}" rx="28" ry="28" fill="${CARD_BG}"/>
    <rect x="16" y="16" width="${CARD_WIDTH - 32}" height="10" rx="5" ry="5" fill="${BRAND_BLUE}"/>

    ${logoTile}
    <text x="${nameX}" y="${nameBaseline}" font-family="${FONT_STACK}" font-size="${nameFontSize}" font-weight="700" fill="${INK}">${escapeXml(nameText)}</text>
    <text x="${nameX + 2}" y="${nameBaseline + 34}" font-family="${FONT_STACK}" font-size="24" font-weight="500" fill="${SUBTLE}">${escapeXml(clip(domain, 42))}</text>

    ${tileParts.join("\n")}

    <text x="${PAD}" y="${footerY}" font-family="${FONT_STACK}" font-size="26" font-weight="600" fill="${SUBTLE}">${escapeXml(clip(domain, 40))}</text>
    <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="26" ry="26" fill="${BRAND_BLUE}"/>
    <text x="${pillX + pillW / 2}" y="${pillY + pillH / 2 + 9}" text-anchor="middle" font-family="${FONT_STACK}" font-size="26" font-weight="700" fill="#ffffff">Shop now →</text>
  </svg>`;
}

// ─── Public: build the PNG for a resolved tenant ─────────────────────

/**
 * Compose (or serve from cache) the share-card PNG for a tenant.
 *
 * @param {object} tenant  resolved tenant doc (has `_id`, `settings`)
 * @param {string} baseUrl store origin, e.g. "https://store.example.com"
 * @returns {Promise<Buffer>} PNG buffer (1200×630)
 */
export async function buildStoreCardPng(tenant, baseUrl) {
  const s = tenant?.settings || {};
  const storeName = s.storeName || tenant?.name || "Store";
  const currency = s.currency || "";
  const logoUrl = absUrl(baseUrl, s.logo);
  const domain = String(baseUrl || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");

  // Featured products via the repository layer (mirrors the storefront
  // featured selection; falls back to newest active).
  let products = [];
  try {
    const models = createScopedModels(mongoose.connection, tenant._id);
    products = await getShareCardProductsRepo(models, PROD_COUNT);
  } catch (e) {
    logger.warn("OG card product fetch failed; rendering empty product row", {
      tenantId: tenant?._id?.toString?.(),
      error: e.message,
    });
  }

  const version = computeVersion({ storeName, logo: logoUrl, currency, domain, products });
  const cacheKey = `${tenant._id}:${version}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // Fetch the (up to 3) product bitmaps + the logo in parallel.
  const [tiles, logoTile] = await Promise.all([
    Promise.all(
      Array.from({ length: PROD_COUNT }, (_, i) => {
        const p = products[i];
        const img = absUrl(baseUrl, p?.images?.[0]);
        return renderImageTile(img, PROD_W, PROD_IMG_H, TILE_RADIUS);
      })
    ),
    logoUrl ? renderImageTile(logoUrl, LOGO, LOGO, 24) : Promise.resolve(null),
  ]);

  const logoInitial = (storeName.trim().charAt(0) || "S").toUpperCase();
  const baseSvg = buildBaseSvg({
    storeName,
    hasLogo: !!logoTile,
    logoInitial,
    products,
    tiles,
    domain,
    currency,
  });

  const composites = [];

  // Product bitmaps (or placeholder) over each tile frame.
  for (let i = 0; i < PROD_COUNT; i++) {
    const x = PAD + i * (PROD_W + PROD_GAP);
    if (tiles[i]) {
      composites.push({ input: tiles[i], left: x, top: PROD_TOP });
    } else if (products[i]) {
      composites.push({
        input: Buffer.from(placeholderTileSvg(PROD_W, PROD_IMG_H, TILE_RADIUS)),
        left: x,
        top: PROD_TOP,
      });
    }
  }

  // Real logo bitmap over the header tile position.
  if (logoTile) {
    composites.push({ input: logoTile, left: PAD, top: HEADER_Y });
  }

  const png = await sharp(Buffer.from(baseSvg))
    .composite(composites)
    .png()
    .toBuffer();

  cacheSet(cacheKey, png);
  return png;
}
