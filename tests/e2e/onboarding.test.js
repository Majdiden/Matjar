/**
 * E2E: guided onboarding (PBI 10, tasks 10-16 and 10-17).
 *
 *   1. GET /api/auth/onboarding-config is public and follows the GLOBAL
 *      `onboarding.v2` flag (off by default).
 *   2. A v2 signup fills the brand kit from the signup: WhatsApp defaults to
 *      the account phone (E.164), city → `brand.city.ar`, delivery areas →
 *      `settings.policyAnswers.deliveryAreas`; the store is marked v2.
 *   3. A v1 signup is unchanged: the v2 answers are ignored, nothing is
 *      added to the brand kit.
 *   4. Bad v2 answers are a 400 with nothing written.
 *   5. GET/POST /api/onboarding stamps the first share / payments review
 *      once, is tenant-scoped, and rejects unknown events.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { setFeatureOverrides, invalidateFeatureFlagCache } from "../../services/featureFlags.js";

const PASSWORD = "Sup3rSecret!";

const register = (app, slug, extra = {}) =>
  request(app)
    .post("/api/auth/register")
    .send({ name: `Owner ${slug}`, email: `owner@${slug}.test`, password: PASSWORD, subdomain: slug, ...extra });

async function login(app, slug) {
  const host = `${slug}.localhost`;
  const res = await request(app)
    .post("/api/auth/login")
    .set("Host", host)
    .send({ email: `owner@${slug}.test`, password: PASSWORD, domain: host })
    .expect(200);
  return res.body.responseObject.accessToken;
}

const onboarding = (app, slug, token) => ({
  get: () => request(app).get("/api/onboarding").set("Host", `${slug}.localhost`).set("Authorization", `Bearer ${token}`),
  post: (event) =>
    request(app)
      .post("/api/onboarding/events")
      .set("Host", `${slug}.localhost`)
      .set("Authorization", `Bearer ${token}`)
      .send({ event }),
});

const tenantBySlug = (slug) => mongoose.model("Tenant").findOne({ slug }).lean();

describe("E2E guided onboarding (signup v2 + first-sale checklist)", () => {
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
    invalidateFeatureFlagCache();
  });

  it("serves the signup flow publicly from the global onboarding.v2 flag (off by default)", async () => {
    const off = await request(app).get("/api/auth/onboarding-config").expect(200);
    assert.deepEqual(off.body.responseObject, { v2: false });

    await setFeatureOverrides([{ key: "onboarding.v2", value: true }], "test");
    const on = await request(app).get("/api/auth/onboarding-config").expect(200);
    assert.deepEqual(on.body.responseObject, { v2: true });
  });

  it("v2 signup: WhatsApp defaults to the account phone, city and delivery areas are stored", async () => {
    await register(app, "nile", {
      onboardingFlow: "v2",
      phone: "091 234-5678",
      city: "  الخرطوم  ",
      deliveryAreas: "الخرطوم\nبحري\n أم درمان ",
    }).expect(201);

    const tenant = await tenantBySlug("nile");
    assert.equal(tenant.settings.brand.whatsapp, "+249912345678");
    assert.deepEqual(tenant.settings.brand.city, { ar: "الخرطوم" });
    assert.deepEqual(tenant.settings.policyAnswers.deliveryAreas, { ar: "الخرطوم، بحري، أم درمان" });
    assert.equal(tenant.onboarding.flow, "v2");

    // The storefront sees the brand kit right away.
    const sf = await request(app).get("/storefront/store-info").set("Host", "nile.localhost").expect(200);
    assert.equal(sf.body.data.store.brand.whatsapp, "+249912345678");
    assert.deepEqual(sf.body.data.store.brand.city, { ar: "الخرطوم" });
  });

  it("v2 signup without a phone or answers leaves the brand kit empty", async () => {
    await register(app, "blue", { onboardingFlow: "v2" }).expect(201);
    const tenant = await tenantBySlug("blue");
    assert.equal(tenant.settings.brand, undefined);
    assert.equal(tenant.settings.policyAnswers, undefined);
    assert.equal(tenant.onboarding.flow, "v2");
  });

  it("v1 signup is unchanged: v2 answers are ignored and the store is not marked", async () => {
    await register(app, "acme", { phone: "0912345678", city: "Khartoum", deliveryAreas: "Everywhere" }).expect(201);
    const tenant = await tenantBySlug("acme");
    assert.equal(tenant.phone, "+249912345678");
    assert.equal(tenant.settings.brand, undefined, "no WhatsApp/city without v2");
    assert.equal(tenant.settings.policyAnswers, undefined);
    assert.equal(tenant.onboarding, undefined);
  });

  it("rejects bad v2 answers before writing anything", async () => {
    const longCity = await register(app, "long", { onboardingFlow: "v2", city: "x".repeat(81) });
    assert.equal(longCity.status, 400);
    const longAreas = await register(app, "areas", { onboardingFlow: "v2", deliveryAreas: "y".repeat(301) });
    assert.equal(longAreas.status, 400);
    const badFlow = await register(app, "flow", { onboardingFlow: "v3" });
    assert.equal(badFlow.status, 400);
    assert.equal(await mongoose.model("Tenant").countDocuments({}), 0);
  });

  it("add-store in v2 copies the account phone to the new store's WhatsApp", async () => {
    await register(app, "first", { phone: "0912345678" }).expect(201);
    const token = await login(app, "first");
    await request(app)
      .post("/api/auth/stores")
      .set("Host", "first.localhost")
      .set("Authorization", `Bearer ${token}`)
      .send({ storeName: "Second", subdomain: "second", onboardingFlow: "v2", city: "بورتسودان" })
      .expect(201);
    const second = await tenantBySlug("second");
    assert.equal(second.settings.brand.whatsapp, "+249912345678");
    assert.deepEqual(second.settings.brand.city, { ar: "بورتسودان" });
  });

  it("stamps the first share and payments review once, per store", async () => {
    await register(app, "nile").expect(201);
    await register(app, "blue").expect(201);
    const nile = onboarding(app, "nile", await login(app, "nile"));
    const blue = onboarding(app, "blue", await login(app, "blue"));

    const empty = await nile.get().expect(200);
    assert.deepEqual(empty.body.data, { flow: null, sharedAt: null, paymentsReviewedAt: null });

    const first = await nile.post("shared").expect(200);
    const sharedAt = first.body.data.sharedAt;
    assert.ok(sharedAt && !Number.isNaN(Date.parse(sharedAt)));

    // A second tap keeps the FIRST time.
    await new Promise((r) => setTimeout(r, 5));
    const again = await nile.post("shared").expect(200);
    assert.equal(again.body.data.sharedAt, sharedAt);

    const reviewed = await nile.post("payments_reviewed").expect(200);
    assert.ok(reviewed.body.data.paymentsReviewedAt);
    assert.equal(reviewed.body.data.sharedAt, sharedAt);

    // Store B is untouched.
    const other = await blue.get().expect(200);
    assert.equal(other.body.data.sharedAt, null);

    // Unknown events and extra keys are rejected; auth is required.
    await nile.post("hacked").expect(400);
    await request(app)
      .post("/api/onboarding/events")
      .set("Host", "nile.localhost")
      .send({ event: "shared" })
      .expect(401);
  });
});
