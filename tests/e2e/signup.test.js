/**
 * E2E smoke: tenant signup → store provisioning.
 *
 * Hits POST /api/auth/register with a valid payload and asserts:
 *   1. The endpoint returns 201 with the new tenant id + slug
 *   2. The Tenant doc actually landed in mongo
 *   3. An admin User was created on the tenant's scoped models with the
 *      `admin` role and a hashed password (not the plaintext we sent)
 *
 * The contract being verified is "register works end-to-end" — if any of
 * the layers (validator, controller, service, repos, scoped models)
 * silently regresses, this test fires.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";

describe("E2E signup → store provision", () => {
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

  it("creates a tenant + admin user from a valid register payload", async () => {
    const payload = {
      name: "Acme Coffee",
      email: "owner@acme.test",
      password: "Sup3rSecret!",
      subdomain: "acme",
    };

    const res = await request(app)
      .post("/api/auth/register")
      .send(payload)
      .expect(201);

    assert.equal(res.body.success, true);
    assert.ok(res.body.responseObject?.tenantId, "tenantId returned");
    assert.equal(res.body.responseObject.slug, "acme");

    // Tenant landed in mongo with the right slug.
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findById(res.body.responseObject.tenantId).lean();
    assert.ok(tenant, "tenant doc persisted");
    assert.equal(tenant.slug, "acme");
    assert.equal(tenant.email, payload.email);

    // Admin user was created on the tenant's scoped models with hashed pw.
    const models = createScopedModels(mongoose.connection, tenant._id);
    const admin = await models.User.findOne({ email: payload.email }).lean();
    assert.ok(admin, "admin user persisted in tenant scope");
    assert.deepEqual(admin.roles, ["admin"]);
    assert.notEqual(
      admin.password,
      payload.password,
      "password must be hashed, not stored plaintext"
    );

    // A platform-subdomain Domain registry row is written as part of
    // signup — the resolver depends on it for storefront routing, so
    // a signup that doesn't land the row would silently break the
    // tenant's storefront. Assert it exists, is owned by this tenant,
    // is the single primary, and is immediately ACTIVE (platform
    // subdomains skip DNS/SSL verification).
    const Domain = mongoose.model("Domain");
    const domainRow = await Domain.findOne({
      tenantId: tenant._id,
      hostname: tenant.domains.subdomain.fullDomain,
    }).lean();
    assert.ok(domainRow, "platform subdomain Domain row created");
    assert.equal(domainRow.kind, "platform_subdomain");
    assert.equal(domainRow.status, "active");
    assert.equal(domainRow.isPrimary, true);
  });

  it("rejects a duplicate subdomain", async () => {
    const payload = {
      name: "Acme Coffee",
      email: "owner@acme.test",
      password: "Sup3rSecret!",
      subdomain: "acme",
    };

    await request(app).post("/api/auth/register").send(payload).expect(201);

    // Second register with the same subdomain must fail. The service
    // throws "Subdomain already taken" — the global error handler turns
    // that into a non-2xx with the message in the body.
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...payload, email: "other@acme.test" });

    assert.notEqual(res.status, 201);
    assert.match(JSON.stringify(res.body).toLowerCase(), /already taken|already exists|subdomain/);
  });

  it("rejects a malformed payload via the validator", async () => {
    // Missing subdomain + weak password should not even reach the service.
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "X", email: "not-an-email", password: "short" });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });
});
