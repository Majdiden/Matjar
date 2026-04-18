/**
 * E2E: shipping zones CRUD + checkout pricing.
 *
 * Pins three things together because they only have value in concert:
 *   1. Admin can create a zone via the granular CRUD endpoint
 *   2. The bulk PUT validator no longer rejects type="zone"
 *      (regression: it used to whitelist only flat/weight/free)
 *   3. createOrderService → calculateShipping picks the right rate
 *      based on the cart's total weight band
 *
 * Also covers role gating: a customer JWT must not be able to create
 * shipping zones.
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

async function registerCustomer(app) {
  const res = await request(app)
    .post("/storefront/auth/register")
    .set("Host", HOST)
    .send({ name: "Jane Doe", email: "jane@buyer.test", password: "Sup3rSecret!" })
    .expect(201);
  return res.body.data.accessToken;
}

async function seedHeavyProduct(tenantId) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const category = await models.Category.create({
    name: "Beans",
    slug: "beans",
    description: "Whole bean coffee",
  });
  // 3kg per unit — order 2 units → 6kg total, lands in the heavy band.
  const product = await models.Product.create({
    name: "Bulk Sack",
    slug: "bulk-sack",
    sku: "BS-001",
    description: "Five-pound sack.",
    price: 25,
    weight: 3,
    category: category._id,
    stock: 10,
    status: "active",
    images: [],
  });
  return { models, product };
}

const ZONE_PAYLOAD = {
  name: "North America",
  countries: ["us", "ca"], // lowercase on purpose — controller normalises
  rates: [
    { name: "Light parcel", price: 5, minWeight: 0, maxWeight: 2, estimatedDays: "3-5" },
    { name: "Standard", price: 12, minWeight: 2, maxWeight: 5, estimatedDays: "3-5" },
    { name: "Freight", price: 30, minWeight: 5, maxWeight: null, estimatedDays: "5-7" },
  ],
};

const SHIPPING_ADDRESS = {
  firstName: "Jane",
  lastName: "Doe",
  addressLine1: "123 Brewery Lane",
  city: "Portland",
  state: "OR",
  postalCode: "97201",
  country: "US",
  phone: "+15035551234",
};

describe("E2E shipping zones", () => {
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

  it("admin can CRUD zones via the granular endpoints", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    // Create
    const createRes = await request(app)
      .post("/api/store-settings/shipping/zones")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(ZONE_PAYLOAD);
    assert.equal(createRes.status, 201, JSON.stringify(createRes.body));
    const zoneId = createRes.body.data._id;
    assert.ok(zoneId);
    assert.deepEqual(createRes.body.data.countries, ["US", "CA"]);

    // List
    const listRes = await request(app)
      .get("/api/store-settings/shipping/zones")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(listRes.body.data.length, 1);

    // Update
    const updateRes = await request(app)
      .put(`/api/store-settings/shipping/zones/${zoneId}`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...ZONE_PAYLOAD, name: "NA Updated" })
      .expect(200);
    assert.equal(updateRes.body.data.name, "NA Updated");

    // Delete
    await request(app)
      .delete(`/api/store-settings/shipping/zones/${zoneId}`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const finalList = await request(app)
      .get("/api/store-settings/shipping/zones")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(finalList.body.data.length, 0);
  });

  it("rejects malformed zone payloads", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    // No countries
    const r1 = await request(app)
      .post("/api/store-settings/shipping/zones")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Bad", countries: [], rates: [{ name: "x", price: 1 }] });
    assert.equal(r1.status, 400);

    // Negative rate price
    const r2 = await request(app)
      .post("/api/store-settings/shipping/zones")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Bad", countries: ["US"], rates: [{ name: "x", price: -5 }] });
    assert.equal(r2.status, 400);

    // maxWeight < minWeight
    const r3 = await request(app)
      .post("/api/store-settings/shipping/zones")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Bad", countries: ["US"], rates: [{ name: "x", price: 1, minWeight: 5, maxWeight: 2 }] });
    assert.equal(r3.status, 400);
  });

  it("customer cannot create shipping zones", async () => {
    await provisionTenant(app);
    const customerToken = await registerCustomer(app);
    const res = await request(app)
      .post("/api/store-settings/shipping/zones")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`)
      .send(ZONE_PAYLOAD);
    assert.equal(res.status, 403);
  });

  it("bulk PUT now accepts type=zone (regression)", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const res = await request(app)
      .put("/api/store-settings")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ shipping: { type: "zone", zones: [ZONE_PAYLOAD] } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.shipping.type, "zone");
    assert.equal(res.body.data.shipping.zones.length, 1);
  });

  it("checkout picks the rate matching the cart's weight band", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    // Configure zone-based shipping for the tenant.
    await request(app)
      .put("/api/store-settings")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ shipping: { type: "zone", zones: [ZONE_PAYLOAD] } })
      .expect(200);

    const { models, product } = await seedHeavyProduct(tenantId);
    const customerToken = await registerCustomer(app);

    // 2 × 3kg = 6kg → falls in the freight band (>5kg, $30).
    await request(app)
      .post("/api/cart/add")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ productId: product._id.toString(), quantity: 2 })
      .expect(200);

    const orderRes = await request(app)
      .post("/api/orders")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingAddress: SHIPPING_ADDRESS, paymentMethod: "cod" });

    assert.equal(orderRes.status, 201, JSON.stringify(orderRes.body));
    const order = orderRes.body.responseObject;
    assert.equal(order.subtotal, 50);
    // Shipping cost is the freight rate ($30) — the calculator picked the
    // band whose [minWeight, maxWeight] contains 6kg.
    assert.equal(order.shippingCost, 30, JSON.stringify(order));

    // Sanity: order persisted under tenant scope.
    const count = await models.Order.countDocuments({});
    assert.equal(count, 1);
  });
});
