/**
 * E2E smoke: cart → checkout → order placement.
 *
 * Drives the full purchase path that a real customer takes:
 *   1. Register a customer via /storefront/auth/register (returns JWT)
 *   2. POST /api/cart/add to put the product in their cart
 *   3. POST /api/orders to place the order
 *   4. Assert: order persisted, stock decremented, cart cleared
 *
 * Why bearer auth instead of guest cart? The guest cart path needs an
 * express-session with cookies, which the test app intentionally doesn't
 * wire up. Authenticated cart hits the same controllers and the same
 * createOrderService transaction — the price/stock/quote logic doesn't
 * branch on auth — so the contract is identical to guest checkout.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";

const HOST = "acme.localhost";

async function seedTenant() {
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

  const product = await models.Product.create({
    name: "House Blend",
    slug: "house-blend",
    sku: "HB-001",
    description: "Our signature daily drinker.",
    price: 18.5,
    category: category._id,
    stock: 10,
    status: "active",
    images: [],
  });

  return { tenant, models, product };
}

async function registerCustomer(app) {
  const res = await request(app)
    .post("/storefront/auth/register")
    .set("Host", HOST)
    .send({
      name: "Jane Doe",
      email: "jane@buyer.test",
      password: "Sup3rSecret!",
    })
    .expect(201);
  // Storefront auth returns the token under `data.accessToken` (different
  // shape from /api/auth/login — keep this in sync if either changes).
  return res.body.data.accessToken;
}

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

describe("E2E cart → checkout → order", () => {
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

  it("places an order, decrements stock, and clears the cart", async () => {
    const { tenant, product } = await seedTenant();
    const token = await registerCustomer(app);

    // Add 2 units to cart.
    const addRes = await request(app)
      .post("/api/cart/add")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 2 })
      .expect(200);
    assert.equal(addRes.body.success, true);

    // Place the order.
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({
        shippingAddress: SHIPPING_ADDRESS,
        paymentMethod: "cod",
      });

    assert.equal(orderRes.status, 201, JSON.stringify(orderRes.body));
    assert.equal(orderRes.body.success, true);
    const order = orderRes.body.responseObject;
    assert.ok(order, "responseObject contains the created order");
    assert.equal(order.products.length, 1);
    assert.equal(order.products[0].quantity, 2);
    assert.equal(order.products[0].price, 18.5);
    assert.equal(order.subtotal, 37);
    assert.equal(order.status, "Pending");
    assert.match(order.orderNumber || "", /^#\d+$/);

    // Stock decremented from 10 → 8.
    const models = createScopedModels(mongoose.connection, tenant._id);
    const fresh = await models.Product.findById(product._id).lean();
    assert.equal(fresh.stock, 8, "stock decremented by ordered quantity");

    // Cart deleted (createOrderService removes it on commit).
    const cartCount = await models.Cart.countDocuments({});
    assert.equal(cartCount, 0, "cart cleared after successful order");

    // Order persisted under the right tenant scope.
    const orderCount = await models.Order.countDocuments({});
    assert.equal(orderCount, 1);
  });

  it("rejects an order with empty cart", async () => {
    await seedTenant();
    const token = await registerCustomer(app);

    const res = await request(app)
      .post("/api/orders")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({
        shippingAddress: SHIPPING_ADDRESS,
        paymentMethod: "cod",
      });

    assert.notEqual(res.status, 201);
    assert.equal(res.body.success, false);
    assert.match(JSON.stringify(res.body).toLowerCase(), /cart/);
  });

  it("rejects adding more units than available stock (no preorder)", async () => {
    const { product } = await seedTenant();
    const token = await registerCustomer(app);

    const res = await request(app)
      .post("/api/cart/add")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 99 });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message.toLowerCase(), /stock/);
  });

  it("rejects an order without a valid shipping address (validator)", async () => {
    const { product } = await seedTenant();
    const token = await registerCustomer(app);

    await request(app)
      .post("/api/cart/add")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1 })
      .expect(200);

    const res = await request(app)
      .post("/api/orders")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({
        // Missing addressLine1/city/postalCode/country — Zod must reject.
        shippingAddress: { firstName: "Jane" },
        paymentMethod: "cod",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });
});
