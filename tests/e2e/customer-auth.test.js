/**
 * E2E smoke: customer auth + password rotation invalidates old tokens.
 *
 * The contract being verified is the token-version epoch defense:
 *   1. Customer registers + logs in → JWT is accepted
 *   2. Customer rotates their password
 *   3. The pre-rotation JWT is rejected by `authenticate` (tokenVersion bump)
 *   4. A fresh login still works (proves we didn't break the happy path)
 *
 * Why this matters: without the tokenVersion bump, a stolen access token
 * would keep working until its natural expiry even after the user rotated
 * their password — defeating the entire point of "change password if you
 * think you've been compromised". This test pins that defense in place so
 * a future refactor can't silently regress it.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";

const HOST = "acme.localhost";
const ORIG_PASSWORD = "Sup3rSecret!";
const NEW_PASSWORD = "Ev3nMoreSecure!";

async function seedTenant() {
  const Tenant = mongoose.model("Tenant");
  return Tenant.create({
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
}

async function registerCustomer(app, email = "jane@buyer.test") {
  const res = await request(app)
    .post("/storefront/auth/register")
    .set("Host", HOST)
    .send({ name: "Jane Doe", email, password: ORIG_PASSWORD })
    .expect(201);
  return res.body.data.accessToken;
}

describe("E2E customer auth + password rotation", () => {
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

  it("issues a usable token on register and accepts it on /auth/me", async () => {
    await seedTenant();
    const token = await registerCustomer(app);

    const res = await request(app)
      .get("/storefront/auth/me")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.email, "jane@buyer.test");
  });

  it("login succeeds with correct password and fails with wrong password", async () => {
    await seedTenant();
    await registerCustomer(app);

    const okRes = await request(app)
      .post("/storefront/auth/login")
      .set("Host", HOST)
      .send({ email: "jane@buyer.test", password: ORIG_PASSWORD })
      .expect(200);
    assert.ok(okRes.body.data.accessToken, "login returns a token");

    const failRes = await request(app)
      .post("/storefront/auth/login")
      .set("Host", HOST)
      .send({ email: "jane@buyer.test", password: "wrongpassword" });
    assert.equal(failRes.status, 401);
    assert.equal(failRes.body.success, false);
  });

  it("password rotation invalidates the previously issued token", async () => {
    await seedTenant();
    const oldToken = await registerCustomer(app);

    // The pre-rotation token works.
    await request(app)
      .get("/storefront/auth/me")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${oldToken}`)
      .expect(200);

    // Rotate the password.
    const rotateRes = await request(app)
      .post("/storefront/auth/me/password")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${oldToken}`)
      .send({ currentPassword: ORIG_PASSWORD, newPassword: NEW_PASSWORD })
      .expect(200);
    assert.equal(rotateRes.body.success, true);

    // Same token, post-rotation: must be rejected. The auth middleware
    // compares decoded.tokenVersion (0) against user.tokenVersion (1)
    // and 401s on mismatch.
    const denied = await request(app)
      .get("/storefront/auth/me")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${oldToken}`);
    assert.equal(denied.status, 401);
    assert.match(JSON.stringify(denied.body).toLowerCase(), /revoked|session|log in/);

    // Old password no longer works on login.
    const oldPwLogin = await request(app)
      .post("/storefront/auth/login")
      .set("Host", HOST)
      .send({ email: "jane@buyer.test", password: ORIG_PASSWORD });
    assert.equal(oldPwLogin.status, 401);

    // Fresh login with the new password yields a new token that works.
    const newLogin = await request(app)
      .post("/storefront/auth/login")
      .set("Host", HOST)
      .send({ email: "jane@buyer.test", password: NEW_PASSWORD })
      .expect(200);
    const newToken = newLogin.body.data.accessToken;
    assert.ok(newToken);

    await request(app)
      .get("/storefront/auth/me")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${newToken}`)
      .expect(200);
  });

  it("rejects rotation when current password is wrong", async () => {
    await seedTenant();
    const token = await registerCustomer(app);

    const res = await request(app)
      .post("/storefront/auth/me/password")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "definitely-not-it", newPassword: NEW_PASSWORD });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);

    // The original token must STILL work — a failed rotation cannot have
    // bumped the epoch as a side effect.
    await request(app)
      .get("/storefront/auth/me")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });
});
