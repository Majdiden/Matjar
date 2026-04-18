/**
 * E2E: order status notifications.
 *
 * Pins:
 *   1. Admin can GET/PUT /api/store-settings/notifications and the
 *      template overrides round-trip per status.
 *   2. Customers cannot read or mutate the notifications config.
 *   3. Validation rejects: bad shape, unknown status, malformed email,
 *      oversized template.
 *   4. Updating order status to "Processing" sends an email to the
 *      customer using the merchant's template (variable substitution
 *      works for {{customerName}}, {{orderNumber}}, {{storeName}}).
 *   5. Disabling a status template suppresses the email for that status.
 *   6. Cancelling an order via /api/orders/:id/cancel triggers the
 *      Cancelled-status notification (proves the cancel hook is wired).
 *   7. The default templates fire for un-customised statuses (a brand-new
 *      store is not silent).
 *
 * Test inbox: services/providers/email.js captures sends into an
 * in-memory array when NODE_ENV=test (which the test harness sets in
 * tests/helpers/db.js). The test imports getTestInbox/clearTestInbox
 * to assert what was sent.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { getTestInbox, clearTestInbox } from "../../services/providers/email.js";

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
  return { token: res.body.data.accessToken, userId: res.body.data.user._id };
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

// Create a product directly via the scoped model so the test doesn't
// depend on dashboard product CRUD.
async function seedProduct(tenantId) {
  const models = createScopedModels(mongoose.connection, tenantId);
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
  return { models, product };
}

async function placeOrder(app, customerToken, productId) {
  await request(app)
    .post("/api/cart/add")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ productId: productId.toString(), quantity: 1 })
    .expect(200);
  const res = await request(app)
    .post("/api/orders")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ shippingAddress: SHIPPING_ADDRESS, paymentMethod: "cod" });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.responseObject;
}

describe("E2E order status notifications", () => {
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
    clearTestInbox();
  });

  it("admin can GET/PUT notifications config and templates round-trip", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    const initial = await request(app)
      .get("/api/store-settings/notifications")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    // Brand-new tenant: notifications block exists with all-true defaults
    // (mongoose subdoc defaults), no merchant overrides yet.
    assert.equal(initial.body.success, true);

    const update = await request(app)
      .put("/api/store-settings/notifications")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fromName: "Acme",
        fromEmail: "noreply@acme.test",
        templates: {
          Processing: {
            enabled: true,
            subject: "Brewing your order {{orderNumber}}",
            body: "Hi {{customerName}}, your order is being prepared at {{storeName}}.",
          },
          Shipped: { enabled: false },
        },
      })
      .expect(200);
    assert.equal(update.body.data.fromName, "Acme");
    assert.equal(update.body.data.fromEmail, "noreply@acme.test");
    assert.equal(update.body.data.templates.Processing.subject, "Brewing your order {{orderNumber}}");
    assert.equal(update.body.data.templates.Shipped.enabled, false);
  });

  it("rejects bad notification payloads", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    const r1 = await request(app)
      .put("/api/store-settings/notifications")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ fromEmail: "not-an-email" });
    assert.equal(r1.status, 400);

    const r2 = await request(app)
      .put("/api/store-settings/notifications")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ templates: { NotARealStatus: { enabled: true } } });
    assert.equal(r2.status, 400);

    const r3 = await request(app)
      .put("/api/store-settings/notifications")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ templates: { Pending: { enabled: "yes" } } });
    assert.equal(r3.status, 400);

    const r4 = await request(app)
      .put("/api/store-settings/notifications")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ templates: { Pending: { body: "x".repeat(10001) } } });
    assert.equal(r4.status, 400);
  });

  it("customers cannot read or mutate notifications config", async () => {
    await provisionTenant(app);
    const { token } = await registerCustomer(app, "shopper@buyer.test");

    const r1 = await request(app)
      .get("/api/store-settings/notifications")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(r1.status, 403);

    const r2 = await request(app)
      .put("/api/store-settings/notifications")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ fromName: "hax" });
    assert.equal(r2.status, 403);
  });

  it("status update sends a templated email with variable substitution", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const { product } = await seedProduct(tenantId);
    const { token: customerToken } = await registerCustomer(app);
    const order = await placeOrder(app, customerToken, product._id);

    // Customise the Processing template.
    await request(app)
      .put("/api/store-settings/notifications")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fromName: "Acme Coffee",
        templates: {
          Processing: {
            enabled: true,
            subject: "Brewing your order {{orderNumber}}",
            body: "Hi {{customerName}}, order {{orderNumber}} is being prepared at {{storeName}}.",
          },
        },
      })
      .expect(200);

    clearTestInbox();

    // Admin transitions order to Processing.
    await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Processing" })
      .expect(200);

    const inbox = getTestInbox();
    assert.equal(inbox.length, 1, `expected 1 email, got ${inbox.length}`);
    const sent = inbox[0];
    assert.equal(sent.to, "jane@buyer.test");
    assert.equal(sent.subject, `Brewing your order ${order.orderNumber}`);
    assert.match(sent.html, /Hi Jane Doe/);
    assert.match(sent.html, new RegExp(`order ${order.orderNumber} is being prepared at Acme Coffee`));
  });

  it("disabled status template suppresses the email", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const { product } = await seedProduct(tenantId);
    const { token: customerToken } = await registerCustomer(app);
    const order = await placeOrder(app, customerToken, product._id);

    await request(app)
      .put("/api/store-settings/notifications")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ templates: { Processing: { enabled: false } } })
      .expect(200);

    clearTestInbox();

    await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Processing" })
      .expect(200);

    assert.equal(getTestInbox().length, 0, "no email should be sent when status disabled");
  });

  it("cancelling an order fires the Cancelled notification", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const { product } = await seedProduct(tenantId);
    const { token: customerToken } = await registerCustomer(app);
    const order = await placeOrder(app, customerToken, product._id);

    clearTestInbox();

    await request(app)
      .post(`/api/orders/${order._id}/cancel`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const inbox = getTestInbox();
    assert.ok(inbox.length >= 1, "at least one email expected");
    const cancelled = inbox.find((m) => m.subject.includes("cancelled"));
    assert.ok(cancelled, `expected a 'cancelled' email, got: ${inbox.map((m) => m.subject).join(", ")}`);
    assert.equal(cancelled.to, "jane@buyer.test");
  });

  it("default template fires for un-customised statuses (no merchant overrides)", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const { product } = await seedProduct(tenantId);
    const { token: customerToken } = await registerCustomer(app);
    const order = await placeOrder(app, customerToken, product._id);

    // Walk the legal state machine: Pending → Processing → Shipped → Delivered.
    // The state machine rejects direct jumps.
    for (const status of ["Processing", "Shipped"]) {
      await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set("Host", HOST)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status })
        .expect(200);
    }

    // Clear inbox right before the final transition so we only capture
    // the Delivered notification.
    clearTestInbox();

    await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Delivered" })
      .expect(200);

    const inbox = getTestInbox();
    assert.equal(inbox.length, 1);
    assert.match(inbox[0].subject, new RegExp(`Order ${order.orderNumber} delivered`));
    assert.equal(inbox[0].to, "jane@buyer.test");
  });
});
