/**
 * Store SHARE CARD — dynamically composed Open Graph image.
 *
 * When a merchant shares their store link (WhatsApp / Facebook / X / etc.),
 * the social crawler reads `<meta property="og:image">` from the storefront
 * HTML head (injected in middlewares/storefrontMeta.js) and renders a preview.
 * That image is THIS card: a 1200×630 PNG showing the store logo, name, and
 * short description, composed server-side.
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

// Logo-centric layout: a large centred logo, the store name, and a
// one/two-line description. No product grid — a store with few products
// left empty tiles, and the logo + description reads cleaner everywhere.
const LOGO = 172;
const LOGO_RADIUS = 40;
const LOGO_TOP = 96;

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

function computeVersion({ storeName, logo, description, domain }) {
  const sig = JSON.stringify({ storeName, logo, description, domain });
  return crypto.createHash("sha1").update(sig).digest("hex").slice(0, 16);
}

/** Word-wrap `str` into at most `maxLines` lines of ~`maxChars` each. */
function wrapText(str, maxChars, maxLines) {
  const words = String(str ?? "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  // If we ran out of room mid-text, ellipsize the last line.
  const consumed = lines.join(" ").length;
  if (consumed < String(str ?? "").trim().length && lines.length) {
    lines[lines.length - 1] = clip(`${lines[lines.length - 1]}…`, maxChars);
  }
  return lines;
}

// ─── SVG base ───────────────────────────────────────────────────────

/**
 * Build the vector base of the card: page/card background, a brand accent bar,
 * the logo tile (initial-letter fallback when the store has no logo), the store
 * name, the three product tiles' frames + name + price text, and the footer
 * (domain + "Shop now" pill). Bitmaps are composited on top afterwards.
 */
function buildBaseSvg({ storeName, hasLogo, logoInitial, description, domain }) {
  const cx = CARD_WIDTH / 2;
  const logoX = cx - LOGO / 2;

  const nameText = clip(storeName, 28);
  const nameFontSize = nameText.length > 18 ? 52 : 60;
  const nameY = LOGO_TOP + LOGO + 78;

  // Description — up to two centred lines.
  const descLines = wrapText(description, 52, 2);
  const descStartY = nameY + 58;
  const descParts = descLines
    .map(
      (line, i) =>
        `<text x="${cx}" y="${descStartY + i * 42}" text-anchor="middle" font-family="${FONT_STACK}" font-size="30" font-weight="500" fill="${SUBTLE}">${escapeXml(line)}</text>`
    )
    .join("\n");

  // Centred "Shop now" pill + domain beneath it.
  const pillW = 220;
  const pillH = 58;
  const pillX = cx - pillW / 2;
  const pillY = CARD_HEIGHT - 156;
  const domainY = CARD_HEIGHT - 58;

  const logoTile = hasLogo
    ? "" // real logo bitmap composited on top
    : `<rect x="${logoX}" y="${LOGO_TOP}" width="${LOGO}" height="${LOGO}" rx="${LOGO_RADIUS}" ry="${LOGO_RADIUS}" fill="${BRAND_BLUE}"/>
       <text x="${cx}" y="${LOGO_TOP + LOGO / 2 + 34}" text-anchor="middle" font-family="${FONT_STACK}" font-size="96" font-weight="700" fill="#ffffff">${escapeXml(logoInitial)}</text>`;

  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${PAGE_BG}"/>
    <rect x="16" y="16" width="${CARD_WIDTH - 32}" height="${CARD_HEIGHT - 32}" rx="28" ry="28" fill="${CARD_BG}"/>
    <rect x="16" y="16" width="${CARD_WIDTH - 32}" height="10" rx="5" ry="5" fill="${BRAND_BLUE}"/>

    ${logoTile}
    <text x="${cx}" y="${nameY}" text-anchor="middle" font-family="${FONT_STACK}" font-size="${nameFontSize}" font-weight="700" fill="${INK}">${escapeXml(nameText)}</text>
    ${descParts}

    <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="29" ry="29" fill="${BRAND_BLUE}"/>
    <text x="${cx}" y="${pillY + pillH / 2 + 9}" text-anchor="middle" font-family="${FONT_STACK}" font-size="27" font-weight="700" fill="#ffffff">Shop now →</text>
    <text x="${cx}" y="${domainY}" text-anchor="middle" font-family="${FONT_STACK}" font-size="26" font-weight="600" fill="${SUBTLE}">${escapeXml(clip(domain, 46))}</text>
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
  const description = (s.storeDescription || "").replace(/\s+/g, " ").trim();
  const logoUrl = absUrl(baseUrl, s.logo);
  const domain = String(baseUrl || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");

  const version = computeVersion({ storeName, logo: logoUrl, description, domain });
  const cacheKey = `${tenant._id}:${version}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // Fetch the store logo (rounded) — the card is logo-forward now.
  const logoTile = logoUrl
    ? await renderImageTile(logoUrl, LOGO, LOGO, LOGO_RADIUS)
    : null;

  const logoInitial = (storeName.trim().charAt(0) || "S").toUpperCase();
  const baseSvg = buildBaseSvg({
    storeName,
    hasLogo: !!logoTile,
    logoInitial,
    description,
    domain,
  });

  const composites = [];
  if (logoTile) {
    composites.push({ input: logoTile, left: Math.round((CARD_WIDTH - LOGO) / 2), top: LOGO_TOP });
  }

  const png = await sharp(Buffer.from(baseSvg))
    .composite(composites)
    .png()
    .toBuffer();

  cacheSet(cacheKey, png);
  return png;
}
