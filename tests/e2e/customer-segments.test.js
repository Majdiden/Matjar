/**
 * E2E: customer segmentation.
 *
 * Pins:
 *   1. Admin CRUD on /api/customer-segments round-trips.
 *   2. Customers cannot mutate or read segments (role gating).
 *   3. Segment resolution honours every filter dimension:
 *      - totalSpent threshold via aggregated orders
 *      - orderCount threshold
 *      - tags AND-match
 *      - emailContains substring (case-insensitive)
 *      - acceptsMarketing tri-state
 *      - lastOrderAfter recency window
 *   4. Cancelled / Refunded orders are excluded from spend + count
 *      (otherwise a refunded customer looks like a top spender).
 *   5. Ad-hoc preview endpoint matches saved-segment resolution.
 *
 * Setup strategy: seed three customers with deterministic order histories
 * (one whale, one steady, one one-off) and run a battery of segments
 * against them.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import bcrypt from "bcrypt";

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

async function registerCustomer(app, email) {
  const res = await request(app)
    .post("/storefront/auth/register")
    .set("Host", HOST)
    .send({ name: "Customer", email, password: "Sup3rSecret!" })
    .expect(201);
  return res.body.data.accessToken;
}

// Seed three customers with deterministic order histories. We bypass the
// HTTP order flow and write directly to the scoped models — the goal of
// this test is the segmentation aggregation, not order placement, and
// driving five orders per customer through the cart endpoint would be
// slow and noisy.
async function seedCustomersWithOrders(tenantId) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const passwordHash = await bcrypt.hash("Sup3rSecret!", 10);

  const whale = await models.User.create({
    name: "Whale Wanda",
    email: "whale@buyer.test",
    password: passwordHash,
    roles: ["customer"],
    tags: ["vip", "loyalty"],
    acceptsMarketing: true,
  });
  const steady = await models.User.create({
    name: "Steady Sam",
    email: "sam@buyer.test",
    password: passwordHash,
    roles: ["customer"],
    tags: ["loyalty"],
    acceptsMarketing: true,
  });
  const oneoff = await models.User.create({
    name: "One-off Olivia",
    email: "olivia@dormant.test",
    password: passwordHash,
    roles: ["customer"],
    tags: [],
    acceptsMarketing: false,
  });

  // Whale: 4 paid orders × $300 = $1,200, plus 1 cancelled $1,000 (must
  // NOT count). Most recent order = today.
  for (let i = 0; i < 4; i++) {
    await models.Order.create({
      orderNumber: `#W${1000 + i}`,
      user: whale._id,
      products: [{ product: new mongoose.Types.ObjectId(), name: "x", price: 300, quantity: 1 }],
      subtotal: 300,
      totalAmount: 300,
      paymentMethod: "cod",
      status: "Delivered",
      paymentStatus: "Paid",
      createdAt: new Date(2026, 3, 1 + i),
    });
  }
  await models.Order.create({
    orderNumber: "#W9999",
    user: whale._id,
    products: [{ product: new mongoose.Types.ObjectId(), name: "x", price: 1000, quantity: 1 }],
    subtotal: 1000,
    totalAmount: 1000,
    paymentMethod: "cod",
    status: "Cancelled",
    paymentStatus: "Refunded",
    createdAt: new Date(2026, 3, 5),
  });

  // Steady: 2 paid orders × $50 = $100, last one mid-Feb (older).
  for (let i = 0; i < 2; i++) {
    await models.Order.create({
      orderNumber: `#S${1000 + i}`,
      user: steady._id,
      products: [{ product: new mongoose.Types.ObjectId(), name: "x", price: 50, quantity: 1 }],
      subtotal: 50,
      totalAmount: 50,
      paymentMethod: "cod",
      status: "Delivered",
      paymentStatus: "Paid",
      createdAt: new Date(2026, 1, 10 + i),
    });
  }

  // One-off: 1 order $25 in 2024 — qualifies as dormant.
  await models.Order.create({
    orderNumber: "#O1000",
    user: oneoff._id,
    products: [{ product: new mongoose.Types.ObjectId(), name: "x", price: 25, quantity: 1 }],
    subtotal: 25,
    totalAmount: 25,
    paymentMethod: "cod",
    status: "Delivered",
    paymentStatus: "Paid",
    createdAt: new Date(2024, 5, 1),
  });

  return { models, whale, steady, oneoff };
}

describe("E2E customer segmentation", () => {
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

  it("admin can CRUD segments", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    const createRes = await request(app)
      .post("/api/customer-segments")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "VIPs",
        description: "Top spenders",
        filters: { totalSpentMin: 500 },
      });
    assert.equal(createRes.status, 201, JSON.stringify(createRes.body));
    const segmentId = createRes.body.data._id;

    const listRes = await request(app)
      .get("/api/customer-segments")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(listRes.body.data.length, 1);

    await request(app)
      .put(`/api/customer-segments/${segmentId}`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "VIPs", filters: { totalSpentMin: 1000 } })
      .expect(200);

    await request(app)
      .delete(`/api/customer-segments/${segmentId}`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("rejects malformed filters", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    const r1 = await request(app)
      .post("/api/customer-segments")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Bad", filters: { totalSpentMin: 100, totalSpentMax: 50 } });
    assert.equal(r1.status, 400);

    const r2 = await request(app)
      .post("/api/customer-segments")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Bad2", filters: { totalSpentMin: -1 } });
    assert.equal(r2.status, 400);
  });

  it("customers cannot read or mutate segments", async () => {
    await provisionTenant(app);
    const customerToken = await registerCustomer(app, "shopper@buyer.test");

    const r1 = await request(app)
      .get("/api/customer-segments")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`);
    assert.equal(r1.status, 403);

    const r2 = await request(app)
      .post("/api/customer-segments")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ name: "Mine", filters: {} });
    assert.equal(r2.status, 403);
  });

  it("totalSpent segment picks the whale and excludes cancelled orders", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedCustomersWithOrders(tenantId);

    // Whale paid orders total $1200; cancelled $1000 must NOT be counted.
    // Threshold $1000 should match whale only — if cancelled was included
    // the count would still be 1 but spend would be $2200, so we also
    // assert the spend value.
    const res = await request(app)
      .post("/api/customer-segments/preview")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ totalSpentMin: 1000 })
      .expect(200);

    assert.equal(res.body.data.count, 1);
    assert.equal(res.body.data.users[0].email, "whale@buyer.test");
    assert.equal(res.body.data.users[0].totalSpent, 1200);
    assert.equal(res.body.data.users[0].orderCount, 4);
  });

  it("orderCount segment (>=3) picks only the whale", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedCustomersWithOrders(tenantId);

    const res = await request(app)
      .post("/api/customer-segments/preview")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orderCountMin: 3 })
      .expect(200);
    assert.equal(res.body.data.count, 1);
    assert.equal(res.body.data.users[0].email, "whale@buyer.test");
  });

  it("tags segment AND-matches", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedCustomersWithOrders(tenantId);

    // tag=loyalty matches whale + steady; tag=vip+loyalty matches whale only.
    const r1 = await request(app)
      .post("/api/customer-segments/preview")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tags: ["loyalty"] })
      .expect(200);
    assert.equal(r1.body.data.count, 2);

    const r2 = await request(app)
      .post("/api/customer-segments/preview")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tags: ["loyalty", "vip"] })
      .expect(200);
    assert.equal(r2.body.data.count, 1);
    assert.equal(r2.body.data.users[0].email, "whale@buyer.test");
  });

  it("emailContains is case-insensitive", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedCustomersWithOrders(tenantId);

    const res = await request(app)
      .post("/api/customer-segments/preview")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ emailContains: "DORMANT" })
      .expect(200);
    assert.equal(res.body.data.count, 1);
    assert.equal(res.body.data.users[0].email, "olivia@dormant.test");
  });

  it("acceptsMarketing tri-state filter", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedCustomersWithOrders(tenantId);

    const optedIn = await request(app)
      .post("/api/customer-segments/preview")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ acceptsMarketing: true })
      .expect(200);
    assert.equal(optedIn.body.data.count, 2);

    const optedOut = await request(app)
      .post("/api/customer-segments/preview")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ acceptsMarketing: false })
      .expect(200);
    assert.equal(optedOut.body.data.count, 1);
    assert.equal(optedOut.body.data.users[0].email, "olivia@dormant.test");
  });

  it("recency window picks active customers only", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedCustomersWithOrders(tenantId);

    // Last order ≥ 2026-01-01 → whale + steady, NOT olivia (her only order is 2024).
    const res = await request(app)
      .post("/api/customer-segments/preview")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ lastOrderAfter: "2026-01-01" })
      .expect(200);
    assert.equal(res.body.data.count, 2);
    const emails = res.body.data.users.map((u) => u.email).sort();
    assert.deepEqual(emails, ["sam@buyer.test", "whale@buyer.test"]);
  });

  it("saved segment resolution matches ad-hoc preview", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedCustomersWithOrders(tenantId);

    const create = await request(app)
      .post("/api/customer-segments")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "VIPs", filters: { totalSpentMin: 500 } })
      .expect(201);
    const segmentId = create.body.data._id;

    const saved = await request(app)
      .get(`/api/customer-segments/${segmentId}/preview`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const adhoc = await request(app)
      .post("/api/customer-segments/preview")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ totalSpentMin: 500 })
      .expect(200);

    assert.equal(saved.body.data.count, adhoc.body.data.count);
    assert.equal(saved.body.data.users[0].email, adhoc.body.data.users[0].email);
  });
});
