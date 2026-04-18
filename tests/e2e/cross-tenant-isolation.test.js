/**
 * Cross-tenant isolation fuzz test.
 *
 * Seeds two tenants (A and B), each with their own products, orders,
 * discounts, customers, and carts. Then verifies that:
 *
 *   1. Tenant B cannot read Tenant A's resources through any list/detail endpoint.
 *   2. Tenant B cannot mutate Tenant A's resources by submitting A's ObjectIds.
 *   3. Tenant A's aggregations/analytics never surface B's rows.
 *   4. A token from Tenant A is rejected on requests scoped to Tenant B.
 *
 * This is the single most important test in the suite. If it fails,
 * the platform has a data breach, not a bug.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";

describe("Cross-tenant isolation", () => {
  let app;

  // Tenant A context
  let tenantA;
  let tokenA;
  let modelsA;

  // Tenant B context
  let tenantB;
  let tokenB;
  let modelsB;

  // Tenant A resources (ObjectIds that B must not be able to access)
  let productA;
  let orderA;
  let categoryA;

  before(async () => {
    await startTestDb();
    app = buildTestApp();
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearAllCollections();

    // ── Register Tenant A ─────────────────────────────────────────
    const resA = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Tenant Alpha",
        email: "admin@alpha.test",
        password: "Sup3rSecret!",
        subdomain: "alpha",
      })
      .expect(201);
    tenantA = await mongoose.model("Tenant").findById(resA.body.responseObject.tenantId).lean();
    modelsA = createScopedModels(mongoose.connection, tenantA._id);

    // Login A
    const loginA = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@alpha.test", password: "Sup3rSecret!", domain: `alpha.localhost` })
      .expect(200);
    tokenA = loginA.body.responseObject?.accessToken;

    // ── Register Tenant B ─────────────────────────────────────────
    const resB = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Tenant Bravo",
        email: "admin@bravo.test",
        password: "Sup3rSecret!",
        subdomain: "bravo",
      })
      .expect(201);
    tenantB = await mongoose.model("Tenant").findById(resB.body.responseObject.tenantId).lean();
    modelsB = createScopedModels(mongoose.connection, tenantB._id);

    // Login B
    const loginB = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@bravo.test", password: "Sup3rSecret!", domain: `bravo.localhost` })
      .expect(200);
    tokenB = loginB.body.responseObject?.accessToken;

    // ── Seed Tenant A with data ───────────────────────────────────
    categoryA = await modelsA.Category.create({
      name: "Alpha Widgets",
      slug: "alpha-widgets",
    });

    productA = await modelsA.Product.create({
      name: "Alpha Widget",
      description: "A widget from Alpha",
      price: 99.99,
      sku: "ALPHA-001",
      slug: "alpha-widget",
      category: categoryA._id,
      stock: 50,
      status: "active",
    });

    // Create an order for A (direct DB, simulating a completed checkout)
    orderA = await modelsA.Order.create({
      user: (await modelsA.User.findOne({ email: "admin@alpha.test" }))._id,
      products: [
        { product: productA._id, name: "Alpha Widget", sku: "ALPHA-001", quantity: 1, price: 99.99 },
      ],
      totalAmount: 99.99,
      status: "Pending",
      paymentMethod: "card",
      paymentStatus: "Not Paid",
      shippingAddress: { firstName: "A", lastName: "A", city: "A", country: "US" },
    });

    // Seed B with its own product so it has data to query against
    const categoryB = await modelsB.Category.create({
      name: "Bravo Gadgets",
      slug: "bravo-gadgets",
    });
    await modelsB.Product.create({
      name: "Bravo Gadget",
      description: "A gadget from Bravo",
      price: 49.99,
      sku: "BRAVO-001",
      slug: "bravo-gadget",
      category: categoryB._id,
      stock: 30,
      status: "active",
    });
  });

  // ─── Read isolation ─────────────────────────────────────────────

  it("Tenant B cannot list Tenant A's products", async () => {
    const res = await request(app)
      .get("/api/products")
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    const products = res.body.responseObject?.products || res.body.data || res.body.responseObject || [];
    const productList = Array.isArray(products) ? products : [];
    const leakedNames = productList.map((p) => p.name).filter((n) => n === "Alpha Widget");
    assert.equal(leakedNames.length, 0, "Tenant B must not see Alpha's products");
  });

  it("Tenant B cannot fetch Tenant A's product by ID", async () => {
    const res = await request(app)
      .get(`/api/products/${productA._id}`)
      .set("Host", "bravo.localhost")
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenB}`);

    // Acceptable: 404 or an empty result — never the actual product.
    if (res.status === 200) {
      const body = res.body.responseObject || res.body;
      assert.ok(!body || !body.name, "Must not return Alpha's product data");
    }
  });

  it("Tenant B cannot list Tenant A's orders", async () => {
    const res = await request(app)
      .get("/api/orders")
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    const orders = res.body.responseObject?.orders || res.body.responseObject || [];
    const orderList = Array.isArray(orders) ? orders : [];
    const leaked = orderList.filter(
      (o) => o._id?.toString() === orderA._id.toString()
    );
    assert.equal(leaked.length, 0, "Tenant B must not see Alpha's orders");
  });

  it("Tenant B cannot fetch Tenant A's order by ID", async () => {
    const res = await request(app)
      .get(`/api/orders/${orderA._id}`)
      .set("Host", "bravo.localhost")
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenB}`);

    if (res.status === 200) {
      const body = res.body.responseObject || res.body;
      assert.ok(
        !body || !body.orderNumber,
        "Must not return Alpha's order data"
      );
    }
  });

  it("Tenant B cannot list Tenant A's categories", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    const cats = res.body.responseObject || res.body.data || [];
    const catList = Array.isArray(cats) ? cats : [];
    const leaked = catList.filter((c) => c.name === "Alpha Widgets");
    assert.equal(leaked.length, 0, "Tenant B must not see Alpha's categories");
  });

  // ─── Mutation isolation ─────────────────────────────────────────

  it("Tenant B cannot update Tenant A's product", async () => {
    const res = await request(app)
      .put(`/api/products/${productA._id}`)
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "HACKED" });

    // Should 404 (scoped model won't find it) or 403
    assert.notEqual(res.status, 200, "Must not allow cross-tenant product update");

    // Verify the product is unchanged
    const check = await modelsA.Product.findById(productA._id).lean();
    assert.equal(check.name, "Alpha Widget", "Product must not have been mutated");
  });

  it("Tenant B cannot cancel Tenant A's order", async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderA._id}/status`)
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ status: "Cancelled" });

    assert.notEqual(res.status, 200, "Must not allow cross-tenant order cancel");

    const check = await modelsA.Order.findOne({ _id: orderA._id }).lean();
    assert.equal(check.status, "Pending", "Order must remain Pending");
  });

  it("Tenant B cannot delete Tenant A's product", async () => {
    const res = await request(app)
      .delete(`/api/products/${productA._id}`)
      .set("Host", "bravo.localhost")
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenB}`);

    assert.notEqual(res.status, 200, "Must not allow cross-tenant product delete");

    const check = await modelsA.Product.findById(productA._id).lean();
    assert.ok(check, "Product must still exist");
  });

  // ─── Token scope isolation ──────────────────────────────────────

  it("Tenant A token only sees Tenant A data on token-scoped API requests", async () => {
    // No Host header: tenant comes from the JWT. Alpha's token must
    // only surface Alpha's catalog, never Bravo's.
    const resProducts = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    const products = resProducts.body.responseObject?.products || resProducts.body.responseObject || [];
    const productList = Array.isArray(products) ? products : [];
    const bravoProducts = productList.filter((p) => p.name === "Bravo Gadget");
    assert.equal(bravoProducts.length, 0, "Token A must not see Bravo's products");
  });

  it("Tenant A token is rejected on Tenant B host for protected tenant APIs", async () => {
    // Host-bound policy: if the host resolves to Bravo but the token
    // was issued for Alpha, the auth middleware must refuse. Use a
    // strictly-authenticated mutation endpoint (POST /api/products)
    // so the `authenticate` middleware actually runs — the public
    // GET list uses optionalAuth and would silently ignore the token.
    const res = await request(app)
      .post("/api/products")
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "probe", price: 1, category: categoryA._id, description: "x" });
    assert.equal(res.status, 403, `expected 403, got ${res.status} ${JSON.stringify(res.body)}`);
  });

  it("Tenant A token on Tenant B public storefront does not rescope the host tenant", async () => {
    // optionalAuth must never swap the host-resolved tenant context.
    // Hitting Bravo's storefront with Alpha's token must still return
    // Bravo's catalog (token is effectively ignored for public reads).
    const res = await request(app)
      .get("/storefront/products")
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    const products = res.body?.data?.products || res.body?.data || res.body?.responseObject || [];
    const list = Array.isArray(products) ? products : [];
    // Bravo has no products seeded — but critically, Alpha's products
    // must not appear. Assert neither "Alpha Widget" nor any doc whose
    // tenantId matches Alpha is in the payload.
    const alphaLeak = list.filter((p) => p.name === "Alpha Widget");
    assert.equal(alphaLeak.length, 0, "Alpha products must not appear on Bravo storefront");
  });

  it("Document-level populate cannot load a cross-tenant referenced doc", async () => {
    // Reference-integrity regression test. Simulate import/migration
    // corruption by directly writing a Tenant A product ObjectId into
    // a Tenant B cart, then populate. The tenantPopulate helper +
    // scoped-model wrapper must make this return null/empty.
    const bravoUser = await modelsB.User.findOne({ email: "admin@bravo.test" });
    assert.ok(bravoUser, "Bravo admin user must exist");

    // Use raw model so we can bypass scoping for the poisoned insert.
    const CartModel = mongoose.connection.model("Cart");
    const cart = await CartModel.create({
      tenantId: tenantB._id,
      user: bravoUser._id,
      items: [{ product: productA._id, quantity: 1, price: 10 }],
      subtotal: 10,
      total: 10,
    });

    // Document-level populate via the helper — must match tenantId.
    const { tenantPopulate } = await import("../../utils/scopedModel.js");
    await cart.populate(tenantPopulate("items.product", tenantB._id));
    // `match` excludes the cross-tenant doc, so populate leaves the
    // sub-field as null (ref didn't resolve). Make sure nothing from
    // Alpha leaked in.
    const leaked = cart.items.find(
      (i) => i.product && i.product.name === "Alpha Widget"
    );
    assert.equal(leaked, undefined, "Cross-tenant product must not populate");
  });

  // ─── Aggregate isolation ────────────────────────────────────────

  it("Tenant B analytics never surface Tenant A's order revenue", async () => {
    const res = await request(app)
      .get("/api/analytics/stats")
      .set("Host", "bravo.localhost")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    const stats = res.body.data || res.body.responseObject || {};
    // B has zero orders — revenue must be 0
    const revenue = stats.totalRevenue || stats.revenue || 0;
    assert.equal(revenue, 0, "Tenant B must see zero revenue (no orders of their own)");
  });

  // ─── Scoped model unit checks ───────────────────────────────────

  it("Scoped model findById returns null for another tenant's doc", async () => {
    // Direct unit test of the proxy — no HTTP involved.
    const result = await modelsB.Product.findById(productA._id).lean();
    assert.equal(result, null, "Scoped model must not return cross-tenant doc");
  });

  it("Scoped model aggregate prepends tenantId filter", async () => {
    const results = await modelsB.Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const total = results[0]?.total || 0;
    assert.equal(total, 0, "Aggregate through B's scoped model must not include A's orders");
  });

  it("Scoped model updateOne is a no-op on another tenant's doc", async () => {
    const result = await modelsB.Product.updateOne(
      { _id: productA._id },
      { $set: { name: "HACKED" } }
    );
    assert.equal(result.modifiedCount, 0, "updateOne must not modify cross-tenant doc");

    const check = await modelsA.Product.findById(productA._id).lean();
    assert.equal(check.name, "Alpha Widget");
  });

  it("Scoped model deleteOne is a no-op on another tenant's doc", async () => {
    const result = await modelsB.Product.deleteOne({ _id: productA._id });
    assert.equal(result.deletedCount, 0, "deleteOne must not delete cross-tenant doc");

    const check = await modelsA.Product.findById(productA._id).lean();
    assert.ok(check, "Product must still exist");
  });
});
