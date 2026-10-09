/**
 * Platform console store search (GET /api/platform/tenants?q=) — the endpoint
 * behind both the Tenants list search box and the quick navigator (Ctrl/Cmd+K).
 *
 * Pins: matches name / owner email / slug / subdomain host / custom domain,
 * honours `limit`, requires support.read, treats the query as a literal string
 * (regex metacharacters are escaped, never interpreted) and returns only the
 * list projection (no secrets such as payment keys or setup tokens).
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { generateHash } from "../../utils/misc.js";

const PLATFORM_PASSWORD = "PlatformPass2025!!";

async function provisionTenant(app, slug, storeName = `${slug} store`) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: `${slug} owner`, storeName, email: `owner@${slug}.test`, password: "Sup3rSecret!", subdomain: slug })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function platformUser(app, { role = null, scopes = [] } = {}) {
  const email = `op-${Math.random().toString(36).slice(2, 8)}@matjar.test`;
  await mongoose.model("TenantUser").create({
    tenantId: null,
    name: "Operator",
    email,
    platformAdmin: true,
    platformRole: role,
    platformScopes: scopes,
    platformPasswordHash: await generateHash(PLATFORM_PASSWORD),
  });
  const res = await request(app).post("/api/platform/login").send({ email, password: PLATFORM_PASSWORD }).expect(200);
  return { token: res.body.data.token };
}

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const search = (app, u, q, extra = {}) =>
  request(app).get("/api/platform/tenants").query({ q, ...extra }).set(auth(u));

describe("E2E platform store search", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  it("finds stores by name, owner email, subdomain and custom domain", async () => {
    const acme = await provisionTenant(app, "acmeshop", "Acme Goods");
    const other = await provisionTenant(app, "zebra", "Zebra Crafts");
    await mongoose.model("Tenant").updateOne(
      { _id: other },
      { $set: { "domains.customDomain.name": "zebra-crafts.example" } }
    );
    const owner = await platformUser(app, { role: "owner" });

    const byName = await search(app, owner, "acme goods").expect(200);
    assert.deepEqual(byName.body.data.tenants.map((t) => String(t._id)), [String(acme)]);

    const byEmail = await search(app, owner, "owner@zebra").expect(200);
    assert.deepEqual(byEmail.body.data.tenants.map((t) => String(t._id)), [String(other)]);

    const sub = await mongoose.model("Tenant").findById(acme).lean();
    const host = sub.domains?.subdomain?.fullDomain;
    assert.ok(host && host.includes("."), "signup sets the full subdomain host");
    const byHost = await search(app, owner, host).expect(200);
    assert.deepEqual(byHost.body.data.tenants.map((t) => String(t._id)), [String(acme)]);

    const byCustom = await search(app, owner, "zebra-crafts.example").expect(200);
    assert.deepEqual(byCustom.body.data.tenants.map((t) => String(t._id)), [String(other)]);
  });

  it("honours the result limit and never returns secrets", async () => {
    for (const s of ["lim-a", "lim-b", "lim-c"]) await provisionTenant(app, s);
    await mongoose.model("Tenant").updateMany(
      {},
      { $set: { "paymentProviders.stripe.secretKey": "sk_live_secret", "setupStatus.setupToken": "tok" } }
    );
    const owner = await platformUser(app, { role: "owner" });
    const res = await search(app, owner, "lim-", { limit: 2 }).expect(200);
    assert.equal(res.body.data.tenants.length, 2);
    assert.equal(res.body.data.pagination.total, 3);
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes("sk_live_secret"), "payment secrets must not be listed");
    assert.ok(!raw.includes("setupToken"), "setup token must not be listed");
    assert.equal(res.body.data.tenants[0].paymentProviders, undefined);
  });

  it("treats the query as literal text (regex metacharacters are escaped)", async () => {
    await provisionTenant(app, "plain", "Plain Store");
    await provisionTenant(app, "dotty", "Dots a.b Store");
    const owner = await platformUser(app, { role: "owner" });

    // `.*` would match everything if interpreted as a regex.
    const wildcard = await search(app, owner, ".*").expect(200);
    assert.equal(wildcard.body.data.tenants.length, 0);

    // A literal dot only matches a literal dot ("a.b"), not "axb"-style text.
    const dot = await search(app, owner, "a.b").expect(200);
    assert.deepEqual(dot.body.data.tenants.map((t) => t.name), ["Dots a.b Store"]);

    // Invalid-regex input must not error out.
    for (const q of ["(", "[a-", "\\", "a{2,1}", "$where"]) {
      const r = await search(app, owner, q).expect(200);
      assert.ok(Array.isArray(r.body.data.tenants));
    }

    // Over-long queries are capped rather than rejected.
    await search(app, owner, "x".repeat(5000)).expect(200);
  });

  it("requires support.read", async () => {
    await provisionTenant(app, "gated");
    const noScopes = await platformUser(app, { role: null, scopes: [] });
    const denied = await search(app, noScopes, "gated").expect(403);
    assert.deepEqual(denied.body.missing, ["support.read"]);

    const support = await platformUser(app, { role: "support" });
    const ok = await search(app, support, "gated").expect(200);
    assert.equal(ok.body.data.tenants.length, 1);

    await request(app).get("/api/platform/tenants").query({ q: "gated" }).expect(401);
  });

  it("rate-limits searches per operator but not plain paging", async () => {
    const owner = await platformUser(app, { role: "owner" });
    for (let i = 0; i < 120; i += 1) await search(app, owner, `q${i}`).expect(200);
    const limited = await search(app, owner, "one-more").expect(429);
    assert.equal(limited.body.success, false);
    // Listing without a query is not a search and stays available.
    await request(app).get("/api/platform/tenants").set(auth(owner)).expect(200);
    // Another operator has their own bucket.
    const other = await platformUser(app, { role: "support" });
    await search(app, other, "x").expect(200);
  });
});
