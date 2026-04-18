/**
 * E2E smoke: theme install + customization role gating.
 *
 * Themes are merchant configuration — installing/uninstalling and the
 * entire `/api/theme-customization` surface (sections, settings, custom
 * CSS, publish, reset) must be reachable by admin/manager only. A
 * customer account that somehow learns the URL must not be able to
 * mutate the storefront.
 *
 * What we pin here:
 *   1. Public listing (`GET /api/themes`) is reachable anonymously.
 *   2. `POST /api/themes/:id/install` rejects customer (403) and
 *      anonymous (401), and accepts a manager.
 *   3. Every `/api/theme-customization` route requires manager role —
 *      we hit `GET /` and `POST /publish` as both customer and manager
 *      to cover both read and mutating paths.
 *
 * If a future router refactor accidentally drops `isManager`, this test
 * fires before the regression reaches main.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";

const HOST = "acme.localhost";

async function provisionTenant(app) {
  // Use the public register endpoint so the admin user is created the
  // same way a real signup would create it (avoids drift between the
  // test fixture and the production code path).
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
    // /api/auth/login requires `domain` to scope the lookup to a specific
    // tenant — the dashboard sends it explicitly rather than relying on
    // the host header.
    .send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: "acme.localhost" })
    .expect(200);
  // /api/auth/login returns the token under responseObject.accessToken
  return res.body.responseObject.accessToken;
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
  return res.body.data.accessToken;
}

async function seedTheme() {
  // Theme is registered on the default connection (global, not tenant-
  // scoped) — see repositories/theme.js. Insert directly so install
  // can find a real document.
  const Theme = mongoose.model("Theme");
  return Theme.create({
    name: "Test Modern",
    slug: "test-modern",
    version: "1.0.0",
    description: "A theme for the gating test",
    status: "active",
    isPublished: true,
    // Required by the schema — points to where the theme bundle lives
    // on disk. Tests don't actually serve the bundle, just need a value
    // that satisfies the validator.
    storagePath: "/tmp/test-themes/test-modern",
  });
}

describe("E2E theme install + customization gating", () => {
  let app;
  let adminToken;
  let customerToken;
  let theme;

  before(async () => {
    await startTestDb();
    app = buildTestApp();
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearAllCollections();
    await provisionTenant(app);
    adminToken = await loginAdmin(app);
    customerToken = await registerCustomer(app);
    theme = await seedTheme();
  });

  it("public theme list is reachable without auth", async () => {
    const res = await request(app)
      .get("/api/themes")
      .set("Host", HOST)
      .expect(200);
    // Don't pin the exact response shape — themes endpoint returns a
    // paginated wrapper that has been re-shaped twice already; what we
    // actually want is "the gate doesn't slam shut on the public path".
    assert.equal(res.body.success !== false, true);
  });

  it("install endpoint rejects anonymous (401), customer (403), accepts manager", async () => {
    const themeId = theme._id.toString();

    const anon = await request(app)
      .post(`/api/themes/${themeId}/install`)
      .set("Host", HOST);
    assert.equal(anon.status, 401);

    const customer = await request(app)
      .post(`/api/themes/${themeId}/install`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`);
    assert.equal(customer.status, 403);
    assert.match(JSON.stringify(customer.body).toLowerCase(), /denied|permission/);

    const manager = await request(app)
      .post(`/api/themes/${themeId}/install`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`);
    // Admin must get past the gate. The handler may 200 or 201 — we
    // accept anything in the success range. The important contract is
    // "not 401, not 403".
    assert.ok(
      manager.status >= 200 && manager.status < 300,
      `manager install expected 2xx, got ${manager.status}: ${JSON.stringify(manager.body)}`
    );
  });

  it("uninstall endpoint also gated to manager", async () => {
    const themeId = theme._id.toString();

    const customer = await request(app)
      .post(`/api/themes/${themeId}/uninstall`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`);
    assert.equal(customer.status, 403);
  });

  it("theme-customization read is gated to manager", async () => {
    const anon = await request(app)
      .get("/api/theme-customization/")
      .set("Host", HOST);
    assert.equal(anon.status, 401);

    const customer = await request(app)
      .get("/api/theme-customization/")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`);
    assert.equal(customer.status, 403);

    const manager = await request(app)
      .get("/api/theme-customization/")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`);
    // Past the gate — handler may 200 with empty/default state or 404
    // if no customization exists yet. Either way, NOT 401/403.
    assert.notEqual(manager.status, 401);
    assert.notEqual(manager.status, 403);
  });

  it("theme-customization publish is gated to manager", async () => {
    const customer = await request(app)
      .post("/api/theme-customization/publish")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({});
    assert.equal(customer.status, 403);

    const manager = await request(app)
      .post("/api/theme-customization/publish")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    assert.notEqual(manager.status, 401);
    assert.notEqual(manager.status, 403);
  });

  it("theme-customization custom-css mutation is gated to manager", async () => {
    const customer = await request(app)
      .put("/api/theme-customization/custom-css")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ css: "body { background: red; }" });
    assert.equal(customer.status, 403);
  });
});
