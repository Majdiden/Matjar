/**
 * Store SHARE CARD — the Open Graph preview image for a store link.
 *
 * When a merchant shares their store link (WhatsApp / Facebook / X / etc.), the
 * social crawler reads `<meta property="og:image">` from the storefront HTML
 * head (injected in middlewares/storefrontMeta.js) and renders a preview. That
 * image is THIS card.
 *
 * Deliberately plain: a white 1200×630 canvas with the store logo centred and
 * uncropped, or — when the store has no logo — the store's initial letter. No
 * gradients, badges, descriptions, or footer chrome. The logo (or letter) is
 * the whole card.
 *
 * Compose approach: sharp has no text primitive, so the initial-letter fallback
 * is authored as an SVG and rasterised by sharp. A real logo bitmap (Cloudinary
 * / local URL) is fetched, fit `contain`, and composited centred over the white
 * base. A missing/broken logo degrades to the initial.
 */

import crypto from "crypto";
import sharp from "sharp";
import logger from "../utils/logger.js";

// ─── Canvas + layout constants ──────────────────────────────────────
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const CARD_BG = "#ffffff";
const INK = "#0f172a";

// The centred box the logo (or initial) is fit into. Generous so the logo
// reads large, with breathing room around the canvas edges.
const LOGO_BOX_W = 820;
const LOGO_BOX_H = 400;
const LOGO_LEFT = Math.round((CARD_WIDTH - LOGO_BOX_W) / 2);
const LOGO_TOP = Math.round((CARD_HEIGHT - LOGO_BOX_H) / 2);

const FONT_STACK =
  "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', 'Cairo', 'Noto Sans Arabic', sans-serif";

// ─── Cache ──────────────────────────────────────────────────────────
//
// Composing the card fetches the logo + rasterises SVG, so it must not run on
// every crawler hit. Keyed by `tenantId:version` where `version` is a hash of
// the inputs (logo url + store name) — a changed logo yields a new key and the
// stale entry ages out. A short TTL + tiny LRU cap keep memory bounded.
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

/** Absolute URL against the store origin for possibly-relative asset paths. */
function absUrl(baseUrl, maybeUrl) {
  if (!maybeUrl) return null;
  if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
  return `${baseUrl}${String(maybeUrl).startsWith("/") ? "" : "/"}${maybeUrl}`;
}

/**
 * Fetch the store logo and fit it (whole, uncropped) inside a `w×h` box with
 * transparent padding, so the composite can drop it at a fixed centred
 * position. Uses `fit: contain` (NOT cover) so a wide wordmark or a tall mark
 * is never cropped. Returns null on any failure.
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

// ─── Version / signature ────────────────────────────────────────────

function computeVersion({ storeName, logo }) {
  const sig = JSON.stringify({ storeName, logo });
  return crypto.createHash("sha1").update(sig).digest("hex").slice(0, 16);
}

// ─── SVG base ───────────────────────────────────────────────────────

/**
 * The plain white base. When the store has a logo it's composited on top later
 * and this is just the background; otherwise the store initial is drawn centred.
 */
function buildBaseSvg({ hasLogo, logoInitial }) {
  const cx = CARD_WIDTH / 2;
  const initial = hasLogo
    ? ""
    : `<text x="${cx}" y="${CARD_HEIGHT / 2 + 90}" text-anchor="middle" font-family="${FONT_STACK}" font-size="260" font-weight="800" fill="${INK}">${escapeXml(logoInitial)}</text>`;

  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${CARD_BG}"/>
    ${initial}
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
  const logoUrl = absUrl(baseUrl, s.logo);

  const version = computeVersion({ storeName, logo: logoUrl });
  const cacheKey = `${tenant._id}:${version}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // Fetch the store logo — large and uncropped (contain), the card's subject.
  const logoTile = logoUrl
    ? await renderLogoContain(logoUrl, LOGO_BOX_W, LOGO_BOX_H)
    : null;

  const logoInitial = (storeName.trim().charAt(0) || "S").toUpperCase();
  const baseSvg = buildBaseSvg({ hasLogo: !!logoTile, logoInitial });

  const composites = [];
  if (logoTile) {
    composites.push({ input: logoTile, left: LOGO_LEFT, top: LOGO_TOP });
  }

  const png = await sharp(Buffer.from(baseSvg))
    .composite(composites)
    .png()
    .toBuffer();

  cacheSet(cacheKey, png);
  return png;
}
