/**
 * Store SHARE CARD — the Open Graph preview image for a store link.
 *
 * When a merchant shares their store link (WhatsApp / Facebook / X / etc.), the
 * social crawler reads `<meta property="og:image">` from the storefront HTML
 * head (injected in middlewares/storefrontMeta.js) and renders a preview. That
 * image is THIS card.
 *
 * A square 1200×1200 card about the store, because WhatsApp (the main sales
 * channel) shows square images large and wide ones as a thin strip:
 *
 *   - background: the store's cover photo (darkened towards the bottom so
 *     text reads), else the store's colour with a soft glow;
 *   - the logo, large, on a white rounded tile (or the store's initial);
 *   - the store name, its short line, and the store link.
 *
 * The middle band (logo and name) stays clear of the top and bottom so the
 * 2:1 crop some apps make (X/Twitter) still shows the store.
 *
 * Text is rendered by sharp's Pango text input with the bundled IBM Plex Sans
 * Arabic font (assets/fonts), so Arabic is shaped correctly without relying on
 * fonts installed on the server. Any failure (logo, cover, text) degrades to
 * the simpler parts instead of failing the card.
 */

import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import logger from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Canvas + layout ────────────────────────────────────────────────
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 1200;

const DEFAULT_COLOR = "#0f766e";
const TILE_SIZE = 560;
const TILE_TOP = 170;
const TILE_RADIUS = 56;
const TILE_PADDING = 40;
/** A logo photo at least this square (width/height, or its inverse) fills the tile. */
const PHOTO_ASPECT_MIN = 0.6;
const NAME_TOP = TILE_TOP + TILE_SIZE + 52;
const TEXT_WIDTH = 1040;
const LINK_BOTTOM_GAP = 90;

const FONT_FILE = path.join(__dirname, "..", "assets", "fonts", "IBMPlexSansArabic-SemiBold.ttf");
const FONT_FAMILY = "IBM Plex Sans Arabic";

const FETCH_TIMEOUT_MS = 4000;
/** Bump when the card design changes, so cached previews refresh. */
const CARD_LAYOUT_VERSION = 2;

// ─── Cache ──────────────────────────────────────────────────────────
//
// Composing the card fetches images and renders text, so it must not run on
// every crawler hit. Keyed by `tenantId:version` where `version` hashes every
// input — a change yields a new key and the stale entry ages out.
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

/** `#abc` / `#aabbcc` → [r, g, b], or null. */
function parseHex(value) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value ?? "").trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** WCAG relative luminance. */
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `rgb` darkened until it reads on white (for the initial on the white tile). */
function inkOnWhite(rgb) {
  let ink = rgb;
  for (let t = 0.1; (1.05 / (luminance(ink) + 0.05)) < 4.5 && t <= 1; t += 0.1) ink = mix(rgb, [0, 0, 0], t);
  return toHex(ink);
}

/** White or near-black text, whichever reads better on `rgb`. */
export function textColorOn(rgb) {
  const l = luminance(rgb);
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / (0.0056 + 0.05)) ? "#ffffff" : "#111111";
}

/** The store's text in its language, else the other one. */
function pickText(value, lang) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value[lang] || value.ar || value.en || "").trim();
}

async function fetchImage(url) {
  if (!url) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch (e) {
    logger.warn("OG card image fetch failed", { url: String(url).slice(0, 120), error: e.message });
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Single- or two-line text as a transparent PNG no wider than `width`. */
async function renderText(text, { size, color, width = TEXT_WIDTH, maxHeight }) {
  if (!text) return null;
  try {
    const markup = `<span foreground="${color}" font_desc="${FONT_FAMILY} ${size}px">${escapeXml(text)}</span>`;
    const { data, info } = await sharp({
      text: {
        text: markup,
        fontfile: FONT_FILE,
        font: FONT_FAMILY,
        width,
        height: maxHeight,
        align: "centre",
        wrap: "word",
        rgba: true,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { input: data, width: info.width, height: info.height };
  } catch (e) {
    logger.warn("OG card text render failed", { error: e.message });
    return null;
  }
}

// ─── Layers ─────────────────────────────────────────────────────────

/** Cover photo, cropped to fill, darkened towards the bottom; null without one. */
async function coverBackground(coverUrl) {
  const input = await fetchImage(coverUrl);
  if (!input) return null;
  try {
    const photo = await sharp(input).resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover" }).png().toBuffer();
    const shade = Buffer.from(`<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0.25"/>
        <stop offset="0.45" stop-color="#000" stop-opacity="0.35"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.78"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/></svg>`);
    return sharp(photo).composite([{ input: shade }]).png().toBuffer();
  } catch (e) {
    logger.warn("OG card cover failed; using the store colour", { error: e.message });
    return null;
  }
}

/** The store colour with a soft light glow behind the logo and a deeper bottom. */
function colorBackgroundSvg(hex) {
  const rgb = parseHex(hex) || parseHex(DEFAULT_COLOR);
  const light = toHex(mix(rgb, [255, 255, 255], 0.22));
  const deep = toHex(mix(rgb, [0, 0, 0], 0.28));
  const base = toHex(rgb);
  return Buffer.from(`<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${base}"/><stop offset="1" stop-color="${deep}"/>
      </linearGradient>
      <radialGradient id="r" cx="0.5" cy="${(TILE_TOP + TILE_SIZE / 2) / CARD_HEIGHT}" r="0.55">
        <stop offset="0" stop-color="${light}" stop-opacity="0.9"/><stop offset="1" stop-color="${light}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#v)"/>
    <rect width="100%" height="100%" fill="url(#r)"/>
  </svg>`);
}

/** White rounded tile with a soft shadow, holding the logo (contain) or the initial. */
async function logoTile({ logoUrl, initial, color }) {
  const shadowPad = 40;
  const size = TILE_SIZE + shadowPad * 2;
  const tileSvg = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity="0.28"/>
    </filter></defs>
    <rect x="${shadowPad}" y="${shadowPad}" width="${TILE_SIZE}" height="${TILE_SIZE}" rx="${TILE_RADIUS}" fill="#ffffff" filter="url(#s)"/>
  </svg>`);

  const inner = TILE_SIZE - TILE_PADDING * 2;
  let mark = null;
  let markOffset = shadowPad + TILE_PADDING;
  const logoInput = await fetchImage(logoUrl);
  if (logoInput) {
    try {
      // A photo used as a logo (opaque, roughly square) fills the whole
      // rounded tile; a wordmark or transparent mark sits whole inside it.
      const [{ isOpaque }, meta] = await Promise.all([sharp(logoInput).stats(), sharp(logoInput).metadata()]);
      const aspect = meta.width && meta.height ? meta.width / meta.height : 1;
      if (isOpaque && aspect >= PHOTO_ASPECT_MIN && aspect <= 1 / PHOTO_ASPECT_MIN) {
        const mask = Buffer.from(
          `<svg width="${TILE_SIZE}" height="${TILE_SIZE}"><rect width="${TILE_SIZE}" height="${TILE_SIZE}" rx="${TILE_RADIUS}"/></svg>`
        );
        mark = await sharp(logoInput)
          .resize(TILE_SIZE, TILE_SIZE, { fit: "cover" })
          .composite([{ input: mask, blend: "dest-in" }])
          .png()
          .toBuffer();
        markOffset = shadowPad;
      } else {
        mark = await sharp(logoInput)
          .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .png()
          .toBuffer();
      }
    } catch (e) {
      logger.warn("OG card logo resize failed; using the initial", { error: e.message });
      mark = null;
    }
  }
  if (!mark) {
    const letter = await renderText(initial, { size: 260, color, width: inner, maxHeight: inner });
    if (letter) {
      mark = await sharp({ create: { width: inner, height: inner, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: letter.input, left: Math.round((inner - letter.width) / 2), top: Math.round((inner - letter.height) / 2) }])
        .png()
        .toBuffer();
    }
  }
  const composites = mark ? [{ input: mark, left: markOffset, top: markOffset }] : [];
  return { input: await sharp(tileSvg).composite(composites).png().toBuffer(), offset: shadowPad, size };
}

/** A rounded translucent pill with the store link. */
async function linkPill(host, onDark) {
  const label = await renderText(host, { size: 38, color: onDark ? "#ffffff" : "#111111", maxHeight: 60 });
  if (!label) return null;
  const padX = 36;
  const h = 78;
  const w = Math.min(TEXT_WIDTH, label.width + padX * 2);
  const pill = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${h / 2}" fill="${onDark ? "#ffffff" : "#000000"}" fill-opacity="${onDark ? 0.18 : 0.1}"/>
  </svg>`);
  const input = await sharp(pill)
    .composite([{ input: label.input, left: Math.round((w - label.width) / 2), top: Math.round((h - label.height) / 2) }])
    .png()
    .toBuffer();
  return { input, width: w, height: h };
}

// ─── Version / signature ────────────────────────────────────────────

function computeVersion(parts) {
  return crypto.createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

// ─── Public ─────────────────────────────────────────────────────────

/** What the card shows for a tenant (shared by the image and its version). */
function storeCardInputs(tenant, baseUrl) {
  const s = tenant?.settings || {};
  const brand = s.brand || {};
  const lang = s.language === "en" ? "en" : "ar";
  return {
    storeName: String(s.storeName || tenant?.name || "Store").trim(),
    tagline: pickText(brand.tagline, lang),
    logoUrl: absUrl(baseUrl, s.logo),
    coverUrl: absUrl(baseUrl, brand.coverImage),
    color: parseHex(brand.color) ? brand.color : DEFAULT_COLOR,
    host: String(baseUrl || "").replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
  };
}

/**
 * Short fingerprint of everything on the card. The page tags put it in the
 * image URL (`?v=`), so apps that cache previews by URL (WhatsApp) fetch the
 * new card after the merchant changes their logo, name, colour or cover.
 */
export function storeCardVersion(tenant, baseUrl) {
  return computeVersion({ ...storeCardInputs(tenant, baseUrl), layout: CARD_LAYOUT_VERSION });
}

/**
 * Compose (or serve from cache) the share-card PNG for a tenant.
 *
 * @param {object} tenant  resolved tenant doc (has `_id`, `settings`)
 * @param {string} baseUrl store origin, e.g. "https://store.example.com"
 * @returns {Promise<Buffer>} PNG buffer (1200×1200)
 */
export async function buildStoreCardPng(tenant, baseUrl) {
  const { storeName, tagline, logoUrl, coverUrl, color, host } = storeCardInputs(tenant, baseUrl);
  const version = storeCardVersion(tenant, baseUrl);
  const cacheKey = `${tenant._id}:${version}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const cover = await coverBackground(coverUrl);
  const background = cover || colorBackgroundSvg(color);
  // Text sits on the darkened photo (white) or on the store colour (its contrast).
  const ink = cover ? "#ffffff" : textColorOn(parseHex(color));
  const onDark = ink === "#ffffff";
  const accent = inkOnWhite(parseHex(color));

  const initial = (storeName.charAt(0) || "S").toUpperCase();
  const [tile, name, line, pill] = await Promise.all([
    logoTile({ logoUrl, initial, color: accent }),
    renderText(storeName, { size: 84, color: ink, maxHeight: 230 }),
    renderText(tagline, { size: 44, color: ink, maxHeight: 130 }),
    host ? linkPill(host, onDark) : null,
  ]);

  const composites = [];
  const tileLeft = Math.round((CARD_WIDTH - TILE_SIZE) / 2) - tile.offset;
  composites.push({ input: tile.input, left: tileLeft, top: TILE_TOP - tile.offset });
  let y = NAME_TOP;
  if (name) {
    composites.push({ input: name.input, left: Math.round((CARD_WIDTH - name.width) / 2), top: y });
    y += name.height + 14;
  }
  if (line) {
    composites.push({ input: line.input, left: Math.round((CARD_WIDTH - line.width) / 2), top: y });
  }
  if (pill) {
    composites.push({
      input: pill.input,
      left: Math.round((CARD_WIDTH - pill.width) / 2),
      top: CARD_HEIGHT - LINK_BOTTOM_GAP - pill.height,
    });
  }

  const png = await sharp(background).composite(composites).png().toBuffer();
  cacheSet(cacheKey, png);
  return png;
}
