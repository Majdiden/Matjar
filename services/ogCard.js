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

// "Profile card" layout — a professional, recognisable share-card pattern:
// a brand-gradient header band, a white rounded logo BADGE overlapping its
// bottom edge (so the logo always sits on white — reads cleanly whether the
// logo is light, dark, or transparent), then the store name, a short
// description, and a footer row (domain + "Shop now" pill).
const BAND_H = 230; // brand gradient header band height
const BADGE_W = 300; // logo badge (rounded rect, holds wide or square logos)
const BADGE_H = 180;
const BADGE_TOP = 156; // overlaps the band's bottom edge (16 + BAND_H = 246)
const BADGE_RADIUS = 32;
const LOGO_PAD = 22; // padding between the badge edge and the logo
// The contain region the logo is fit into (inside the badge), + its position
// on the canvas — reused by the compositor to drop the logo bitmap.
const LOGO_BOX_W = BADGE_W - LOGO_PAD * 2; // 256
const LOGO_BOX_H = BADGE_H - LOGO_PAD * 2; // 136
const LOGO_LEFT = Math.round((CARD_WIDTH - LOGO_BOX_W) / 2);
const LOGO_TOP = BADGE_TOP + LOGO_PAD;

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

const FONT_STACK =
  "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', 'Cairo', 'Noto Sans Arabic', sans-serif";

/**
 * Fetch the store logo and fit it (whole, uncropped) inside a `w×h` box with
 * transparent padding, so the composite can drop it at a fixed position and
 * the logo is centred within the box regardless of its aspect ratio. Uses
 * `fit: contain` (NOT cover) so a wide wordmark or a tall mark is never
 * cropped — every detail stays visible. Returns null on any failure.
 */
async function renderLogoContain(url, w, h) {
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
    return await sharp(input)
      .resize(w, h, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  } catch (e) {
    logger.warn("OG card logo fetch/resize failed; using initial fallback", {
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
  const bandBottom = 16 + BAND_H;
  const badgeX = cx - BADGE_W / 2;
  const badgeBottom = BADGE_TOP + BADGE_H;

  const nameText = clip(storeName, 28);
  const nameFontSize = nameText.length > 18 ? 48 : 56;
  const nameY = badgeBottom + 60;

  // Description — up to two centred lines under the name.
  const descLines = wrapText(description, 58, 2);
  const descStartY = nameY + 44;
  const descParts = descLines
    .map(
      (line, i) =>
        `<text x="${cx}" y="${descStartY + i * 38}" text-anchor="middle" font-family="${FONT_STACK}" font-size="27" font-weight="500" fill="${SUBTLE}">${escapeXml(line)}</text>`
    )
    .join("\n");

  // Footer row: a hairline divider, then domain (start) + "Shop now" pill (end).
  const footY = 568;
  const dividerY = 524;
  const railX = 72;
  const railEnd = CARD_WIDTH - 72;
  const pillW = 208;
  const pillH = 52;
  const pillX = railEnd - pillW;
  const pillY = footY - pillH / 2;

  // The logo badge is always white; a real logo is composited into it, else the
  // store initial is drawn in brand colour. Sits half over the band, half over
  // the card — a faux drop shadow lifts it off the white lower half.
  const initialInBadge = hasLogo
    ? ""
    : `<text x="${cx}" y="${BADGE_TOP + BADGE_H / 2 + 38}" text-anchor="middle" font-family="${FONT_STACK}" font-size="104" font-weight="800" fill="${BRAND_BLUE}">${escapeXml(logoInitial)}</text>`;

  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="card">
        <rect x="16" y="16" width="${CARD_WIDTH - 32}" height="${CARD_HEIGHT - 32}" rx="28" ry="28"/>
      </clipPath>
      <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${BRAND_BLUE}"/>
        <stop offset="1" stop-color="${BRAND_BLUE_DARK}"/>
      </linearGradient>
    </defs>

    <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${PAGE_BG}"/>
    <rect x="16" y="16" width="${CARD_WIDTH - 32}" height="${CARD_HEIGHT - 32}" rx="28" ry="28" fill="${CARD_BG}"/>

    <g clip-path="url(#card)">
      <rect x="16" y="16" width="${CARD_WIDTH - 32}" height="${BAND_H}" fill="url(#band)"/>
      <circle cx="1035" cy="30" r="150" fill="#ffffff" opacity="0.07"/>
      <circle cx="150" cy="210" r="120" fill="#ffffff" opacity="0.06"/>
      <circle cx="880" cy="220" r="70" fill="#ffffff" opacity="0.05"/>
    </g>

    <!-- logo badge (faux shadow + white plate + subtle border) -->
    <rect x="${badgeX}" y="${BADGE_TOP + 6}" width="${BADGE_W}" height="${BADGE_H}" rx="${BADGE_RADIUS}" ry="${BADGE_RADIUS}" fill="#0f172a" opacity="0.14"/>
    <rect x="${badgeX}" y="${BADGE_TOP + 3}" width="${BADGE_W}" height="${BADGE_H}" rx="${BADGE_RADIUS}" ry="${BADGE_RADIUS}" fill="#0f172a" opacity="0.08"/>
    <rect x="${badgeX}" y="${BADGE_TOP}" width="${BADGE_W}" height="${BADGE_H}" rx="${BADGE_RADIUS}" ry="${BADGE_RADIUS}" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="1"/>
    ${initialInBadge}

    <text x="${cx}" y="${nameY}" text-anchor="middle" font-family="${FONT_STACK}" font-size="${nameFontSize}" font-weight="700" fill="${INK}">${escapeXml(nameText)}</text>
    ${descParts}

    <line x1="${railX}" y1="${dividerY}" x2="${railEnd}" y2="${dividerY}" stroke="${BORDER}" stroke-width="1"/>
    <text x="${railX}" y="${footY + 8}" text-anchor="start" font-family="${FONT_STACK}" font-size="26" font-weight="600" fill="${SUBTLE}">${escapeXml(clip(domain, 38))}</text>
    <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="26" ry="26" fill="${BRAND_BLUE}"/>
    <text x="${pillX + pillW / 2}" y="${pillY + pillH / 2 + 9}" text-anchor="middle" font-family="${FONT_STACK}" font-size="25" font-weight="700" fill="#ffffff">Shop now →</text>
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

  // Fetch the store logo — large and uncropped (contain), the card's subject.
  const logoTile = logoUrl
    ? await renderLogoContain(logoUrl, LOGO_BOX_W, LOGO_BOX_H)
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
    composites.push({
      input: logoTile,
      left: Math.round((CARD_WIDTH - LOGO_BOX_W) / 2),
      top: LOGO_TOP,
    });
  }

  const png = await sharp(Buffer.from(baseSvg))
    .composite(composites)
    .png()
    .toBuffer();

  cacheSet(cacheKey, png);
  return png;
}
