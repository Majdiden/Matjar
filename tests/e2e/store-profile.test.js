/**
 * E2E: store profile / brand kit API (PBI 10, tasks 10-4 and 10-5).
 *
 * GET/PUT /api/store-profile through the real stack (auth → permission →
 * zod → service → repository) and on to the storefront payload:
 *
 *   1. A fresh store has an empty profile and `brand: null` on the storefront.
 *   2. PUT is a partial update: only sent keys change, values come back
 *      normalised, and null/"" clears a field.
 *   3. Bad input is a 400 with nothing written.
 *   4. Staff without `settings.write` get 403 on PUT (and on GET, which
 *      needs `settings.read`).
 *   5. Store B never sees store A's profile, and A's token cannot write B's.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";

const PASSWORD = "Sup3rSecret!";

async function provisionTenant(app, slug) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: `Store ${slug}`, email: `owner@${slug}.test`, password: PASSWORD, subdomain: slug })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function login(app, slug, email = `owner@${slug}.test`) {
  const host = `${slug}.localhost`;
  const res = await request(app)
    .post("/api/auth/login")
    .set("Host", host)
    .send({ email, password: PASSWORD, domain: host })
    .expect(200);
  return res.body.responseObject.accessToken;
}

const getProfile = (app, slug, token) =>
  request(app).get("/api/store-profile").set("Host", `${slug}.localhost`).set("Authorization", `Bearer ${token}`);

const putProfile = (app, slug, token, body) =>
  request(app).put("/api/store-profile").set("Host", `${slug}.localhost`).set("Authorization", `Bearer ${token}`).send(body);

describe("E2E store profile (brand kit)", () => {
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

  it("reads, partially updates, normalises and clears the profile; storefront follows", async () => {
    const tenantId = await provisionTenant(app, "nile");
    const token = await login(app, "nile");

    // 1. Fresh store: nothing set.
    const empty = await getProfile(app, "nile", token).expect(200);
    assert.deepEqual(empty.body.data.brand, {});
    assert.deepEqual(empty.body.data.socialLinks, {});
    const sf0 = await request(app).get("/storefront/store-info").set("Host", "nile.localhost").expect(200);
    assert.equal(sf0.body.data.store.brand, null, "unconfigured store exposes no brand kit");

    // 2. Partial update with messy input → normalised values.
    const put = await putProfile(app, "nile", token, {
      storeName: "  متجر النيل  ",
      logo: "/uploads/logos/nile.png",
      brand: {
        tagline: { ar: "  عطور أصلية  ", en: "Genuine perfumes" },
        color: "#AA33CC",
        whatsapp: "0912 345 678",
        coverImage: "https://cdn.example.com/cover.jpg",
        city: { ar: "الخرطوم" },
      },
      socialLinks: { facebook: "facebook.com/nile" },
    }).expect(200);
    const p = put.body.data;
    assert.equal(p.storeName, "متجر النيل");
    assert.equal(p.logo, "/uploads/logos/nile.png");
    assert.deepEqual(p.brand, {
      tagline: { ar: "عطور أصلية", en: "Genuine perfumes" },
      coverImage: "https://cdn.example.com/cover.jpg",
      color: "#aa33cc",
      whatsapp: "+249912345678",
      city: { ar: "الخرطوم" },
    });
    assert.deepEqual(p.socialLinks, { facebook: "https://facebook.com/nile" });

    // Only the sent key changes.
    const partial = await putProfile(app, "nile", token, { brand: { hours: { ar: "كل يوم ٩ص - ٩م" } } }).expect(200);
    assert.equal(partial.body.data.brand.color, "#aa33cc", "unsent keys are kept");
    assert.equal(partial.body.data.storeName, "متجر النيل");
    assert.deepEqual(partial.body.data.brand.hours, { ar: "كل يوم ٩ص - ٩م" });

    // GET returns the same thing PUT did.
    const got = await getProfile(app, "nile", token).expect(200);
    assert.deepEqual(got.body.data, partial.body.data);

    // Storefront payload carries the public brand subset.
    const sf1 = await request(app).get("/storefront/store-info").set("Host", "nile.localhost").expect(200);
    assert.deepEqual(sf1.body.data.store.brand, partial.body.data.brand);
    assert.equal(sf1.body.data.store.name, "متجر النيل");

    // Clearing: null and "" both remove the field; absent stays absent in Mongo.
    const cleared = await putProfile(app, "nile", token, {
      brand: { color: null, tagline: "", coverImage: "" },
      socialLinks: { facebook: null },
    }).expect(200);
    assert.equal(cleared.body.data.brand.color, undefined);
    assert.equal(cleared.body.data.brand.tagline, undefined);
    assert.equal(cleared.body.data.brand.coverImage, undefined);
    assert.equal(cleared.body.data.brand.whatsapp, "+249912345678");
    assert.deepEqual(cleared.body.data.socialLinks, {});
    const stored = await mongoose.model("Tenant").findById(tenantId).lean();
    assert.equal("color" in stored.settings.brand, false, "cleared field is unset, not stored as null");
    assert.equal("facebook" in (stored.settings.socialLinks || {}), false);

    // Audit trail, same as other settings changes (fire-and-forget write).
    const models = createScopedModels(mongoose.connection, tenantId);
    let audits = [];
    for (let i = 0; i < 20 && audits.length < 3; i++) {
      audits = await models.AuditLog.find({ action: "settings.profile.updated" }).lean();
      if (audits.length < 3) await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal(audits.length, 3, "one audit entry per successful PUT");
  });

  it("rejects bad input with 400 and writes nothing", async () => {
    const tenantId = await provisionTenant(app, "nile");
    const token = await login(app, "nile");
    await putProfile(app, "nile", token, { brand: { color: "#112233" } }).expect(200);
    const before = await mongoose.model("Tenant").findById(tenantId).lean();

    const bad = [
      { brand: { color: "red" } },
      { brand: { coverImage: "javascript:alert(1)" } },
      { brand: { coverImage: "data:image/png;base64,AAAA" } },
      { brand: { coverImage: "//evil.example/x.jpg" } },
      { logo: "http://insecure.example/logo.png" },
      { brand: { whatsapp: "12" } },
      { brand: { tagline: { ar: "ب".repeat(141) } } },
      { brand: { unknown: "x" } },
      { socialLinks: { facebook: "https://evil.example/page" } },
      { storeName: "x" },
      // A valid change next to an invalid one must not be half-applied.
      { storeName: "Valid Name", brand: { color: "nope" } },
      {},
    ];
    for (const body of bad) {
      const res = await putProfile(app, "nile", token, body);
      assert.equal(res.status, 400, `${JSON.stringify(body)} → ${res.status} ${JSON.stringify(res.body)}`);
    }
    const afterDoc = await mongoose.model("Tenant").findById(tenantId).lean();
    assert.deepEqual(afterDoc.settings.brand, before.settings.brand);
    assert.equal(afterDoc.settings.storeName, before.settings.storeName);
  });

  it("requires the store-settings permissions", async () => {
    const tenantId = await provisionTenant(app, "nile");
    const models = createScopedModels(mongoose.connection, tenantId);
    await models.User.create({ name: "Staff", email: "staff@nile.test", password: PASSWORD, roles: ["staff"] });
    await models.User.create({ name: "Manager", email: "manager@nile.test", password: PASSWORD, roles: ["manager"] });

    const staff = await login(app, "nile", "staff@nile.test");
    await getProfile(app, "nile", staff).expect(403);
    await putProfile(app, "nile", staff, { brand: { color: "#000000" } }).expect(403);

    const manager = await login(app, "nile", "manager@nile.test");
    await putProfile(app, "nile", manager, { brand: { color: "#000000" } }).expect(200);

    await request(app).get("/api/store-profile").set("Host", "nile.localhost").expect(401);
  });

  it("keeps each store's profile to itself", async () => {
    await provisionTenant(app, "alpha");
    await provisionTenant(app, "bravo");
    const tokenA = await login(app, "alpha");
    const tokenB = await login(app, "bravo");

    await putProfile(app, "alpha", tokenA, { brand: { color: "#aa0000", whatsapp: "0912345678" } }).expect(200);

    const b = await getProfile(app, "bravo", tokenB).expect(200);
    assert.deepEqual(b.body.data.brand, {}, "store B must not see store A's brand kit");
    const sfB = await request(app).get("/storefront/store-info").set("Host", "bravo.localhost").expect(200);
    assert.equal(sfB.body.data.store.brand, null);

    // A's token on B's host is refused and B stays untouched.
    const cross = await putProfile(app, "bravo", tokenA, { brand: { color: "#00ff00" } });
    assert.ok([401, 403].includes(cross.status), `expected 401/403, got ${cross.status}`);
    const b2 = await getProfile(app, "bravo", tokenB).expect(200);
    assert.deepEqual(b2.body.data.brand, {});
    const a = await getProfile(app, "alpha", tokenA).expect(200);
    assert.equal(a.body.data.brand.color, "#aa0000");
  });
});
