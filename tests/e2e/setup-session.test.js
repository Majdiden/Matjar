/**
 * First dashboard session after signup (POST /api/store-setup/session).
 *
 * Signup used to keep the merchant's PASSWORD in sessionStorage so the
 * "setting up your store" screen could log in. It now exchanges the
 * one-time setup token from the register response instead. Pins: the
 * exchange works once, only with the right token, only for a short time,
 * and yields a working session for the store's admin.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { SETUP_SESSION_TTL_MS } from "../../services/storeSetup.js";
import { throwawayPassword } from "../helpers/credentials.js";

async function register(app, subdomain = "acme") {
  const res = await request(app).post("/api/auth/register").send({
    name: "Acme Owner", email: `owner@${subdomain}.test`, password: throwawayPassword(), subdomain,
  }).expect(201);
  return { tenantId: res.body.responseObject.tenantId, setupToken: res.body.responseObject.setupToken };
}

describe("E2E setup-token session exchange", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  it("signs the new store's admin in once, and burns the token", async () => {
    const { tenantId, setupToken } = await register(app);
    assert.ok(setupToken, "register returns a setup token");

    const res = await request(app).post("/api/store-setup/session").send({ tenantId, setupToken }).expect(200);
    const ro = res.body.responseObject;
    assert.ok(ro.accessToken && ro.refreshToken);
    assert.equal(ro.tenantId, tenantId);
    assert.deepEqual(ro.roles, ["admin"]);
    assert.equal(ro.email, "owner@acme.test");

    // The session works.
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${ro.accessToken}`);
    assert.equal(me.status, 200);

    // Single use.
    await request(app).post("/api/store-setup/session").send({ tenantId, setupToken }).expect(401);
    const tenant = await mongoose.model("Tenant").findById(tenantId).select("+setupStatus.setupToken").lean();
    assert.equal(tenant.setupStatus.setupToken, undefined, "token deleted after use");
    assert.ok(tenant.setupStatus.sessionIssuedAt);
  });

  // Failures share the login limiter's budget (5 per 15 min per IP), so this
  // file stays within it on purpose.
  it("refuses a wrong token, another store's token, and an expired token", async () => {
    const a = await register(app, "acme");
    const b = await register(app, "bravo");
    await request(app).post("/api/store-setup/session").send({ tenantId: a.tenantId, setupToken: "nope" }).expect(401);
    await request(app).post("/api/store-setup/session").send({ tenantId: a.tenantId, setupToken: b.setupToken }).expect(401);

    // Older than the TTL → refused (and not burned, so nothing changes).
    await mongoose.model("Tenant").updateOne(
      { _id: a.tenantId },
      { $set: { createdAt: new Date(Date.now() - SETUP_SESSION_TTL_MS - 60_000) } },
    );
    await request(app).post("/api/store-setup/session").send({ tenantId: a.tenantId, setupToken: a.setupToken }).expect(401);

    // B still works with its own token.
    await request(app).post("/api/store-setup/session").send({ tenantId: b.tenantId, setupToken: b.setupToken }).expect(200);
  });
});
