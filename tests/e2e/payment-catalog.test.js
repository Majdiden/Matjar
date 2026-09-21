/**
 * Platform-owned payment methods: the owner defines the catalog, stores sync
 * from it, merchants only enable + fill their details, and a method the
 * platform withdraws disappears from the storefront even if the merchant
 * left it on.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { generateHash } from "../../utils/misc.js";
import { setFeatureOverrides, invalidateFeatureFlagCache } from "../../services/featureFlags.js";

const HOST = "acme.localhost";

async function provisionTenant(app) {
  const res = await request(app).post("/api/auth/register").send({ name: "Acme Coffee", email: "owner@acme.test", password: "Sup3rSecret!", subdomain: "acme" }).expect(201);
  return res.body.responseObject.tenantId;
}
async function merchantToken(app) {
  const res = await request(app).post("/api/auth/login").set("Host", HOST).send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: HOST }).expect(200);
  return res.body.responseObject.accessToken;
}
async function platformToken(app, role) {
  const TenantUser = mongoose.model("TenantUser");
  const email = `${role}@matjar.test`;
  await TenantUser.create({ tenantId: new mongoose.Types.ObjectId(), name: role, email, platformAdmin: true, platformRole: role, platformPasswordHash: await generateHash("PlatformPass2025!!") });
  const res = await request(app).post("/api/platform/login").send({ email, password: "PlatformPass2025!!" }).expect(200);
  return res.body.data.token;
}

describe("E2E platform payment catalog", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => {
    await clearAllCollections();
    // The merchant payment-methods UI is behind a platform flag (off by default).
    await setFeatureOverrides({ "payments.methods": true }, null);
    invalidateFeatureFlagCache();
  });

  it("bootstraps COD + manual transfer, lets the owner add/withdraw methods, and stores follow", async () => {
    await provisionTenant(app);
    const owner = await platformToken(app, "owner");
    const support = await platformToken(app, "support");

    // Catalog bootstraps with the two built-ins.
    const list = await request(app).get("/api/platform/payment-methods").set("Authorization", `Bearer ${owner}`).expect(200);
    assert.deepEqual(list.body.data.entries.map((e) => e.code), ["cod", "manual-transfer"]);
    assert.ok(list.body.data.integrations.some((i) => i.key === "manual-transfer" && i.supportsProviders));

    // Support can read but not write.
    await request(app).post("/api/platform/payment-methods").set("Authorization", `Bearer ${support}`).send({ code: "x", integrationKey: "cod", label: "X" }).expect(403);

    // Owner adds a mobile-money method with two providers, enabled.
    const created = await request(app)
      .post("/api/platform/payment-methods")
      .set("Authorization", `Bearer ${owner}`)
      .send({ code: "mobile-money", integrationKey: "manual-transfer", label: "Mobile money", labelAr: "محفظة", description: "Pay from your wallet.", enabled: true, order: 3, providers: [{ code: "mtn", label: "MTN MoMo" }, { code: "zain", label: "Zain Cash" }] })
      .expect(201);
    assert.equal(created.body.data.type, "manual");
    // Default customer fields came from the integration.
    assert.deepEqual(created.body.data.customerFields.map((f) => f.name), ["transactionNumber", "receipt"]);
    // Invalid input is rejected.
    await request(app).post("/api/platform/payment-methods").set("Authorization", `Bearer ${owner}`).send({ code: "Bad Code!", integrationKey: "cod", label: "X" }).expect(400);
    await request(app).post("/api/platform/payment-methods").set("Authorization", `Bearer ${owner}`).send({ code: "mobile-money", integrationKey: "cod", label: "dup" }).expect(409);

    // Merchant list syncs the new method in (disabled), cannot install or delete, and only toggles/fills details.
    const m = await merchantToken(app);
    const mine = await request(app).get("/api/payment-methods").set("Host", HOST).set("Authorization", `Bearer ${m}`).expect(200);
    const codes = mine.body.data.methods.map((x) => x.code);
    assert.deepEqual(codes.sort(), ["cod", "manual-transfer", "mobile-money"]);
    const mm = mine.body.data.methods.find((x) => x.code === "mobile-money");
    assert.equal(mm.enabled, false);
    assert.equal(mm.platformEnabled, true);
    assert.deepEqual(mm.providers.map((p) => p.code), ["mtn", "zain"]);
    await request(app).post("/api/payment-methods").set("Host", HOST).set("Authorization", `Bearer ${m}`).send({ code: "stripe" }).expect(410);
    await request(app).delete(`/api/payment-methods/${mm._id}`).set("Host", HOST).set("Authorization", `Bearer ${m}`).expect(410);

    const patched = await request(app)
      .patch(`/api/payment-methods/${mm._id}`)
      .set("Host", HOST).set("Authorization", `Bearer ${m}`)
      .send({ enabled: true, label: "My own label", providers: [{ code: "mtn", enabled: true, accountNumber: "0912345678", beneficiaryName: "Acme" }, { code: "evil", enabled: true, accountNumber: "1" }] })
      .expect(200);
    assert.equal(patched.body.data.method.enabled, true);
    assert.equal(patched.body.data.method.label, "Mobile money", "merchant cannot rename a platform method");
    assert.deepEqual(patched.body.data.method.providers.map((p) => p.code), ["mtn", "zain"], "merchant cannot add providers");
    assert.equal(patched.body.data.method.providers[0].accountNumber, "0912345678");

    // Storefront shows it with the filled provider only.
    const sf = await request(app).get("/storefront/payment-methods").set("Host", HOST).expect(200);
    const sfMm = sf.body.data.methods.find((x) => x.code === "mobile-money");
    assert.ok(sfMm, "storefront lists the enabled method");
    assert.deepEqual(sfMm.providers.map((p) => p.code), ["mtn"]);

    // Platform withdraws the method → merchant flag flips, storefront hides it, merchant cannot re-enable.
    await request(app).patch(`/api/platform/payment-methods/${created.body.data._id}`).set("Authorization", `Bearer ${owner}`).send({ enabled: false, reason: "provider outage" }).expect(200);
    const mine2 = await request(app).get("/api/payment-methods").set("Host", HOST).set("Authorization", `Bearer ${m}`).expect(200);
    const mm2 = mine2.body.data.methods.find((x) => x.code === "mobile-money");
    assert.equal(mm2.platformEnabled, false);
    assert.equal(mm2.providers[0].accountNumber, "0912345678", "merchant details survive a sync");
    const sf2 = await request(app).get("/storefront/payment-methods").set("Host", HOST).expect(200);
    const listed = sf2.body.data.methods.map((x) => x.code);
    assert.ok(!listed.includes("mobile-money"));
    await request(app).patch(`/api/payment-methods/${mm._id}`).set("Host", HOST).set("Authorization", `Bearer ${m}`).send({ enabled: true }).expect(400);

    // Built-ins cannot be deleted; custom ones can.
    const cod = list.body.data.entries.find((e) => e.code === "cod");
    await request(app).delete(`/api/platform/payment-methods/${cod._id}`).set("Authorization", `Bearer ${owner}`).expect(400);
    await request(app).delete(`/api/platform/payment-methods/${created.body.data._id}`).set("Authorization", `Bearer ${owner}`).expect(200);
  });
});
