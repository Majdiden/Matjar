/**
 * E2E: quick add product (PBI 10, "first sale" step 1).
 *
 * A first-time seller gives a photo, a name, a price and a quantity. Proves,
 * through the real route:
 *   1. The product is published at once, with a readable link, its name as
 *      the description, and in the store's "Our products" category.
 *   2. Later quick adds reuse that category, even after the merchant renames it.
 *   3. Only the four fields (plus an optional description) are accepted;
 *      bad values and extra keys are rejected and nothing is written.
 *   4. It needs products.write, like the full product form.
 *   5. Two first products saved at once share one category.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { throwawayPassword } from "../helpers/credentials.js";
import { QUICK_ADD_CATEGORY_KEY } from "../../services/category.js";

const HOST = "nile.localhost";
const PASSWORD = throwawayPassword();
const PHOTO = "https://cdn.example.com/perfume.jpg";

describe("E2E quick add product", () => {
  let app;
  let token;
  let models;

  const quick = (body, auth = token) => {
    const req = request(app).post("/api/products/quick").set("Host", HOST);
    if (auth) req.set("Authorization", `Bearer ${auth}`);
    return req.send(body);
  };

  before(async () => {
    await startTestDb();
    app = buildTestApp();
  });
  after(async () => { await stopTestDb(); });

  beforeEach(async () => {
    await clearAllCollections();
    const reg = await request(app).post("/api/auth/register")
      .send({ name: "Nile owner", email: "owner@nile.test", password: PASSWORD, subdomain: "nile" })
      .expect(201);
    const tenantId = reg.body.responseObject.tenantId;
    models = createScopedModels(mongoose.connection, new mongoose.Types.ObjectId(tenantId));
    const login = await request(app).post("/api/auth/login").set("Host", HOST)
      .send({ email: "owner@nile.test", password: PASSWORD, domain: HOST })
      .expect(200);
    token = login.body.responseObject.accessToken;
  });

  it("publishes the product at once in the store's own category", async () => {
    const res = await quick({ name: "  عطر صندل  ", price: 15000, stock: 3, images: [PHOTO] }).expect(201);
    const product = res.body.responseObject.data;

    assert.equal(product.name, "عطر صندل");
    assert.equal(product.status, "active");
    assert.equal(product.price, 15000);
    assert.equal(product.stock, 3);
    assert.deepEqual(product.images, [PHOTO]);
    assert.equal(product.description, "عطر صندل");
    assert.match(product.slug, /^[a-z0-9-]+$/);
    assert.match(product.sku, /^QA-[0-9A-F]{10}$/, "a SKU is generated (the index needs one per product)");

    const category = await models.Category.findById(product.category).lean();
    assert.equal(category.systemKey, QUICK_ADD_CATEGORY_KEY);
    assert.equal(category.name, "منتجاتنا", "new stores are Arabic, so the Arabic name is primary");
    assert.equal(category.translations.en.name, "Our products");
    assert.equal(category.status, "active");
  });

  it("keeps a description when one is given and reuses the category after a rename", async () => {
    const first = (await quick({ name: "Sandal", price: 10, stock: 1 }).expect(201)).body.responseObject.data;
    await models.Category.updateOne({ _id: first.category }, { $set: { name: "عطور", slug: "perfumes" } });

    const second = (await quick({ name: "Oud", price: 20, stock: 2, description: " Long-lasting oud " }).expect(201))
      .body.responseObject.data;
    assert.equal(String(second.category), String(first.category));
    assert.equal(second.description, "Long-lasting oud");
    assert.equal(await models.Category.countDocuments({}), 1);
  });

  it("rejects bad values and extra fields without writing anything", async () => {
    const bad = [
      {},
      { name: "", price: 10, stock: 1 },
      { name: "   ", price: 10, stock: 1 },
      { name: "x", price: 0, stock: 1 },
      { name: "x", price: -5, stock: 1 },
      { name: "x", price: "10", stock: 1 },
      { name: "x", price: 10, stock: 1.5 },
      { name: "x", price: 10, stock: -1 },
      { name: "x", price: 10 },
      { name: "x", price: 10, stock: 1, images: ["javascript:alert(1)"] },
      { name: "x", price: 10, stock: 1, status: "draft" },
      { name: "x", price: 10, stock: 1, category: new mongoose.Types.ObjectId().toString() },
      { name: "x", price: 10, stock: 1, tenantId: new mongoose.Types.ObjectId().toString() },
    ];
    for (const body of bad) {
      await quick(body).expect(400);
    }
    assert.equal(await models.Product.countDocuments({}), 0);
    assert.equal(await models.Category.countDocuments({}), 0);
  });

  it("needs a signed-in user with products.write", async () => {
    await quick({ name: "x", price: 10, stock: 1 }, null).expect(401);
  });

  it("creates one category when two first products are saved at once", async () => {
    const results = await Promise.all([
      quick({ name: "One", price: 10, stock: 1 }),
      quick({ name: "Two", price: 10, stock: 1 }),
      quick({ name: "Three", price: 10, stock: 1 }),
    ]);
    for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(await models.Category.countDocuments({ systemKey: QUICK_ADD_CATEGORY_KEY }), 1);
    const categories = new Set(results.map((r) => String(r.body.responseObject.data.category)));
    assert.equal(categories.size, 1);
  });
});
