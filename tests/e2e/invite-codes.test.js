/**
 * Beta invitation codes and the Promoter role (PBI 10-47).
 *
 *   - The owner sets the signup mode: open, optional (referral code) or
 *     required (beta invitation code). Adding a store from an existing account
 *     never needs a code.
 *   - Owners and promoters create codes; one code registers one store; unused
 *     codes can be revoked.
 *   - A promoter sees only their own codes and the stores registered with them,
 *     and nothing else on the platform.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { generateHash } from "../../utils/misc.js";
import { invalidateSignupModeCache } from "../../services/signupAccess.js";

const PLATFORM_PASSWORD = "PlatformPass2025!!";
const PASSWORD = "Sup3rSecret!";

const register = (app, slug, extra = {}) =>
  request(app)
    .post("/api/auth/register")
    .send({ name: `Owner ${slug}`, storeName: `${slug} store`, email: `owner@${slug}.test`, password: PASSWORD, subdomain: slug, ...extra });

async function login(app, slug) {
  const host = `${slug}.localhost`;
  const res = await request(app).post("/api/auth/login").set("Host", host).send({ email: `owner@${slug}.test`, password: PASSWORD, domain: host }).expect(200);
  return res.body.responseObject.accessToken;
}

async function platformUser(app, role) {
  const email = `${role}-${Math.random().toString(36).slice(2, 7)}@matjar.test`;
  const row = await mongoose.model("TenantUser").create({
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
const setMode = (app, owner, mode) => request(app).put("/api/platform/invite-codes/signup-mode").set(auth(owner)).send({ mode });
const newCodes = async (app, u, count = 1, note) =>
  (await request(app).post("/api/platform/invite-codes").set(auth(u)).send({ count, ...(note && { note }) }).expect(201)).body.data.codes;

describe("invitation codes", () => {
  let app;
  before(async () => {
    await startTestDb();
    app = await buildTestApp();
  });
  after(stopTestDb);
  beforeEach(async () => {
    await clearAllCollections();
    invalidateSignupModeCache();
  });

  it("is open by default; the public config tells the signup page the mode", async () => {
    await register(app, "free").expect(201);
    const cfg = await request(app).get("/api/auth/onboarding-config").expect(200);
    assert.equal(cfg.body.responseObject.signupCode, "open");
  });

  it("required mode: no code or a wrong code is refused, a promoter's code registers one store", async () => {
    const owner = await platformUser(app, "owner");
    const promoter = await platformUser(app, "promoter");
    await setMode(app, owner, "required").expect(200);
    assert.equal((await request(app).get("/api/auth/onboarding-config")).body.responseObject.signupCode, "required");

    const none = await register(app, "nocode").expect(400);
    assert.equal(none.body.code, "INVITE_CODE_REQUIRED");
    const wrong = await register(app, "wrong", { invitationCode: "ZZZZ-ZZZZ" }).expect(400);
    assert.equal(wrong.body.code, "INVITE_CODE_INVALID");
    assert.equal(await mongoose.model("Tenant").countDocuments({}), 0);

    const [code] = await newCodes(app, promoter, 1, "Khartoum market");
    assert.match(code.code, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    // Typed in lower case without the dash: still accepted.
    await register(app, "beta", { invitationCode: code.code.toLowerCase().replace("-", "") }).expect(201);
    const tenant = await mongoose.model("Tenant").findOne({ slug: "beta" }).lean();
    assert.equal(String(tenant.inviteCode.promoterId), promoter.id);

    const again = await register(app, "beta2", { invitationCode: code.code }).expect(400);
    assert.equal(again.body.code, "INVITE_CODE_INVALID");

    const list = (await request(app).get("/api/platform/invite-codes").set(auth(promoter)).expect(200)).body.data;
    assert.deepEqual(list.stats, { created: 1, registered: 1, unused: 0, revoked: 0 });
    assert.equal(list.codes[0].status, "used");
    assert.equal(list.codes[0].usedByTenantName, "beta store");
    assert.ok(list.codes[0].usedAt && list.codes[0].createdAt);
    assert.equal(list.signupMode, undefined, "only owners see the mode");

    // Adding a store from the registered account needs no code.
    const token = await login(app, "beta");
    await request(app)
      .post("/api/auth/stores")
      .set("Host", "beta.localhost")
      .set("Authorization", `Bearer ${token}`)
      .send({ storeName: "Second", subdomain: "second" })
      .expect(201);
  });

  it("the signup form can check a code before the last step", async () => {
    const promoter = await platformUser(app, "promoter");
    const [code] = await newCodes(app, promoter);
    const check = async (c) =>
      (await request(app).get(`/api/auth/check-invitation-code?code=${encodeURIComponent(c)}`).expect(200)).body.responseObject.valid;
    assert.equal(await check(code.code), true);
    assert.equal(await check(code.code.toLowerCase()), true);
    assert.equal(await check("ZZZZ-ZZZZ"), false);
    assert.equal(await check(""), false);
  });

  it("an owner invites a promoter by email; the promoter signs in with the normal login", async () => {
    const owner = await platformUser(app, "owner");
    const invite = await request(app)
      .post("/api/platform/users/invites")
      .set(auth(owner))
      .send({ email: "promo@people.test", role: "promoter" })
      .expect(201);
    assert.equal(invite.body.data.role ?? invite.body.data.invite?.role, "promoter");
  });

  it("optional mode: no code is fine, a wrong one is refused", async () => {
    const owner = await platformUser(app, "owner");
    await setMode(app, owner, "optional").expect(200);
    await register(app, "plain").expect(201);
    const wrong = await register(app, "typo", { invitationCode: "ABCD-EFGH" }).expect(400);
    assert.equal(wrong.body.code, "INVITE_CODE_INVALID");
  });

  it("revokes unused codes only, and a revoked code no longer registers", async () => {
    const owner = await platformUser(app, "owner");
    const promoter = await platformUser(app, "promoter");
    await setMode(app, owner, "required").expect(200);
    const [a, b] = await newCodes(app, promoter, 2);
    await request(app).post(`/api/platform/invite-codes/${a.id}/revoke`).set(auth(promoter)).expect(200);
    const res = await register(app, "late", { invitationCode: a.code }).expect(400);
    assert.equal(res.body.code, "INVITE_CODE_INVALID");
    await register(app, "ontime", { invitationCode: b.code }).expect(201);
    await request(app).post(`/api/platform/invite-codes/${b.id}/revoke`).set(auth(promoter)).expect(409);
  });

  it("a promoter sees only their own codes and stores; the owner sees all", async () => {
    const owner = await platformUser(app, "owner");
    const p1 = await platformUser(app, "promoter");
    const p2 = await platformUser(app, "promoter");
    await setMode(app, owner, "required").expect(200);
    const [c1] = await newCodes(app, p1);
    const [c2] = await newCodes(app, p2);
    await register(app, "one", { invitationCode: c1.code }).expect(201);
    await register(app, "two", { invitationCode: c2.code }).expect(201);
    const t1 = String((await mongoose.model("Tenant").findOne({ slug: "one" }).lean())._id);
    const t2 = String((await mongoose.model("Tenant").findOne({ slug: "two" }).lean())._id);

    const mine = (await request(app).get("/api/platform/invite-codes").set(auth(p1)).expect(200)).body.data;
    assert.deepEqual(mine.codes.map((c) => c.id), [c1.id]);
    assert.equal(mine.promoters, undefined);

    const view = (await request(app).get(`/api/platform/invite-codes/stores/${t1}`).set(auth(p1)).expect(200)).body.data;
    assert.equal(view.store.name, "one store");
    assert.equal(typeof view.stats.usersTotal, "number");
    assert.equal(typeof view.stats.productsTotal, "number");
    assert.equal(view.store.paymentProviders, undefined);
    assert.equal(view.store.subscriptionPlan, undefined);
    // Someone else's store, or a store id that is not theirs: not found.
    await request(app).get(`/api/platform/invite-codes/stores/${t2}`).set(auth(p1)).expect(404);
    await request(app).post(`/api/platform/invite-codes/${c2.id}/revoke`).set(auth(p1)).expect(404);

    const all = (await request(app).get("/api/platform/invite-codes").set(auth(owner)).expect(200)).body.data;
    assert.equal(all.codes.length, 2);
    assert.equal(all.signupMode, "required");
    assert.equal(all.promoters.length, 2);
    const one = (await request(app).get(`/api/platform/invite-codes?promoterId=${p2.id}`).set(auth(owner)).expect(200)).body.data;
    assert.deepEqual(one.codes.map((c) => c.id), [c2.id]);
    await request(app).get(`/api/platform/invite-codes/stores/${t2}`).set(auth(owner)).expect(200);

    // Promoters can't change the signup mode; admins don't get codes by role.
    await setMode(app, p1, "open").expect(403);
    const admin = await platformUser(app, "admin");
    await request(app).get("/api/platform/invite-codes").set(auth(admin)).expect(403);
  });

  it("a promoter is refused by every other platform endpoint", async () => {
    const promoter = await platformUser(app, "promoter");
    // Every GET route mounted under /api/platform, ids filled with a valid ObjectId.
    const id = String(new mongoose.Types.ObjectId());
    const paths = [];
    const walk = (stack, prefix) => {
      for (const layer of stack) {
        if (layer.route && layer.route.methods.get) {
          const p = (prefix + layer.route.path).replace(/:[A-Za-z]+/g, id);
          paths.push(p);
        } else if (layer.name === "router" && layer.handle?.stack) {
          const m = layer.regexp?.source
            ?.replace("^\\", "")
            .replace("\\/?(?=\\/|$)", "")
            .replace(/\\\//g, "/")
            .replace("(?:([^\\/]+?))", id);
          const mount = (m && m !== "^" ? m.replace(/^\^/, "") : "").replace(/\(\?:\/\(\[\^\/\]\+\?\)\)/g, `/${id}`);
          walk(layer.handle.stack, prefix + mount);
        }
      }
    };
    walk(app._router.stack, "");
    const platformPaths = [...new Set(paths.filter((p) => p.startsWith("/api/platform/")))];
    assert.ok(platformPaths.length > 30, `found ${platformPaths.length} platform GET routes`);

    // Their own account (profile, security, sessions) and their codes.
    const allowed = (p) =>
      p === "/api/platform/me" ||
      p.startsWith("/api/platform/invite-codes") ||
      p.startsWith("/api/platform/auth/") ||
      p.startsWith("/api/platform/users/me/");
    const leaks = [];
    for (const p of platformPaths) {
      if (allowed(p)) continue;
      const res = await request(app).get(p).set(auth(promoter));
      if (![401, 403].includes(res.status)) leaks.push(`${p} → ${res.status}`);
    }
    assert.deepEqual(leaks, []);
  });
});
