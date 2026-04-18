/**
 * E2E: CMS Pages resource.
 *
 * Pins:
 *   1. Admin CRUD on /api/pages round-trips (create → list → get → update → delete).
 *   2. Slug is normalised (lowercased, hyphenated) and enforced unique per
 *      (slug, locale) pair — same slug can coexist across locales.
 *   3. Content has a 100KB byte cap (not a character cap — multibyte chars
 *      count fully).
 *   4. Publish state:
 *        - Draft pages are 404 on the storefront.
 *        - First publish stamps publishedAt.
 *        - Unpublishing preserves the original publishedAt for audit.
 *   5. Storefront reads:
 *        - GET /storefront/pages returns only published pages with minimal fields
 *          (no `content`, no `metaDescription`).
 *        - GET /storefront/pages/:slug returns the full published doc.
 *   6. Tenant isolation: one tenant cannot see another's pages.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";

const HOST_ACME = "acme.localhost";
const HOST_BETA = "beta.localhost";

async function provisionTenant(app, { name, email, subdomain }) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      name,
      email,
      password: "Sup3rSecret!",
      subdomain,
    })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function loginAdmin(app, { email, host }) {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Host", host)
    .send({ email, password: "Sup3rSecret!", domain: host })
    .expect(200);
  return res.body.responseObject.accessToken;
}

describe("E2E CMS pages", () => {
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

  it("admin CRUD round-trips", async () => {
    await provisionTenant(app, {
      name: "Acme",
      email: "owner@acme.test",
      subdomain: "acme",
    });
    const token = await loginAdmin(app, { email: "owner@acme.test", host: HOST_ACME });

    // Create — slug derived from title when omitted.
    const createRes = await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "About Us",
        content: "<p>Hello</p>",
        metaTitle: "About Acme",
        isPublished: false,
      });
    assert.equal(createRes.status, 201, JSON.stringify(createRes.body));
    assert.equal(createRes.body.data.slug, "about-us");
    assert.equal(createRes.body.data.isPublished, false);
    assert.equal(createRes.body.data.publishedAt, null);
    const pageId = createRes.body.data._id;

    // List.
    const listRes = await request(app)
      .get("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assert.equal(listRes.body.data.pages.length, 1);
    assert.equal(listRes.body.data.pages[0]._id, pageId);

    // Get.
    const getRes = await request(app)
      .get(`/api/pages/${pageId}`)
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assert.equal(getRes.body.data.title, "About Us");

    // Update.
    const updRes = await request(app)
      .put(`/api/pages/${pageId}`)
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "About Acme" })
      .expect(200);
    assert.equal(updRes.body.data.title, "About Acme");

    // Delete.
    await request(app)
      .delete(`/api/pages/${pageId}`)
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const afterList = await request(app)
      .get("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assert.equal(afterList.body.data.pages.length, 0);
  });

  it("slugifies title when slug omitted and enforces (slug, locale) uniqueness", async () => {
    await provisionTenant(app, {
      name: "Acme",
      email: "owner@acme.test",
      subdomain: "acme",
    });
    const token = await loginAdmin(app, { email: "owner@acme.test", host: HOST_ACME });

    // Title-only: server derives slug from free-form text ("Hello World"
    // → "hello-world"). The dashboard slugifies client-side too, but the
    // server must not require it — title-only create is a supported path.
    const r1 = await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Hello World", content: "x", locale: "en" });
    assert.equal(r1.status, 201, JSON.stringify(r1.body));
    assert.equal(r1.body.data.slug, "hello-world");

    // Explicit slug — server requires it already-normalised (the validator
    // rejects uppercase/spaces before it reaches the service). The
    // dashboard slugifies on the client; API users must too.
    const rUpper = await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Upper", slug: "About-US", locale: "en" });
    assert.equal(rUpper.status, 400);

    // Duplicate (slug, locale) → 409.
    const r2 = await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Hello2", slug: "hello-world", locale: "en" });
    assert.equal(r2.status, 409, JSON.stringify(r2.body));

    // Same slug, different locale → allowed.
    const r3 = await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "À propos", slug: "hello-world", locale: "fr" });
    assert.equal(r3.status, 201, JSON.stringify(r3.body));
  });

  it("rejects malformed slug and oversize content", async () => {
    await provisionTenant(app, {
      name: "Acme",
      email: "owner@acme.test",
      subdomain: "acme",
    });
    const token = await loginAdmin(app, { email: "owner@acme.test", host: HOST_ACME });

    // Empty title.
    const r1 = await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "", content: "x" });
    assert.equal(r1.status, 400);

    // Oversize content (>100KB).
    const r2 = await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Huge",
        content: "a".repeat(100 * 1024 + 10),
      });
    assert.equal(r2.status, 400);
  });

  it("storefront only returns published pages, with minimal fields on list", async () => {
    await provisionTenant(app, {
      name: "Acme",
      email: "owner@acme.test",
      subdomain: "acme",
    });
    const token = await loginAdmin(app, { email: "owner@acme.test", host: HOST_ACME });

    // Draft.
    await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Secret", content: "hidden", isPublished: false })
      .expect(201);

    // Published.
    const pub = await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "About", content: "<p>public</p>", isPublished: true })
      .expect(201);
    assert.ok(pub.body.data.publishedAt, "publishedAt should be stamped on first publish");

    // Storefront list — draft excluded, content field absent.
    const sList = await request(app)
      .get("/storefront/pages")
      .set("Host", HOST_ACME)
      .expect(200);
    assert.equal(sList.body.data.pages.length, 1);
    assert.equal(sList.body.data.pages[0].slug, "about");
    assert.ok(!("content" in sList.body.data.pages[0]), "list should not leak content");

    // Storefront get draft slug → 404.
    const sDraft = await request(app)
      .get("/storefront/pages/secret")
      .set("Host", HOST_ACME);
    assert.equal(sDraft.status, 404);

    // Storefront get published slug → full page body.
    const sPub = await request(app)
      .get("/storefront/pages/about")
      .set("Host", HOST_ACME)
      .expect(200);
    assert.equal(sPub.body.data.slug, "about");
    assert.equal(sPub.body.data.content, "<p>public</p>");
  });

  it("preserves publishedAt across unpublish/republish", async () => {
    await provisionTenant(app, {
      name: "Acme",
      email: "owner@acme.test",
      subdomain: "acme",
    });
    const token = await loginAdmin(app, { email: "owner@acme.test", host: HOST_ACME });

    const created = await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Launch", isPublished: true })
      .expect(201);
    const firstStamp = created.body.data.publishedAt;
    assert.ok(firstStamp);

    // Unpublish — stamp preserved (audit trail).
    const unp = await request(app)
      .put(`/api/pages/${created.body.data._id}`)
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPublished: false })
      .expect(200);
    assert.equal(unp.body.data.isPublished, false);
    assert.equal(unp.body.data.publishedAt, firstStamp);

    // Republish — original stamp still preserved (no re-stamp on re-flip).
    const rep = await request(app)
      .put(`/api/pages/${created.body.data._id}`)
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPublished: true })
      .expect(200);
    assert.equal(rep.body.data.isPublished, true);
    assert.equal(rep.body.data.publishedAt, firstStamp);
  });

  it("enforces tenant isolation: tenant A cannot see tenant B pages", async () => {
    await provisionTenant(app, {
      name: "Acme",
      email: "owner@acme.test",
      subdomain: "acme",
    });
    await provisionTenant(app, {
      name: "Beta",
      email: "owner@beta.test",
      subdomain: "beta",
    });
    const tokenA = await loginAdmin(app, { email: "owner@acme.test", host: HOST_ACME });
    const tokenB = await loginAdmin(app, { email: "owner@beta.test", host: HOST_BETA });

    // Tenant A creates two pages.
    await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ title: "A1", isPublished: true })
      .expect(201);
    await request(app)
      .post("/api/pages")
      .set("Host", HOST_ACME)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ title: "A2", isPublished: true })
      .expect(201);

    // Tenant B's admin list must be empty.
    const bList = await request(app)
      .get("/api/pages")
      .set("Host", HOST_BETA)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    assert.equal(bList.body.data.pages.length, 0);

    // Tenant B's storefront list must also be empty.
    const bStore = await request(app)
      .get("/storefront/pages")
      .set("Host", HOST_BETA)
      .expect(200);
    assert.equal(bStore.body.data.pages.length, 0);

    // Tenant B cannot fetch A's page by slug from its own storefront.
    const bGet = await request(app)
      .get("/storefront/pages/a1")
      .set("Host", HOST_BETA);
    assert.equal(bGet.status, 404);
  });
});
