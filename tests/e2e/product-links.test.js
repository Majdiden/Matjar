/**
 * E2E: automatic product & category links (PBI 10-20).
 *
 * Merchants never invent slugs. Proves, through the real routes:
 *   1. A product with only an Arabic name gets a readable transliterated slug.
 *   2. Two products with the same name get unique slugs.
 *   3. The English name wins when the merchant filled one in.
 *   4. Renaming a product keeps its slug (shared links don't break).
 *   5. Explicitly changing a PUBLISHED product's slug leaves a 301 from the
 *      old storefront URL; a draft's slug change does not.
 *   6. Categories follow the same rules (auto slug, rename keeps it,
 *      explicit change on an active category redirects).
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { clearRedirectCache } from "../../middlewares/storefrontServe.js";

const HOST = "acme.localhost";
const DESCRIPTION = "عطر سوداني فاخر يدوم طويلاً.";

async function provisionTenant(app) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Acme Perfumes", email: "owner@acme.test", password: "Sup3rSecret!", subdomain: "acme" })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function merchantToken(app) {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Host", HOST)
    .send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: HOST })
    .expect(200);
  return res.body.responseObject.accessToken;
}

describe("E2E automatic product & category links", () => {
  let app;
  let token;
  let models;
  let categoryId;
  let skuSeq = 0;

  const api = (method, path) =>
    request(app)[method](`/api${path}`).set("Host", HOST).set("Authorization", `Bearer ${token}`);

  const createProduct = async (fields) => {
    skuSeq += 1;
    const res = await api("post", "/products")
      .send({ description: DESCRIPTION, price: 15000, stock: 5, category: categoryId, sku: `SKU-${skuSeq}`, ...fields })
      .expect(201);
    return res.body.responseObject.data;
  };

  before(async () => {
    await startTestDb();
    app = buildTestApp();
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearAllCollections();
    clearRedirectCache();
    const tenantId = await provisionTenant(app);
    token = await merchantToken(app);
    models = createScopedModels(mongoose.connection, tenantId);
    const cat = await api("post", "/categories").send({ name: "عطور" }).expect(201);
    categoryId = cat.body.responseObject.data._id;
  });

  it("gives an Arabic-only product a readable slug, unique per name", async () => {
    const first = await createProduct({ name: "عطر الورد", status: "active" });
    assert.equal(first.slug, "atr-alord");

    const second = await createProduct({ name: "عطر الورد", status: "active" });
    assert.equal(second.slug, "atr-alord-2");

    // A merchant-typed slug is normalised, not rejected.
    const typed = await createProduct({ name: "Musk", slug: "  Musk Oil!! " });
    assert.equal(typed.slug, "musk-oil");

    // Nothing usable in the name → still a slug.
    const emoji = await createProduct({ name: "🌹🌹" });
    assert.match(emoji.slug, /^product-[0-9a-f]{6}$/);
  });

  it("prefers the English name when the merchant filled one in", async () => {
    const p = await createProduct({ name: "زيت العود", translations: { en: { name: "Oud Oil" } } });
    assert.equal(p.slug, "oud-oil");
  });

  it("keeps the slug when a product is renamed", async () => {
    const p = await createProduct({ name: "عطر الورد", status: "active" });

    // Dashboard edit: new name, unchanged slug sent back.
    await api("put", `/products/${p._id}`).send({ name: "عطر الياسمين", slug: p.slug }).expect(200);
    // API edit: new name, no slug at all.
    await api("put", `/products/${p._id}`).send({ name: "Jasmine" }).expect(200);

    const after = await models.Product.findById(p._id).lean();
    assert.equal(after.name, "Jasmine");
    assert.equal(after.slug, "atr-alord");
    assert.equal(await models.Redirect.countDocuments({}), 0, "a rename creates no redirect");
  });

  it("redirects the old URL when a published product's slug is changed explicitly", async () => {
    const p = await createProduct({ name: "عطر الورد", status: "active" });

    await api("put", `/products/${p._id}`).send({ slug: "Rose Perfume" }).expect(200);
    const after = await models.Product.findById(p._id).lean();
    assert.equal(after.slug, "rose-perfume");

    const redirect = await models.Redirect.findOne({ fromPath: "/products/atr-alord" }).lean();
    assert.ok(redirect, "redirect from the old product URL");
    assert.equal(redirect.toPath, "/products/rose-perfume");
    assert.equal(redirect.statusCode, 301);

    // The storefront serves it.
    clearRedirectCache();
    const res = await request(app).get("/products/atr-alord").set("Host", HOST);
    assert.equal(res.status, 301);
    assert.equal(res.headers.location, "/products/rose-perfume");

    // Changing it again repoints the first redirect — no chain.
    await api("put", `/products/${p._id}`).send({ slug: "rose-oil" }).expect(200);
    const rows = await models.Redirect.find({}).sort({ fromPath: 1 }).lean();
    assert.deepEqual(
      rows.map((r) => [r.fromPath, r.toPath]),
      [
        ["/products/atr-alord", "/products/rose-oil"],
        ["/products/rose-perfume", "/products/rose-oil"],
      ]
    );

    // Changing back drops the redirect away from the restored URL.
    await api("put", `/products/${p._id}`).send({ slug: "atr-alord" }).expect(200);
    assert.equal(await models.Redirect.countDocuments({ fromPath: "/products/atr-alord" }), 0);
  });

  it("does not redirect a draft product's slug change and 409s on a taken slug", async () => {
    const draft = await createProduct({ name: "Draft Perfume", status: "draft" });
    await createProduct({ name: "Taken", status: "active" });

    await api("put", `/products/${draft._id}`).send({ slug: "new-draft" }).expect(200);
    assert.equal(await models.Redirect.countDocuments({}), 0);

    await api("put", `/products/${draft._id}`).send({ slug: "taken" }).expect(409);
  });

  it("applies the same rules to categories", async () => {
    const dup = await api("post", "/categories").send({ name: "عطور" }).expect(201);
    assert.equal(dup.body.responseObject.data.slug, "ator-2");
    const cat = await models.Category.findById(categoryId).lean();
    assert.equal(cat.slug, "ator");

    // Rename keeps the slug.
    await api("put", `/categories/${categoryId}`).send({ name: "Perfumes", slug: "ator" }).expect(201);
    const renamed = await models.Category.findById(categoryId).lean();
    assert.equal(renamed.name, "Perfumes");
    assert.equal(renamed.slug, "ator");
    // The other category was not touched (update used to hit the first one).
    const other = await models.Category.findById(dup.body.responseObject.data._id).lean();
    assert.equal(other.name, "عطور");

    // Explicit change on an active category → redirect.
    await api("put", `/categories/${categoryId}`).send({ slug: "Perfumes" }).expect(201);
    const redirect = await models.Redirect.findOne({ fromPath: "/categories/ator" }).lean();
    assert.equal(redirect?.toPath, "/categories/perfumes");
    await api("put", `/categories/${categoryId}`).send({ slug: "ator-2" }).expect(409);
  });
});
