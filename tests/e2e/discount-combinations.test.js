/**
 * E2E: discount combinations.
 *
 * Pins:
 *   1. A single discount code on `discountCodes:[code]` matches the legacy
 *      single-code shape — no behavioural difference for old clients.
 *   2. Two stackable codes (one order%, one shipping%) compose correctly:
 *      both reductions land on the order, totals add up, and each
 *      discount's usedCount increments.
 *   3. Two non-stackable codes return 400 on order placement — no order,
 *      no usedCount changes.
 *   4. A free-shipping discount (kind=shipping, percentage=100) zeroes the
 *      shipping cost on the order, regardless of weight band.
 *   5. Stackability is mutual: even if A allows B, the order is rejected
 *      unless B also allows A.
 *
 * Why this lives next to the other settings tests rather than under
 * tests/e2e/cart-checkout: the checkout pricing service is what we're
 * actually exercising, and the cart-checkout file is already large with
 * stock/preorder pins.
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

async function seedProduct(tenantId) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const category = await models.Category.create({
    name: "Goods",
    slug: "goods",
    description: "Stuff",
  });
  const product = await models.Product.create({
    name: "Hoodie",
    slug: "hoodie",
    sku: "HD-001",
    description: "Cosy.",
    price: 100,
    category: category._id,
    stock: 50,
    status: "active",
    images: [],
    weight: 1,
  });
  return { models, product };
}

const SHIPPING_ADDRESS = {
  firstName: "Jane",
  lastName: "Doe",
  addressLine1: "1 Market St",
  city: "Portland",
  state: "OR",
  postalCode: "97201",
  country: "US",
  phone: "+15035551234",
};

async function configureFlatShipping(app, adminToken, rate = 10) {
  await request(app)
    .put("/api/store-settings")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ shipping: { type: "flat", rate } })
    .expect(200);
}

async function createDiscount(app, adminToken, body) {
  const res = await request(app)
    .post("/api/discounts")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${adminToken}`)
    .send(body);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
}

async function placeOrder(app, customerToken, productId, payload = {}) {
  await request(app)
    .post("/api/cart/add")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ productId: productId.toString(), quantity: 1 })
    .expect(200);
  return request(app)
    .post("/api/orders")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ shippingAddress: SHIPPING_ADDRESS, paymentMethod: "cod", ...payload });
}

describe("E2E discount combinations", () => {
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

  it("legacy single-code shape still works via discountCodes:[code]", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureFlatShipping(app, adminToken, 10);
    await createDiscount(app, adminToken, {
      code: "SAVE10",
      type: "percentage",
      value: 10,
      kind: "order",
    });
    const { product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);

    const res = await placeOrder(app, customerToken, product._id, { discountCodes: ["SAVE10"] });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const order = res.body.responseObject;
    assert.equal(order.subtotal, 100);
    assert.equal(order.discount, 10, "10% off $100 = $10");
    assert.equal(order.shippingCost, 10);
    assert.equal(order.totalAmount, 100);
    assert.deepEqual(order.discountCodes, ["SAVE10"]);
    assert.equal(order.discountBreakdown.length, 1);
    assert.equal(order.discountBreakdown[0].kind, "order");
  });

  it("stacks an order% discount with a shipping% discount when both opt in", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureFlatShipping(app, adminToken, 10);
    await createDiscount(app, adminToken, {
      code: "ORD20",
      type: "percentage",
      value: 20,
      kind: "order",
      combinesWith: { shipping: true },
    });
    await createDiscount(app, adminToken, {
      code: "SHIP100",
      type: "percentage",
      value: 100,
      kind: "shipping",
      combinesWith: { order: true },
    });
    const { models, product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);

    const res = await placeOrder(app, customerToken, product._id, {
      discountCodes: ["ORD20", "SHIP100"],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const order = res.body.responseObject;
    // 20% off $100 = $20 order discount, free shipping = $10 off shipping
    assert.equal(order.subtotal, 100);
    assert.equal(order.shippingDiscount, 10);
    assert.equal(order.shippingCost, 0);
    assert.equal(order.discount, 30, "combined discount = order $20 + shipping $10");
    assert.equal(order.totalAmount, 80, "100 - 20 + 0 shipping = 80");
    assert.equal(order.discountCodes.length, 2);
    assert.deepEqual(
      order.discountBreakdown.map((b) => b.kind).sort(),
      ["order", "shipping"]
    );

    // Both discounts must have had their usedCount incremented.
    const ord = await models.Discount.findOne({ code: "ORD20" });
    const shp = await models.Discount.findOne({ code: "SHIP100" });
    assert.equal(ord.usedCount, 1);
    assert.equal(shp.usedCount, 1);
  });

  it("rejects two non-stackable codes and does not create the order", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureFlatShipping(app, adminToken, 10);
    await createDiscount(app, adminToken, {
      code: "EXCL15",
      type: "percentage",
      value: 15,
      kind: "order",
      // No combinesWith — refuses everything by default.
    });
    await createDiscount(app, adminToken, {
      code: "SHIP50",
      type: "percentage",
      value: 50,
      kind: "shipping",
    });
    const { models, product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);

    const res = await placeOrder(app, customerToken, product._id, {
      discountCodes: ["EXCL15", "SHIP50"],
    });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    // Order count must be unchanged and neither code's usedCount bumped.
    const orderCount = await models.Order.countDocuments({});
    assert.equal(orderCount, 0);
    const a = await models.Discount.findOne({ code: "EXCL15" });
    const b = await models.Discount.findOne({ code: "SHIP50" });
    assert.equal(a.usedCount, 0);
    assert.equal(b.usedCount, 0);
  });

  it("mutual-consent is required: A→B alone is not enough", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureFlatShipping(app, adminToken, 10);
    // ORDX opts in to combining with shipping…
    await createDiscount(app, adminToken, {
      code: "ORDX",
      type: "percentage",
      value: 10,
      kind: "order",
      combinesWith: { shipping: true },
    });
    // …but SHIPY does NOT opt in to combining with order discounts.
    await createDiscount(app, adminToken, {
      code: "SHIPY",
      type: "percentage",
      value: 50,
      kind: "shipping",
    });
    const { product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);

    const res = await placeOrder(app, customerToken, product._id, {
      discountCodes: ["ORDX", "SHIPY"],
    });
    assert.equal(res.status, 400, JSON.stringify(res.body));
  });

  it("free-shipping discount alone zeroes the shipping cost", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureFlatShipping(app, adminToken, 25);
    await createDiscount(app, adminToken, {
      code: "FREESHIP",
      type: "percentage",
      value: 100,
      kind: "shipping",
    });
    const { product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);

    const res = await placeOrder(app, customerToken, product._id, {
      discountCodes: ["FREESHIP"],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const order = res.body.responseObject;
    assert.equal(order.shippingCost, 0);
    assert.equal(order.shippingDiscount, 25);
    assert.equal(order.totalAmount, 100, "subtotal $100, shipping $0 → total $100");
  });
});
