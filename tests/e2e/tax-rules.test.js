/**
 * E2E: tax rules — CRUD, per-class overrides, included-vs-additive,
 * and the checkout integration.
 *
 * Pins:
 *   1. Admin CRUD on /api/store-settings/tax/rates round-trips.
 *   2. Customers cannot mutate tax rates (role gating).
 *   3. Additive pricing — tax sits ON TOP of subtotal.
 *      Total = subtotal + shipping + tax.
 *   4. Inclusive pricing — tax is BACKED OUT of the line price.
 *      Total = subtotal + shipping (no double charge); breakdown
 *      still reports the implied tax for the receipt.
 *   5. Product class override — a "food" product taxed at 5% beats
 *      the generic 20% rate at the same jurisdiction without
 *      enumerating every other class.
 *   6. taxExempt products contribute zero tax.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";

const HOST = "acme.localhost";

async function provisionTenant(app) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Acme Coffee",
      email: "owner@acme.test",
      password: "Sup3rSecret!",
      subdomain: "acme",
    })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function loginAdmin(app) {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Host", HOST)
    .send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: "acme.localhost" })
    .expect(200);
  return res.body.responseObject.accessToken;
}

async function registerCustomer(app, email = "jane@buyer.test") {
  const res = await request(app)
    .post("/storefront/auth/register")
    .set("Host", HOST)
    .send({ name: "Jane Doe", email, password: "Sup3rSecret!" })
    .expect(201);
  return res.body.data.accessToken;
}

async function seedProducts(tenantId, opts = {}) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const category = await models.Category.create({
    name: "Goods",
    slug: "goods",
    description: "Stuff",
  });
  // Standard-class product, $100.
  const standard = await models.Product.create({
    name: "Hoodie",
    slug: "hoodie",
    sku: "HD-001",
    description: "Cosy.",
    price: 100,
    category: category._id,
    stock: 50,
    status: "active",
    images: [],
    taxClass: "standard",
  });
  // Food-class product, $20 — taxed at the food rate when configured.
  const food = await models.Product.create({
    name: "Coffee Beans",
    slug: "coffee-beans",
    sku: "CB-001",
    description: "Whole bean.",
    price: 20,
    category: category._id,
    stock: 50,
    status: "active",
    images: [],
    taxClass: "food",
  });
  // Exempt product (e.g. gift card), $50.
  const exempt = await models.Product.create({
    name: "Gift Card",
    slug: "gift-card",
    sku: "GC-001",
    description: "$50.",
    price: 50,
    category: category._id,
    stock: 999,
    status: "active",
    images: [],
    taxClass: "standard",
    taxExempt: true,
  });
  return { models, standard, food, exempt };
}

const SHIPPING_ADDRESS = {
  firstName: "Jane",
  lastName: "Doe",
  addressLine1: "1 Oxford St",
  city: "London",
  state: "LDN",
  postalCode: "W1D",
  country: "GB",
  phone: "+442071234567",
};

async function configureTax(app, adminToken, body) {
  return request(app)
    .put("/api/store-settings")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ tax: body })
    .expect(200);
}

async function placeOrder(app, customerToken, productId, quantity = 1) {
  await request(app)
    .post("/api/cart/add")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ productId: productId.toString(), quantity })
    .expect(200);

  const res = await request(app)
    .post("/api/orders")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ shippingAddress: SHIPPING_ADDRESS, paymentMethod: "cod" });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.responseObject;
}

describe("E2E tax rules", () => {
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

  it("admin can CRUD tax rates", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    const createRes = await request(app)
      .post("/api/store-settings/tax/rates")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ country: "gb", state: "*", rate: 0.2, name: "VAT" });
    assert.equal(createRes.status, 201, JSON.stringify(createRes.body));
    const rateId = createRes.body.data._id;
    assert.equal(createRes.body.data.country, "GB");

    const listRes = await request(app)
      .get("/api/store-settings/tax/rates")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(listRes.body.data.rates.length, 1);

    await request(app)
      .put(`/api/store-settings/tax/rates/${rateId}`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ country: "gb", state: "*", rate: 0.21, name: "VAT (revised)" })
      .expect(200);

    await request(app)
      .delete(`/api/store-settings/tax/rates/${rateId}`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const finalList = await request(app)
      .get("/api/store-settings/tax/rates")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(finalList.body.data.rates.length, 0);
  });

  it("customers cannot mutate tax rates", async () => {
    await provisionTenant(app);
    const customerToken = await registerCustomer(app);
    const res = await request(app)
      .post("/api/store-settings/tax/rates")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ country: "gb", state: "*", rate: 0.2, name: "VAT" });
    assert.equal(res.status, 403);
  });

  it("rejects rates outside [0,1]", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const r = await request(app)
      .post("/api/store-settings/tax/rates")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ country: "gb", state: "*", rate: 1.5 });
    assert.equal(r.status, 400);
  });

  it("additive pricing: total = subtotal + shipping + tax", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureTax(app, adminToken, {
      enabled: true,
      includeInPrice: false,
      rates: [{ country: "GB", state: "*", rate: 0.2, name: "VAT" }],
    });
    const { standard } = await seedProducts(tenantId);
    const customerToken = await registerCustomer(app);

    const order = await placeOrder(app, customerToken, standard._id, 1);
    // $100 subtotal × 20% = $20 tax. No shipping configured → 0.
    assert.equal(order.subtotal, 100);
    assert.equal(order.tax, 20);
    assert.equal(order.totalAmount, 120);
    assert.equal(order.taxIncluded, false);
    assert.equal(order.taxBreakdown.length, 1);
    assert.equal(order.taxBreakdown[0].name, "VAT");
  });

  it("inclusive pricing: tax is backed out, total stays = subtotal", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureTax(app, adminToken, {
      enabled: true,
      includeInPrice: true,
      rates: [{ country: "GB", state: "*", rate: 0.2, name: "VAT" }],
    });
    const { standard } = await seedProducts(tenantId);
    const customerToken = await registerCustomer(app);

    const order = await placeOrder(app, customerToken, standard._id, 1);
    // $100 already contains 20% VAT.
    //   net  = 100 / 1.2 = 83.33
    //   tax  = 100 - 83.33 = 16.67
    // Total must NOT add tax on top — customer pays $100 + shipping (0).
    assert.equal(order.subtotal, 100);
    assert.equal(order.totalAmount, 100, "inclusive total stays at sticker price");
    assert.equal(order.taxIncluded, true);
    assert.ok(Math.abs(order.tax - 16.67) < 0.02, `tax was ${order.tax}, expected ~16.67`);
  });

  it("product class override beats the generic rate", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureTax(app, adminToken, {
      enabled: true,
      includeInPrice: false,
      rates: [
        { country: "GB", state: "*", rate: 0.2, name: "VAT standard" },
        { country: "GB", state: "*", rate: 0.05, name: "VAT food", productClass: "food" },
      ],
    });
    const { food } = await seedProducts(tenantId);
    const customerToken = await registerCustomer(app);

    const order = await placeOrder(app, customerToken, food._id, 1);
    // $20 × 5% = $1.00, NOT $4.00.
    assert.equal(order.subtotal, 20);
    assert.equal(order.tax, 1);
    assert.equal(order.totalAmount, 21);
    assert.equal(order.taxBreakdown[0].productClass, "food");
  });

  it("tax-exempt products contribute zero tax", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureTax(app, adminToken, {
      enabled: true,
      includeInPrice: false,
      rates: [{ country: "GB", state: "*", rate: 0.2, name: "VAT" }],
    });
    const { exempt } = await seedProducts(tenantId);
    const customerToken = await registerCustomer(app);

    const order = await placeOrder(app, customerToken, exempt._id, 1);
    assert.equal(order.subtotal, 50);
    assert.equal(order.tax, 0);
    assert.equal(order.totalAmount, 50);
  });
});
