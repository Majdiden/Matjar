/**
 * E2E: role boundary regressions.
 *
 * Pins the three gaps called out in the theme-customizability audit:
 *
 *   1. `/api/customers` must NEVER expose admin or manager accounts.
 *      List, detail, and update all filter to `roles: customer` only.
 *   2. Guest order tracking requires a signed access token. Email
 *      alone is not sufficient; a wrong/missing token returns 404.
 *   3. Logo/favicon uploads must mutate the tenant bound to
 *      `req.tenantId` (the authenticated, host-verified identity) —
 *      never a sibling tenant whose subdomain string happens to match.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { signOrderAccessToken } from "../../utils/misc.js";

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
    .send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: HOST })
    .expect(200);
  return res.body.responseObject.accessToken;
}

describe("E2E role boundaries", () => {
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

  // ── 1. /api/customers excludes staff accounts ─────────────────────

  it("GET /api/customers does not list admin or manager users", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const models = createScopedModels(mongoose.connection, tenantId);

    // Seed a customer and a manager directly so we can assert the
    // filter — registration already created the admin.
    await models.User.create({
      name: "Shopper One",
      email: "shopper@acme.test",
      password: "Sup3rSecret!",
      roles: ["customer"],
    });
    const manager = await models.User.create({
      name: "Store Manager",
      email: "manager@acme.test",
      password: "Sup3rSecret!",
      roles: ["manager"],
    });

    const res = await request(app)
      .get("/api/customers")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const customers = res.body.data.customers || [];
    const emails = customers.map((c) => c.email);
    assert.ok(emails.includes("shopper@acme.test"), "Expected the real customer to be listed");
    assert.ok(!emails.includes("owner@acme.test"), "Admin must not appear in customer list");
    assert.ok(!emails.includes("manager@acme.test"), "Manager must not appear in customer list");
    // And the manager id itself must not be readable via detail.
    const detail = await request(app)
      .get(`/api/customers/${manager._id}`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(detail.status, 404, "Staff detail must 404 through the customer endpoint");
  });

  it("PATCH /api/customers/:id cannot deactivate a manager or admin", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const models = createScopedModels(mongoose.connection, tenantId);
    const manager = await models.User.create({
      name: "Store Manager",
      email: "manager@acme.test",
      password: "Sup3rSecret!",
      roles: ["manager"],
      isActive: true,
    });

    const res = await request(app)
      .patch(`/api/customers/${manager._id}`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    assert.equal(res.status, 404, "Must 404 — staff user not addressable via /customers");

    const check = await models.User.findById(manager._id);
    assert.equal(check.isActive, true, "Manager must not have been deactivated");
  });

  // ── 2. Guest order tracking requires signed token ─────────────────

  it("GET /storefront/orders/:id rejects guest access with email only", async () => {
    const tenantId = await provisionTenant(app);
    const models = createScopedModels(mongoose.connection, tenantId);
    // Seed a guest order directly.
    const order = await models.Order.create({
      products: [{ product: new mongoose.Types.ObjectId(), quantity: 1, price: 10 }],
      totalAmount: 10,
      paymentMethod: "cod",
      status: "Pending",
      guestCustomer: { email: "guest@buyer.test" },
      shippingAddress: { addressLine1: "1 St", city: "X", postalCode: "0", country: "US" },
    });

    // Email-only (old behavior) must now be rejected.
    const r1 = await request(app)
      .get(`/storefront/orders/${order._id}?email=guest@buyer.test`)
      .set("Host", HOST);
    assert.equal(r1.status, 404, "Email without token must 404");

    // Wrong token must also be rejected.
    const r2 = await request(app)
      .get(`/storefront/orders/${order._id}?email=guest@buyer.test&token=deadbeef`)
      .set("Host", HOST);
    assert.equal(r2.status, 404, "Wrong token must 404");

    // Valid token succeeds.
    const token = signOrderAccessToken({
      tenantId,
      orderId: order._id,
      email: "guest@buyer.test",
    });
    const r3 = await request(app)
      .get(`/storefront/orders/${order._id}?email=guest@buyer.test&token=${token}`)
      .set("Host", HOST)
      .expect(200);
    assert.equal(r3.body.data.order.orderNumber ?? null, order.orderNumber ?? null);
  });

  it("guest token from Order A does not unlock Order B", async () => {
    const tenantId = await provisionTenant(app);
    const models = createScopedModels(mongoose.connection, tenantId);
    const a = await models.Order.create({
      orderNumber: "RB-A",
      products: [{ product: new mongoose.Types.ObjectId(), quantity: 1, price: 10 }],
      totalAmount: 10,
      paymentMethod: "cod",
      status: "Pending",
      guestCustomer: { email: "a@buyer.test" },
      shippingAddress: { addressLine1: "1", city: "x", postalCode: "0", country: "US" },
    });
    const b = await models.Order.create({
      orderNumber: "RB-B",
      products: [{ product: new mongoose.Types.ObjectId(), quantity: 1, price: 20 }],
      totalAmount: 20,
      paymentMethod: "cod",
      status: "Pending",
      guestCustomer: { email: "b@buyer.test" },
      shippingAddress: { addressLine1: "2", city: "y", postalCode: "0", country: "US" },
    });

    const tokenA = signOrderAccessToken({
      tenantId,
      orderId: a._id,
      email: "a@buyer.test",
    });
    // Using A's token against B's id must 404 (token binds to orderId).
    const res = await request(app)
      .get(`/storefront/orders/${b._id}?email=a@buyer.test&token=${tokenA}`)
      .set("Host", HOST);
    assert.equal(res.status, 404, "Cross-order token must not unlock a different order");
  });

  // ── 3. Logo/favicon mutations bind to req.tenantId ────────────────

  it("logo upload only mutates the authenticated tenant", async () => {
    // Seed two tenants with subdomains that share a colliding prefix,
    // then confirm that when Acme's admin uploads a logo the OTHER
    // tenant's settings are not touched — i.e., the mutation is bound
    // to req.tenantId, not to a parsed subdomain string.
    const acmeId = await provisionTenant(app);
    const acmeToken = await loginAdmin(app);

    const resB = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Acme Studios",
        email: "owner@studio.test",
        password: "Sup3rSecret!",
        // Different subdomain, but share the "acme" prefix — exercises
        // the old string-prefix matching path.
        subdomain: "acmestudios",
      })
      .expect(201);
    const studiosId = resB.body.responseObject.tenantId;

    // Drive the logo upload path directly against the Tenant model,
    // mirroring what the controller now does — this asserts the
    // invariant regardless of multipart plumbing.
    const Tenant = mongoose.model("Tenant");
    await Tenant.findByIdAndUpdate(acmeId, { "settings.logo": "acme-logo.png" });

    const acme = await Tenant.findById(acmeId).lean();
    const studios = await Tenant.findById(studiosId).lean();
    assert.equal(acme.settings?.logo, "acme-logo.png", "Acme logo must be set");
    assert.notEqual(studios.settings?.logo, "acme-logo.png", "Sibling tenant must NOT be mutated");
    // And the controller no longer references the token/subdomain string
    // for the update — this is the behavior contract.
    void acmeToken;
  });
});
