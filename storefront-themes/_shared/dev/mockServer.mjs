#!/usr/bin/env node
/**
 * Mock storefront dev server (audit 2.6)
 * ──────────────────────────────────────
 *
 * A tiny standalone HTTP server (node:http only — no Mongo, no Redis, no
 * backend imports) that implements the READ-ONLY surface of the
 * storefront contract from static fixtures, so a theme can be developed
 * with realistic demo data and ZERO backend processes running.
 *
 * It mirrors the response envelopes of the real routes in
 * `routes/storefront.js` / the storefront controllers, sourcing its
 * content from `./fixtures.mjs` (a copy of `services/themeDemoData.js`)
 * and building `themeCustomization` from the TARGET theme's own built
 * `dist/manifest.json` — the same shape `buildCustomizationFromManifest`
 * produces in `services/theme.js`, reimplemented standalone here.
 *
 * Env:
 *   THEME_SLUG   which theme's manifest + niche fixtures to serve (default: starter)
 *   MOCK_PORT    port to listen on (default: 3000 — matches the vite proxy target,
 *                so `vite dev`'s existing /api + /storefront proxy hits this mock
 *                with no vite.config change)
 *
 * Usage (normally via scripts/dev-mock.mjs):
 *   THEME_SLUG=starter MOCK_PORT=3000 node storefront-themes/_shared/dev/mockServer.mjs
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THEME_DEMO_DATA } from "./fixtures.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEMES_ROOT = path.resolve(__dirname, "..", "..");

const THEME_SLUG = process.env.THEME_SLUG || "starter";
const PORT = parseInt(process.env.MOCK_PORT || "3000", 10);

// Fall back to the starter niche dataset when the requested theme has no
// bespoke fixtures (a brand-new scaffolded theme).
const DATA = THEME_DEMO_DATA[THEME_SLUG] || THEME_DEMO_DATA.starter;

// ─── Manifest → default customization ────────────────────────────
// Standalone reimplementation of services/theme.js buildCustomizationFromManifest.

function loadManifest(slug) {
  const p = path.join(THEMES_ROOT, slug, "dist", "manifest.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function mapTemplateSections(templateSections) {
  return (Array.isArray(templateSections) ? templateSections : []).map((s, i) => ({
    id: s.id,
    type: s.type,
    enabled: s.disabled !== true,
    order: typeof s.order === "number" ? s.order : i,
    layout: s.layout || "full-width",
    settings: s.settings || {},
    elements: s.elements || [],
    blocks: s.blocks || [],
  }));
}

function buildCustomizationFromManifest(manifest) {
  const sectionsByTemplate = {};
  const templates =
    manifest && manifest.templates && typeof manifest.templates === "object"
      ? manifest.templates
      : {};
  for (const [tid, list] of Object.entries(templates)) {
    sectionsByTemplate[tid] = mapTemplateSections(list);
  }
  if (!Array.isArray(sectionsByTemplate.index)) sectionsByTemplate.index = [];

  const settings = {
    colors: manifest?.colors || {},
    typography: manifest?.typography || {},
    layout: {},
    theme: {},
  };
  return { sectionsByTemplate, settings };
}

const MANIFEST = loadManifest(THEME_SLUG);

// ─── Shape builders (mirror services/themeDemoPreview.js) ─────────

const productId = (slug) => `demo-${slug}`;
const categoryId = (slug) => `demo-cat-${slug}`;
const collectionId = (handle) => `demo-col-${handle}`;

function buildProductCard(p) {
  return {
    _id: productId(p.slug),
    name: p.name,
    slug: p.slug,
    description: p.description || "",
    shortDescription: p.shortDescription || "",
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    images: p.images || [],
    category: categoryId(p.categorySlug),
    sku: `DEMO-${String(p.slug).toUpperCase()}`,
    stock: p.stock ?? 25,
    status: "active",
    featured: !!p.featured,
    onSale: !!p.onSale || (p.compareAtPrice != null && p.compareAtPrice > p.price),
    newArrival: !!p.newArrival,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    tags: p.tags || [],
    hasVariants: false,
    options: [],
    variants: [],
    preorder: { enabled: false },
  };
}

function buildCategory(data, c, sortOrder) {
  const productCount = (data.products || []).filter((p) => p.categorySlug === c.slug).length;
  return {
    _id: categoryId(c.slug),
    name: c.name,
    slug: c.slug,
    description: c.description || "",
    image: c.image || "",
    parentCategory: null,
    status: "active",
    sortOrder,
    productCount,
  };
}

function buildCollection(col) {
  const productIds = (col.productSlugs || []).map((s) => productId(s));
  return {
    _id: collectionId(col.handle),
    title: col.title,
    handle: col.handle,
    description: col.description || "",
    image: { url: col.image || "", alt: col.title || "" },
    type: "manual",
    productIds,
    isPublished: true,
    publishedAt: new Date().toISOString(),
    sortOrder: "manual",
    productCount: productIds.length,
  };
}

function paginate(items, query = {}) {
  const page = parseInt(query.page) > 0 ? parseInt(query.page) : 1;
  const limit = parseInt(query.limit) > 0 ? parseInt(query.limit) : 20;
  const total = items.length;
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);
  return { slice, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 0 } };
}

function sortCards(cards, sort) {
  const out = [...cards];
  switch (sort) {
    case "price_asc": out.sort((a, b) => a.price - b.price); break;
    case "price_desc": out.sort((a, b) => b.price - a.price); break;
    case "popular": out.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0)); break;
    default: break;
  }
  return out;
}

// ─── Endpoint payloads ───────────────────────────────────────────

function storeInfo() {
  const { sectionsByTemplate, settings } = buildCustomizationFromManifest(MANIFEST);
  return {
    store: {
      name: MANIFEST?.name ? `${MANIFEST.name} (Mock)` : "Mock Store",
      description: "Local mock storefront — demo data, no backend.",
      logo: null,
      favicon: null,
      currency: "USD",
      theme: THEME_SLUG,
      themeCustomization: {
        themeSlug: THEME_SLUG,
        settings,
        sections: sectionsByTemplate.index,
        sectionsByTemplate,
        customCSS: "",
        version: 1,
        publishedAt: new Date().toISOString(),
      },
      socialLinks: null,
      contactInfo: null,
      giftCards: { enabled: true },
    },
  };
}

function productsList(query = {}) {
  let cards = (DATA.products || []).map(buildProductCard);
  if (query.category) {
    const cat = String(query.category);
    cards = cards.filter((c) => c.category === cat || c.category === categoryId(cat));
  }
  if (query.minPrice) cards = cards.filter((c) => c.price >= parseFloat(query.minPrice));
  if (query.maxPrice) cards = cards.filter((c) => c.price <= parseFloat(query.maxPrice));
  if (query.search) {
    const q = String(query.search).toLowerCase();
    cards = cards.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }
  cards = sortCards(cards, query.sort);
  const { slice, pagination } = paginate(cards, query);
  return { products: slice, pagination };
}

function featuredProducts(query = {}) {
  const limit = parseInt(query.limit) > 0 ? parseInt(query.limit) : 8;
  const featured = (DATA.products || []).filter((p) => p.featured).map(buildProductCard).slice(0, limit);
  return { products: featured };
}

function productBySlug(productSlug) {
  const raw = (DATA.products || []).find((p) => p.slug === productSlug);
  if (!raw) return null;
  const cat = (DATA.categories || []).find((c) => c.slug === raw.categorySlug);
  const product = {
    ...buildProductCard(raw),
    category: cat ? { _id: categoryId(cat.slug), name: cat.name, slug: cat.slug } : null,
  };
  const sameCategory = (DATA.products || [])
    .filter((p) => p.categorySlug === raw.categorySlug && p.slug !== raw.slug)
    .map(buildProductCard);
  const relatedProducts = sameCategory.slice(0, 8);
  const relatedSlugs = new Set(relatedProducts.slice(0, 4).map((p) => p.slug));
  const frequentlyBoughtWith = sameCategory.filter((p) => !relatedSlugs.has(p.slug)).slice(0, 3);
  return {
    product,
    reviews: [],
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    relatedProducts,
    frequentlyBoughtWith,
  };
}

function categoriesList() {
  return { categories: (DATA.categories || []).map((c, i) => buildCategory(DATA, c, i)) };
}

function categoryBySlug(categorySlug, query = {}) {
  const idx = (DATA.categories || []).findIndex((c) => c.slug === categorySlug);
  if (idx === -1) return null;
  const category = buildCategory(DATA, DATA.categories[idx], idx);
  let cards = (DATA.products || []).filter((p) => p.categorySlug === categorySlug).map(buildProductCard);
  cards = sortCards(cards, query.sort);
  const { slice, pagination } = paginate(cards, query);
  return { category, products: slice, pagination };
}

function collectionsList(query = {}) {
  const collections = (DATA.collections || []).map(buildCollection);
  const { slice, pagination } = paginate(collections, query);
  return { collections: slice, pagination };
}

function collectionByHandle(handle, query = {}) {
  const raw = (DATA.collections || []).find((c) => c.handle === handle);
  if (!raw) return null;
  const collection = buildCollection(raw);
  const bySlug = new Map((DATA.products || []).map((p) => [p.slug, p]));
  const cards = (raw.productSlugs || []).map((s) => bySlug.get(s)).filter(Boolean).map(buildProductCard);
  const { slice, pagination } = paginate(cards, { ...query, limit: query.limit || 24 });
  return { collection, products: slice, pagination };
}

// Deterministic fake nav menu built from the demo categories.
function menuByHandle() {
  const items = [
    { _id: "menu-home", label: "Home", url: "/", resolvedUrl: "/", type: "link", order: 0 },
    { _id: "menu-products", label: "Products", url: "/products", resolvedUrl: "/products", type: "link", order: 1 },
    ...(DATA.categories || []).slice(0, 4).map((c, i) => ({
      _id: `menu-cat-${c.slug}`,
      label: c.name,
      url: `/categories/${c.slug}`,
      resolvedUrl: `/categories/${c.slug}`,
      type: "category",
      order: i + 2,
    })),
  ];
  return { handle: "header", title: "Header", items };
}

// Empty, deterministic cart — mutations are no-ops that echo it back.
function emptyCart() {
  return {
    cart: {
      id: "mock-cart",
      items: [],
      itemCount: 0,
      subtotal: 0,
      total: 0,
      discount: null,
      savings: 0,
    },
  };
}

const PRIMARY_MARKET = {
  _id: "mock-market",
  name: "Default",
  code: "US",
  currency: "USD",
  countries: ["US"],
  isPrimary: true,
  isActive: true,
};

// ─── Router ──────────────────────────────────────────────────────

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    // Themes fetch with credentials: 'include'; permissive CORS keeps the
    // vite dev origin happy even when proxied.
    "Access-Control-Allow-Origin": res.req?.headers?.origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  });
  res.end(body);
}

const ok = (res, data) => send(res, 200, { success: true, data });
const notFound = (res, message = "Not found") => send(res, 404, { success: false, message });

const server = http.createServer((req, res) => {
  res.req = req;
  if (req.method === "OPTIONS") return send(res, 204, {});

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const q = Object.fromEntries(url.searchParams.entries());
  const seg = p.split("/").filter(Boolean); // e.g. ['storefront','products','foo']

  // ── Storefront (public read) ──
  if (seg[0] === "storefront") {
    const rest = seg.slice(1);
    if (rest[0] === "store-info") return ok(res, storeInfo());

    if (rest[0] === "products") {
      if (rest.length === 1) return ok(res, productsList(q));
      if (rest[1] === "featured") return ok(res, featuredProducts(q));
      const detail = productBySlug(decodeURIComponent(rest[1]));
      return detail ? ok(res, detail) : notFound(res, "Product not found");
    }
    if (rest[0] === "categories") {
      if (rest.length === 1) return ok(res, categoriesList());
      const detail = categoryBySlug(decodeURIComponent(rest[1]), q);
      return detail ? ok(res, detail) : notFound(res, "Category not found");
    }
    if (rest[0] === "collections") {
      if (rest.length === 1) return ok(res, collectionsList(q));
      const detail = collectionByHandle(decodeURIComponent(rest[1]), q);
      return detail ? ok(res, detail) : notFound(res, "Collection not found");
    }
    if (rest[0] === "menus" && rest[1]) return ok(res, menuByHandle());
    if (rest[0] === "pages") {
      // No demo CMS pages — list is empty, detail 404s (themes fall back).
      if (rest.length === 1) {
        return ok(res, { pages: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } });
      }
      return notFound(res, "Page not found");
    }
    if (rest[0] === "payment-methods") return ok(res, { paymentMethods: [] });
    if (rest[0] === "checkout" && rest[1] === "quote") {
      // Deterministic zero-cost quote.
      return ok(res, { subtotal: 0, shipping: 0, tax: 0, discount: 0, total: 0, currency: "USD" });
    }
    // Unknown storefront route — empty success so themes degrade gracefully.
    return ok(res, {});
  }

  // ── /api (cart, wishlist, markets, discounts) ──
  if (seg[0] === "api") {
    const rest = seg.slice(1);
    if (rest[0] === "cart") return ok(res, emptyCart()); // GET + all mutations
    if (rest[0] === "wishlist") return ok(res, { wishlist: { products: [] } });
    if (rest[0] === "markets") {
      if (rest[1] === "resolve") return ok(res, PRIMARY_MARKET);
      return ok(res, { markets: [PRIMARY_MARKET] });
    }
    if (rest[0] === "discounts" && rest[1] === "validate") {
      return send(res, 400, { success: false, message: "Invalid discount code (mock)" });
    }
    if (rest[0] === "orders") {
      return ok(res, { orders: [] });
    }
    return ok(res, {});
  }

  return notFound(res, `No mock handler for ${p}`);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[mock] storefront mock server for "${THEME_SLUG}" on http://localhost:${PORT}` +
      (MANIFEST ? "" : ` (⚠ no dist/manifest.json for ${THEME_SLUG} — build it for real customization)`)
  );
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(
      `[mock] port ${PORT} is in use. Stop the process on that port (e.g. the real backend: ` +
        `lsof -ti tcp:${PORT} | xargs kill -9) or set MOCK_PORT.`
    );
    process.exit(1);
  }
  throw err;
});
