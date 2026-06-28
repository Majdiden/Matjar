/**
 * Theme demo PREVIEW (ephemeral)
 * ------------------------------
 * This module maps the in-memory `THEME_DEMO_DATA` (see services/themeDemoData.js)
 * into the EXACT response envelopes the storefront data endpoints return, so a
 * merchant can preview any theme rendered with niche demo content WITHOUT ever
 * writing anything to the database.
 *
 * It is the read-only counterpart to `seedThemeDemoData`:
 *   - `seedThemeDemoData(...)`  → PERSISTS demo docs (used by tooling, NOT preview)
 *   - this module               → builds API payloads PURELY from memory
 *
 * Nothing here touches Mongoose / the DB. Every function is synchronous and
 * derives its output entirely from `THEME_DEMO_DATA[slug]`. Stable, string
 * `_id`s are synthesized (`demo-<slug>` / `demo-cat-<slug>` / `demo-col-<handle>`)
 * so the storefront can link products ↔ categories ↔ collections and round-trip
 * slugs/handles back to this module on the by-slug / by-handle endpoints.
 *
 * Contract: never throw on bad input. A missing/unknown theme slug yields `null`
 * from `getPreviewThemeSlug`, which makes the calling controller fall straight
 * back to its normal DB-backed behavior.
 */

import { THEME_DEMO_DATA } from "./themeDemoData.js";

// ─── Stable synthetic ids ────────────────────────────────────────────────────
const productId = (slug) => `demo-${slug}`;
const categoryId = (slug) => `demo-cat-${slug}`;
const collectionId = (handle) => `demo-col-${handle}`;

// ─── Preview-slug resolution ─────────────────────────────────────────────────

/**
 * Resolve the preview theme slug from a request, but ONLY when there is a demo
 * dataset for it. Returns the slug string, or `null` when the request is not a
 * demo preview (no `previewTheme` query param, or an unknown slug) — in which
 * case the controller must continue with its normal DB query.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function getPreviewThemeSlug(req) {
  const raw = req && req.query ? req.query.previewTheme : undefined;
  const slug = typeof raw === "string" ? raw.trim() : "";
  if (!slug) return null;
  return Object.prototype.hasOwnProperty.call(THEME_DEMO_DATA, slug) ? slug : null;
}

// ─── Shape builders ──────────────────────────────────────────────────────────

/**
 * Build the lightweight product "card" shape returned by the products list,
 * featured, related and category-products endpoints. Mirrors the fields the
 * storefront `productCardSelect` projects (+ a few harmless extras the seed
 * sets), plus an explicit string `_id` and the demo category id so the
 * storefront can link a product to its category.
 */
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
    // Demo products are simple, single-SKU items — declare the variant/preorder
    // shape explicitly so the storefront's "has options?" checks resolve cleanly.
    hasVariants: false,
    options: [],
    variants: [],
    preorder: { enabled: false },
  };
}

/**
 * Build the category shape returned by the categories list endpoint (mirrors
 * the `name slug description image parentCategory` projection + `_id`).
 */
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

/**
 * Build the collection shape returned by the collections list / by-handle
 * endpoints (mirrors a lean Collection doc).
 */
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paginate(items, query = {}) {
  const page = parseInt(query.page) > 0 ? parseInt(query.page) : 1;
  const limit = parseInt(query.limit) > 0 ? parseInt(query.limit) : 20;
  const total = items.length;
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);
  return {
    slice,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  };
}

function sortCards(cards, sort) {
  const out = [...cards];
  switch (sort) {
    case "price_asc": out.sort((a, b) => a.price - b.price); break;
    case "price_desc": out.sort((a, b) => b.price - a.price); break;
    case "popular": out.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0)); break;
    // "newest" / default: keep dataset order (already curated).
    default: break;
  }
  return out;
}

// ─── Endpoint payload builders ───────────────────────────────────────────────

/**
 * GET /storefront/products  →  { products, pagination }
 * Honours category (by demo category id OR bare slug), search, min/maxPrice
 * and sort, matching the real controller's supported filters.
 */
export function demoProductsList(slug, query = {}) {
  const data = THEME_DEMO_DATA[slug];
  let cards = (data.products || []).map(buildProductCard);

  if (query.category) {
    const cat = String(query.category);
    cards = cards.filter((c) => c.category === cat || c.category === categoryId(cat));
  }
  if (query.minPrice) cards = cards.filter((c) => c.price >= parseFloat(query.minPrice));
  if (query.maxPrice) cards = cards.filter((c) => c.price <= parseFloat(query.maxPrice));
  if (query.search) {
    const q = String(query.search).toLowerCase();
    cards = cards.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }

  cards = sortCards(cards, query.sort);
  const { slice, pagination } = paginate(cards, query);
  return { products: slice, pagination };
}

/**
 * GET /storefront/products/featured  →  { products }
 */
export function demoFeaturedProducts(slug, query = {}) {
  const data = THEME_DEMO_DATA[slug];
  const limit = parseInt(query.limit) > 0 ? parseInt(query.limit) : 8;
  const featured = (data.products || [])
    .filter((p) => p.featured)
    .map(buildProductCard)
    .slice(0, limit);
  return { products: featured };
}

/**
 * GET /storefront/products/:slug  →
 *   { product, reviews, ratingDistribution, relatedProducts, frequentlyBoughtWith }
 * Returns `null` when the demo theme has no product with that slug (caller 404s).
 */
export function demoProductBySlug(slug, productSlug) {
  const data = THEME_DEMO_DATA[slug];
  const raw = (data.products || []).find((p) => p.slug === productSlug);
  if (!raw) return null;

  // Populate category as { _id, name, slug } to mirror the real `.populate`.
  const cat = (data.categories || []).find((c) => c.slug === raw.categorySlug);
  const product = {
    ...buildProductCard(raw),
    category: cat ? { _id: categoryId(cat.slug), name: cat.name, slug: cat.slug } : null,
  };

  const sameCategory = (data.products || [])
    .filter((p) => p.categorySlug === raw.categorySlug && p.slug !== raw.slug)
    .map(buildProductCard);

  const relatedProducts = sameCategory.slice(0, 8);
  const relatedSlugs = new Set(relatedProducts.slice(0, 4).map((p) => p.slug));
  const frequentlyBoughtWith = sameCategory
    .filter((p) => !relatedSlugs.has(p.slug))
    .slice(0, 3);

  return {
    product,
    reviews: [],
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    relatedProducts,
    frequentlyBoughtWith,
  };
}

/**
 * GET /storefront/categories  →  { categories }
 */
export function demoCategoriesList(slug) {
  const data = THEME_DEMO_DATA[slug];
  const categories = (data.categories || []).map((c, i) => buildCategory(data, c, i));
  return { categories };
}

/**
 * GET /storefront/categories/:slug  →  { category, products, pagination }
 * Returns `null` when the demo theme has no category with that slug.
 */
export function demoCategoryBySlug(slug, categorySlug, query = {}) {
  const data = THEME_DEMO_DATA[slug];
  const idx = (data.categories || []).findIndex((c) => c.slug === categorySlug);
  if (idx === -1) return null;
  const category = buildCategory(data, data.categories[idx], idx);

  let cards = (data.products || [])
    .filter((p) => p.categorySlug === categorySlug)
    .map(buildProductCard);
  cards = sortCards(cards, query.sort);
  const { slice, pagination } = paginate(cards, query);
  return { category, products: slice, pagination };
}

/**
 * GET /storefront/collections  →  { collections, pagination }
 */
export function demoCollectionsList(slug, query = {}) {
  const data = THEME_DEMO_DATA[slug];
  const collections = (data.collections || []).map(buildCollection);
  const { slice, pagination } = paginate(collections, query);
  return { collections: slice, pagination };
}

/**
 * GET /storefront/collections/:handle  →  { collection, products, pagination }
 * Returns `null` when the demo theme has no collection with that handle.
 */
export function demoCollectionByHandle(slug, handle, query = {}) {
  const data = THEME_DEMO_DATA[slug];
  const raw = (data.collections || []).find((c) => c.handle === handle);
  if (!raw) return null;
  const collection = buildCollection(raw);

  // Resolve the collection's products in declared order from the demo catalog.
  const bySlug = new Map((data.products || []).map((p) => [p.slug, p]));
  const cards = (raw.productSlugs || [])
    .map((s) => bySlug.get(s))
    .filter(Boolean)
    .map(buildProductCard);
  const { slice, pagination } = paginate(cards, { ...query, limit: query.limit || 24 });
  return { collection, products: slice, pagination };
}
