/**
 * One box per language (dashboard/src/lib/languageOrder.ts): the dashboard
 * saves every product / category / menu text field as `translations.ar.X` and
 * `translations.en.X` (an emptied box sends "") plus a base value in the
 * store's language. The API must keep both translations and let "" clear one.
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
  const category = await models.Category.create({ name: "Beans", slug: "beans" });
  const login = await request(app).post("/api/auth/login").set("Host", HOST).send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: HOST }).expect(200);
  return { token: login.body.responseObject.accessToken, categoryId: String(category._id) };
}

describe("E2E bilingual text fields", () => {
  let app;
  let auth;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => {
    await clearAllCollections();
    auth = await provision(app);
  });
  const send = (method, path) => request(app)[method](path).set("Host", HOST).set("Authorization", `Bearer ${auth.token}`);

  it("keeps a product's Arabic and English text, sections included, and clears an emptied one", async () => {
    const created = await send("post", "/api/products").send({
      name: "عطر العود",
      description: "عطر شرقي فاخر بزيت العود الطبيعي.",
      shortDescription: "عطر شرقي",
      price: 25,
      category: auth.categoryId,
      stock: 5,
      status: "active",
      translations: {
        ar: { name: "عطر العود", description: "عطر شرقي فاخر بزيت العود الطبيعي.", shortDescription: "عطر شرقي" },
        en: { name: "Oud perfume", description: "A rich oriental scent with natural oud oil.", shortDescription: "" },
      },
      contentSections: [{
        key: "how-to-use",
        title: "طريقة الاستخدام",
        body: "رشّه على المعصم.",
        translations: { ar: { title: "طريقة الاستخدام", body: "رشّه على المعصم." }, en: { title: "How to use", body: "Spray on the wrist." } },
      }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body).slice(0, 300));
    const product = created.body.responseObject.data;
    assert.equal(product.slug, "oud-perfume", "the English name drives the link");
    assert.equal(product.translations.en.name, "Oud perfume");
    assert.equal(product.translations.ar.name, "عطر العود");
    assert.equal(product.contentSections[0].translations.en.title, "How to use");
    assert.equal(product.contentSections[0].translations.ar.body, "رشّه على المعصم.");

    // The merchant empties the English name: "" clears it, Arabic stays.
    await send("put", `/api/products/${product._id}`).send({
      name: "عطر العود",
      translations: {
        ar: { name: "عطر العود", description: "عطر شرقي فاخر بزيت العود الطبيعي.", shortDescription: "عطر شرقي" },
        en: { name: "", description: "A rich oriental scent with natural oud oil.", shortDescription: "" },
      },
    }).expect(200);
    const got = await send("get", `/api/products/${product._id}`).expect(200);
    const p = got.body.responseObject.data;
    assert.equal(p.translations.en.name, "");
    assert.equal(p.translations.en.description, "A rich oriental scent with natural oud oil.");
    assert.equal(p.translations.ar.name, "عطر العود");

    // The storefront gets both translations to localize from.
    const sf = await request(app).get(`/storefront/products/${product.slug}`).set("Host", HOST).expect(200);
    const sp = sf.body.data.product || sf.body.data;
    assert.equal(sp.translations.ar.name, "عطر العود");
    assert.equal(sp.contentSections[0].translations.en.body, "Spray on the wrist.");
  });

  it("keeps a category's Arabic and English names", async () => {
    const created = await send("post", "/api/categories").send({
      name: "عطور",
      translations: { ar: { name: "عطور" }, en: { name: "Perfumes" } },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body).slice(0, 300));
    const cat = created.body.responseObject.data;
    assert.equal(cat.translations.en.name, "Perfumes");
    assert.equal(cat.translations.ar.name, "عطور");

    const updated = await send("put", `/api/categories/${cat._id}`).send({ name: "Perfumes", translations: { ar: { name: "" }, en: { name: "Perfumes" } } });
    assert.ok(updated.status < 300, JSON.stringify(updated.body).slice(0, 300));
    // Read back from the list, which the dashboard uses.
    const got = await send("get", "/api/categories").expect(200);
    const c = got.body.responseObject.data.find((x) => String(x._id) === String(cat._id));
    assert.equal(c.name, "Perfumes");
    assert.equal(c.translations.ar.name, "");
    assert.equal(c.translations.en.name, "Perfumes");
  });

  it("keeps a menu item's Arabic and English labels at every level", async () => {
    const created = await send("post", "/api/menus").send({
      title: "Main menu",
      handle: "main",
      items: [{
        label: "الرئيسية",
        translations: { ar: { label: "الرئيسية" }, en: { label: "Home" } },
        url: "/",
        type: "link",
        children: [{ label: "Shop", translations: { ar: { label: "" }, en: { label: "Shop" } }, url: "/products", type: "link" }],
      }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body).slice(0, 300));
    const got = await send("get", `/api/menus/${created.body.data._id}`).expect(200);
    const [home] = got.body.data.items;
    assert.equal(home.translations.en.label, "Home");
    assert.equal(home.translations.ar.label, "الرئيسية");
    assert.equal(home.children[0].translations.en.label, "Shop");
    assert.equal(home.children[0].translations.ar.label, "");
  });
});
