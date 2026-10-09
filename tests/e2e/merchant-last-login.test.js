/**
 * Merchant last login (platform console).
 *
 * `User.lastLoginAt` existed and the console's staff tab displayed it, but
 * nothing ever wrote it, so every merchant showed "never". Logins now stamp
 * the user and the store (`Tenant.lastLoginAt/By`); the tenants list exposes
 * and sorts by it.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { generateHash } from "../../utils/misc.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { throwawayPassword } from "../helpers/credentials.js";

const MERCHANT_PASSWORD = throwawayPassword();
const PLATFORM_PASSWORD = throwawayPassword();

async function register(app, slug) {
  const res = await request(app).post("/api/auth/register")
    .send({ name: `${slug} owner`, email: `owner@${slug}.test`, password: MERCHANT_PASSWORD, subdomain: slug })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function platformToken(app) {
  await mongoose.model("TenantUser").create({
    tenantId: null, name: "Owner", email: "owner@matjar.test", platformAdmin: true, platformRole: "owner",
    platformPasswordHash: await generateHash(PLATFORM_PASSWORD),
  });
  const res = await request(app).post("/api/platform/login").send({ email: "owner@matjar.test", password: PLATFORM_PASSWORD }).expect(200);
  return res.body.data.token;
}

describe("E2E merchant last login", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  it("stamps the merchant and the store on login, and the console lists and sorts by it", async () => {
    const quiet = await register(app, "quiet");
    const busy = await register(app, "busy");

    const before = Date.now();
    await request(app).post("/api/auth/login").set("Host", "busy.localhost")
      .send({ email: "owner@busy.test", password: MERCHANT_PASSWORD, domain: "busy.localhost" }).expect(200);

    const models = createScopedModels(mongoose.connection, new mongoose.Types.ObjectId(busy));
    const user = await models.User.findOne({ email: "owner@busy.test" }).lean();
    assert.ok(user.lastLoginAt && user.lastLoginAt.getTime() >= before, "user.lastLoginAt set");
    const tenant = await mongoose.model("Tenant").findById(busy).lean();
    assert.ok(tenant.lastLoginAt && tenant.lastLoginAt.getTime() >= before, "tenant.lastLoginAt set");
    assert.equal(tenant.lastLoginBy, "owner@busy.test");
    // A failed login changes nothing.
    await request(app).post("/api/auth/login").set("Host", "quiet.localhost")
      .send({ email: "owner@quiet.test", password: throwawayPassword(), domain: "quiet.localhost" }).expect(401);
    assert.equal((await mongoose.model("Tenant").findById(quiet).lean()).lastLoginAt, null);

    const token = await platformToken(app);
    const auth = { Authorization: `Bearer ${token}` };
    const byLogin = await request(app).get("/api/platform/tenants?sort=last_login").set(auth).expect(200);
    assert.deepEqual(byLogin.body.data.tenants.map((t) => t.slug), ["busy", "quiet"]);
    assert.ok(byLogin.body.data.tenants[0].lastLoginAt);
    assert.equal(byLogin.body.data.tenants[0].lastLoginBy, "owner@busy.test");
    const quietFirst = await request(app).get("/api/platform/tenants?sort=least_recent_login").set(auth).expect(200);
    assert.equal(quietFirst.body.data.tenants[0].slug, "quiet");
    // Unknown / prototype keys fall back to the default order instead of erroring.
    await request(app).get("/api/platform/tenants?sort=constructor").set(auth).expect(200);

    // The staff tab now has a real value.
    const staff = await request(app).get(`/api/platform/tenants/${busy}/users`).set(auth).expect(200);
    const owner = staff.body.data.find((r) => r.email === "owner@busy.test");
    assert.ok(owner?.lastLoginAt, "staff tab shows the login");
  });
});
