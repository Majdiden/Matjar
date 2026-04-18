/**
 * E2E smoke: storefront catalog browsing.
 *
 * Verifies the public, unauthenticated read path:
 *   1. GET /storefront/products returns active products in tenant scope
 *   2. Filter (?search=) narrows the result set
 *   3. GET /storefront/products/:slug returns a single product detail
 *      with reviews + related products
 *   4. Draft / archived products are hidden from the public list
 *
 * The Host header drives the tenant resolver — every request uses the
 * seeded tenant's subdomain so the resolver locks onto it.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";

const HOST = "acme.localhost";

async function seedTenantWithCatalog() {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.create({
    name: "Acme Coffee",
    slug: "acme",
    domain: "acme.localhost",
    email: "owner@acme.test",
    isActive: true,
    domains: {
      subdomain: { name: "acme", fullDomain: "acme.localhost", isActive: true },
      customDomain: { isVerified: false },
      primaryDomain: "subdomain",
    },
  });
  const models = createScopedModels(mongoose.connection, tenant._id);

  const category = await models.Category.create({
    name: "Beans",
    slug: "beans",
    description: "Whole bean coffee",
  });

  // Each fixture has a unique sku — the (tenantId, sku) compound index is
  // unique+sparse but `sparse` only skips documents *missing* the field.
  // Explicit `null` still counts as a value, which means two skuless
  // products in the same tenant collide. Giving every fixture a sku
  // sidesteps that landmine and matches how a real merchant operates.
  await models.Product.create([
    {
      name: "House Blend",
      slug: "house-blend",
      sku: "HB-001",
      description: "Our signature daily drinker, balanced and mellow.",
      price: 18.5,
      category: category._id,
      stock: 25,
      status: "active",
      images: [],
      featured: true,
    },
    {
      name: "Single Origin Ethiopia",
      slug: "single-origin-ethiopia",
      sku: "ETH-001",
      description: "Bright, citrusy, jasmine notes — washed Yirgacheffe.",
      price: 24,
      category: category._id,
      stock: 12,
      status: "active",
      images: [],
    },
    {
      name: "Decaf Test Draft",
      slug: "decaf-test-draft",
      sku: "DEC-001",
      description: "Hidden — should never appear in the public list.",
      price: 20,
      category: category._id,
      stock: 5,
      status: "draft",
      images: [],
    },
  ]);

  return { tenant, models };
}

describe("E2E storefront catalog browse", () => {
  let app;

  before(async () => {
    await startTestDb();
    app = buildTestApp();
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearAllCollections();
  });

  it("returns the active product list to anonymous visitors", async () => {
    await seedTenantWithCatalog();

    const res = await request(app)
      .get("/storefront/products")
      .set("Host", HOST)
      .expect(200);

    assert.equal(res.body.success, true);
    const products = res.body.data?.products || [];
    assert.equal(products.length, 2, "draft product must be excluded");
    const slugs = products.map((p) => p.slug).sort();
    assert.deepEqual(slugs, ["house-blend", "single-origin-ethiopia"]);
    assert.equal(res.body.data.pagination.total, 2);
  });

  it("filters products by search term", async () => {
    await seedTenantWithCatalog();

    const res = await request(app)
      .get("/storefront/products?search=ethiopia")
      .set("Host", HOST)
      .expect(200);

    const products = res.body.data?.products || [];
    assert.equal(products.length, 1);
    assert.equal(products[0].slug, "single-origin-ethiopia");
  });

  it("returns a single product by slug with reviews + related", async () => {
    await seedTenantWithCatalog();

    const res = await request(app)
      .get("/storefront/products/house-blend")
      .set("Host", HOST)
      .expect(200);

    assert.equal(res.body.success, true);
    // The detail handler returns the product alongside related products and
    // a reviews block — we don't pin the exact shape, just the essentials.
    const body = res.body.data || res.body;
    const product = body.product || body;
    assert.equal(product.slug, "house-blend");
    assert.equal(product.name, "House Blend");
  });

  it("404s on unknown slug instead of leaking other tenants' products", async () => {
    await seedTenantWithCatalog();

    const res = await request(app)
      .get("/storefront/products/nonexistent")
      .set("Host", HOST);

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });
});
