/**
 * Merchant-authored product page blocks ("How to use", "Ingredients"…):
 * validated on write, stored with Arabic translations, and served to the
 * storefront product endpoint.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";

const HOST = "acme.localhost";

async function provision(app) {
  const res = await request(app).post("/api/auth/register").send({ name: "Acme Coffee", email: "owner@acme.test", password: "Sup3rSecret!", subdomain: "acme" }).expect(201);
  const tenantId = res.body.responseObject.tenantId;
  const models = createScopedModels(mongoose.connection, tenantId);
  const category = await models.Category.create({ name: "Beans", slug: "beans", description: "Whole bean coffee" });
  const login = await request(app).post("/api/auth/login").set("Host", HOST).send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: HOST }).expect(200);
  return { token: login.body.responseObject.accessToken, categoryId: String(category._id) };
}

describe("E2E product content sections", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  it("stores validated sections + specs and serves them localized-ready on the storefront", async () => {
    const { token, categoryId } = await provision(app);
    const base = { name: "Serum", description: "A gentle daily serum for all skin types.", price: 25, category: categoryId, stock: 5, status: "active" };

    // Invalid: bad key, duplicate keys, too many.
    const bad = await request(app).post("/api/products").set("Host", HOST).set("Authorization", `Bearer ${token}`)
      .send({ ...base, contentSections: [{ key: "How To Use!", title: "x", body: "y" }] });
    assert.equal(bad.status, 400);
    const dup = await request(app).post("/api/products").set("Host", HOST).set("Authorization", `Bearer ${token}`)
      .send({ ...base, contentSections: [{ key: "a", title: "x", body: "y" }, { key: "a", title: "x2", body: "y2" }] });
    assert.equal(dup.status, 400);
    const many = await request(app).post("/api/products").set("Host", HOST).set("Authorization", `Bearer ${token}`)
      .send({ ...base, contentSections: Array.from({ length: 11 }, (_, i) => ({ key: `k${i}`, title: `T${i}`, body: "b" })) });
    assert.equal(many.status, 400);

    const created = await request(app).post("/api/products").set("Host", HOST).set("Authorization", `Bearer ${token}`)
      .send({
        ...base,
        specifications: [{ key: "Volume", value: "30 ml" }],
        contentSections: [
          { key: "how-to-use", title: "How to use", body: "Apply morning and night.\nAvoid the eye area.", translations: { ar: { title: "طريقة الاستخدام", body: "يُستخدم صباحاً ومساءً." } } },
          { key: "ingredients", title: "Ingredients", body: "Water, glycerin, niacinamide." },
        ],
      });
    assert.equal(created.status, 201, JSON.stringify(created.body).slice(0, 300));
    const product = created.body.responseObject?.data || created.body.data || created.body.responseObject;
    assert.equal(product.contentSections.length, 2);
    assert.equal(product.contentSections[0].translations.ar.title, "طريقة الاستخدام");

    const sf = await request(app).get(`/storefront/products/${product.slug}`).set("Host", HOST).expect(200);
    const p = sf.body.data.product || sf.body.data;
    assert.deepEqual(p.specifications, [{ key: "Volume", value: "30 ml" }]);
    assert.deepEqual(p.contentSections.map((s) => s.key), ["how-to-use", "ingredients"]);
    assert.match(p.contentSections[0].body, /\nAvoid the eye area\./);

    // Update replaces the list; empty array clears it.
    await request(app).put(`/api/products/${product._id}`).set("Host", HOST).set("Authorization", `Bearer ${token}`).send({ contentSections: [] }).expect(200);
    const sf2 = await request(app).get(`/storefront/products/${product.slug}`).set("Host", HOST).expect(200);
    const p2 = sf2.body.data.product || sf2.body.data;
    assert.deepEqual(p2.contentSections, []);
  });
});
