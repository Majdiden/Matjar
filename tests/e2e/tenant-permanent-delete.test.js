/**
 * Permanent store deletion from the platform console (single + bulk) and the
 * owner-controlled permission behind it.
 *
 * Pins the contract the user asked for:
 *   - only staff holding `tenant.delete` can do it — owners by default, admins
 *     never by role, anyone else only after an owner grants it;
 *   - every deletion needs the operator's password re-entered plus a typed
 *     confirmation;
 *   - a deleted store is GONE (tenant row, domains, merchant logins, every
 *     scoped collection) while other stores and platform staff are untouched,
 *     and the audit ledger keeps a record.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { generateHash } from "../../utils/misc.js";
import { createScopedModels } from "../../utils/scopedModel.js";

const PLATFORM_PASSWORD = "PlatformPass2025!!";

async function provisionTenant(app, slug) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: `${slug} owner`, storeName: `${slug} store`, email: `owner@${slug}.test`, password: "Sup3rSecret!", subdomain: slug })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function platformUser(app, role) {
  const TenantUser = mongoose.model("TenantUser");
  const email = `${role}-${Math.random().toString(36).slice(2, 7)}@matjar.test`;
  const row = await TenantUser.create({
    tenantId: null,
    name: role,
    email,
    platformAdmin: true,
    platformRole: role,
    platformPasswordHash: await generateHash(PLATFORM_PASSWORD),
  });
  const res = await request(app).post("/api/platform/login").send({ email, password: PLATFORM_PASSWORD }).expect(200);
  return { id: String(row._id), token: res.body.data.token };
}

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });

async function reauthToken(app, u) {
  const res = await request(app).post("/api/platform/auth/reauth").set(auth(u)).send({ password: PLATFORM_PASSWORD }).expect(200);
  return res.body.data.reauthToken;
}

async function seedStoreData(tenantId) {
  const models = createScopedModels(mongoose.connection, new mongoose.Types.ObjectId(tenantId));
  await models.Page.create({ title: "About", slug: "about", content: "<p>hi</p>" });
  await models.Asset.create({ url: "/uploads/product/x.jpg", publicId: "local-product-1", preset: "product", storage: "local" });
}

async function storeRowCounts(tenantId) {
  const id = new mongoose.Types.ObjectId(tenantId);
  return {
    tenant: await mongoose.model("Tenant").countDocuments({ _id: id }),
    domains: await mongoose.model("Domain").countDocuments({ tenantId: id }),
    merchants: await mongoose.model("TenantUser").countDocuments({ tenantId: id }),
    users: await mongoose.model("User").countDocuments({ tenantId: id }),
    pages: await mongoose.model("Page").countDocuments({ tenantId: id }),
    assets: await mongoose.model("Asset").countDocuments({ tenantId: id }),
  };
}

describe("E2E permanent store deletion", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  it("lets an owner delete a store completely, leaving other stores and staff intact", async () => {
    const doomed = await provisionTenant(app, "doomed");
    const kept = await provisionTenant(app, "kept");
    await seedStoreData(doomed);
    await seedStoreData(kept);
    const owner = await platformUser(app, "owner");
    const url = `/api/platform/tenants/${doomed}/delete-permanently`;
    const body = { confirmSlug: "doomed", reason: "Test store cleanup", password: PLATFORM_PASSWORD };

    // Wrong password and wrong slug change nothing.
    const badPw = await request(app).post(url).set(auth(owner)).send({ ...body, password: "nope-nope-nope" });
    assert.equal(badPw.status, 400);
    assert.equal(badPw.body.code, "PASSWORD_INCORRECT");
    const badSlug = await request(app).post(url).set(auth(owner)).send({ ...body, confirmSlug: "kept" });
    assert.equal(badSlug.status, 400);
    assert.equal(badSlug.body.code, "CONFIRMATION_MISMATCH");
    assert.equal((await storeRowCounts(doomed)).tenant, 1);

    const res = await request(app).post(url).set(auth(owner)).send(body).expect(200);
    assert.equal(res.body.data.ok, true);
    // The password never echoes back.
    assert.doesNotMatch(JSON.stringify(res.body), new RegExp(PLATFORM_PASSWORD));

    assert.deepEqual(await storeRowCounts(doomed), { tenant: 0, domains: 0, merchants: 0, users: 0, pages: 0, assets: 0 });
    const keptCounts = await storeRowCounts(kept);
    assert.equal(keptCounts.tenant, 1);
    assert.equal(keptCounts.domains, 1);
    assert.equal(keptCounts.pages, 1);
    assert.equal(keptCounts.assets, 1);
    assert.ok(keptCounts.users >= 1);
    assert.equal(await mongoose.model("TenantUser").countDocuments({ platformAdmin: true }), 1, "platform staff untouched");

    // The hostname is free again and the audit ledger kept the record.
    await request(app).get("/api/domains/check-subdomain?subdomain=doomed").expect(200)
      .then((r) => assert.equal(r.body.data.available, true));
    const audit = await mongoose.model("PlatformAuditLog").findOne({ action: "tenant.delete_permanently" }).lean();
    assert.ok(audit, "audit row written");
    assert.equal(String(audit.tenantId), doomed);
    assert.equal(audit.outcome, "success");
    assert.doesNotMatch(JSON.stringify(audit), new RegExp(PLATFORM_PASSWORD));

    // Deleting again is a clean 404.
    await request(app).post(url).set(auth(owner)).send(body).expect(404);
  });

  it("denies admins by role; an owner can grant and revoke the permission per person", async () => {
    const tenantId = await provisionTenant(app, "shop");
    const owner = await platformUser(app, "owner");
    const admin = await platformUser(app, "admin");
    const ops = await platformUser(app, "operations");
    const body = { confirmSlug: "shop", reason: "Test store cleanup", password: PLATFORM_PASSWORD };
    const url = `/api/platform/tenants/${tenantId}/delete-permanently`;

    await request(app).post(url).set(auth(admin)).send(body).expect(403);
    await request(app).post(url).set(auth(ops)).send(body).expect(403);

    // Only an owner may grant, and only with a fresh re-auth.
    const grantUrl = `/api/platform/users/${ops.id}/store-deletion`;
    await request(app).patch(grantUrl).set(auth(admin)).set("X-Reauth", await reauthToken(app, admin)).send({ allowed: true }).expect(403);
    await request(app).patch(grantUrl).set(auth(owner)).send({ allowed: true }).expect(403);
    const granted = await request(app).patch(grantUrl).set(auth(owner)).set("X-Reauth", await reauthToken(app, owner)).send({ allowed: true }).expect(200);
    assert.ok(granted.body.data.scopes.includes("tenant.delete"));
    // Owners hold it by role and can't be targeted.
    await request(app).patch(`/api/platform/users/${owner.id}/store-deletion`).set(auth(owner)).set("X-Reauth", await reauthToken(app, owner)).send({ allowed: false }).expect(400);

    // Revoking takes effect on the very next request.
    await request(app).patch(grantUrl).set(auth(owner)).set("X-Reauth", await reauthToken(app, owner)).send({ allowed: false }).expect(200);
    await request(app).post(url).set(auth(ops)).send(body).expect(403);

    await request(app).patch(grantUrl).set(auth(owner)).set("X-Reauth", await reauthToken(app, owner)).send({ allowed: true }).expect(200);
    await request(app).post(url).set(auth(ops)).send(body).expect(200);
    assert.equal(await mongoose.model("Tenant").countDocuments({ _id: tenantId }), 0);
  });

  it("deletes stores in bulk with a typed count, a reason and the password", async () => {
    const a = await provisionTenant(app, "alpha");
    const b = await provisionTenant(app, "bravo");
    const c = await provisionTenant(app, "charlie");
    const owner = await platformUser(app, "owner");
    const admin = await platformUser(app, "admin");
    const url = "/api/platform/bulk/tenants/delete-permanently";
    const body = { tenantIds: [a, b], reason: "Test store cleanup", confirmation: "delete 2 stores", password: PLATFORM_PASSWORD };

    await request(app).post(url).set(auth(admin)).send(body).expect(403);
    const badPhrase = await request(app).post(url).set(auth(owner)).send({ ...body, confirmation: "delete 3 stores" });
    assert.equal(badPhrase.status, 400);
    const badPw = await request(app).post(url).set(auth(owner)).send({ ...body, password: "wrong-password-1" });
    assert.equal(badPw.body.code, "PASSWORD_INCORRECT");
    assert.equal(await mongoose.model("Tenant").countDocuments({}), 3);

    const res = await request(app).post(url).set(auth(owner)).send(body).expect(200);
    assert.deepEqual(res.body.data.summary, { total: 2, ok: 2, failed: 0 });
    const left = await mongoose.model("Tenant").find({}).select("_id").lean();
    assert.deepEqual(left.map((t) => String(t._id)), [c]);
    assert.equal(await mongoose.model("PlatformAuditLog").countDocuments({ action: "tenant.delete_permanently" }), 2);
    assert.equal(await mongoose.model("PlatformAuditLog").countDocuments({ action: "bulk.tenants" }), 1);
  });

  it("reports a missing store in a bulk run without stopping the others", async () => {
    const a = await provisionTenant(app, "delta");
    const owner = await platformUser(app, "owner");
    const ghost = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post("/api/platform/bulk/tenants/delete-permanently")
      .set(auth(owner))
      .send({ tenantIds: [ghost, a], reason: "Test store cleanup", confirmation: "delete 2 stores", password: PLATFORM_PASSWORD })
      .expect(200);
    assert.deepEqual(res.body.data.summary, { total: 2, ok: 1, failed: 1 });
    assert.equal(await mongoose.model("Tenant").countDocuments({ _id: a }), 0);
  });
});
