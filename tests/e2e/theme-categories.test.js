/**
 * Platform-managed theme categories (task 10-34): the platform console
 * creates / renames / reorders / hides / deletes categories and assigns
 * themes to them; signup (GET /api/themes/categories) and the merchant theme
 * library (GET /api/themes/active) read the same list.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { generateHash } from "../../utils/misc.js";
import { reloadAllManifests } from "../../services/themeManifestRegistry.js";
import { syncThemeCatalog } from "../../services/themeCatalogSync.js";
import { THEME_CATEGORIES } from "../../config/themeCategories.js";
import { STORE_NICHES } from "../../config/storeNiches.js";
import { resolveStoreNicheKey } from "../../services/themeCategories.js";
import * as migration017 from "../../migrations/017_seed_theme_categories.js";

const BASE = "/api/platform/storefront";

async function platformToken(app, role) {
  const TenantUser = mongoose.model("TenantUser");
  const email = `${role}@matjar.test`;
  await TenantUser.create({ tenantId: new mongoose.Types.ObjectId(), name: role, email, platformAdmin: true, platformRole: role, platformPasswordHash: await generateHash("PlatformPass2025!!") });
  const res = await request(app).post("/api/platform/login").send({ email, password: "PlatformPass2025!!" }).expect(200);
  return res.body.data.token;
}

describe("E2E theme categories", () => {
  let app;
  let owner;
  let support;
  const as = (token) => (req) => req.set("Authorization", `Bearer ${token}`);

  before(async () => { await startTestDb(); app = buildTestApp(); reloadAllManifests(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => {
    await clearAllCollections();
    await syncThemeCatalog();
    owner = await platformToken(app, "owner");
    support = await platformToken(app, "support");
  });

  it("public endpoint: seeded defaults in order with en/ar names, no auth needed", async () => {
    const res = await request(app).get("/api/themes/categories").expect(200);
    const { categories, themes } = res.body.data;
    assert.deepEqual(categories.map((c) => c.key), THEME_CATEGORIES.map((c) => c.key));
    for (const niche of STORE_NICHES) assert.ok(categories.some((c) => c.key === niche), `signup niche ${niche} offered`);
    const fashion = categories.find((c) => c.key === "fashion");
    assert.equal(fashion.name.en, "Fashion & apparel");
    assert.equal(fashion.name.ar, "أزياء وملابس");
    assert.ok(Array.isArray(themes) && themes.length > 0);
    const starter = themes.find((t) => t.slug === "starter");
    assert.deepEqual(starter.categoryKeys, ["general"]);
  });

  it("reads need support.read, writes need flags.write", async () => {
    await request(app).get(`${BASE}/theme-categories`).expect(401);
    const list = await as(support)(request(app).get(`${BASE}/theme-categories`)).expect(200);
    assert.equal(list.body.data.categories.length, THEME_CATEGORIES.length);
    assert.equal(list.body.data.categories.find((c) => c.key === "general").protected, true);

    await as(support)(request(app).post(`${BASE}/theme-categories`)).send({ key: "pets", name: { en: "Pets", ar: "حيوانات أليفة" } }).expect(403);
    await as(support)(request(app).patch(`${BASE}/theme-categories/fashion`)).send({ active: false }).expect(403);
    await as(support)(request(app).put(`${BASE}/theme-categories/order`)).send({ keys: ["general"] }).expect(403);
    await as(support)(request(app).delete(`${BASE}/theme-categories/fashion`)).expect(403);
    const Theme = mongoose.model("Theme");
    const starter = await Theme.findOne({ slug: "starter" }).lean();
    await as(support)(request(app).put(`${BASE}/themes/${starter._id}/categories`)).send({ categoryKeys: ["fashion"] }).expect(403);
    assert.equal(await mongoose.model("PlatformAuditLog").countDocuments({ action: /^theme_category\.|^theme\.categories/ }), 0);
  });

  it("validates input", async () => {
    const post = (body) => as(owner)(request(app).post(`${BASE}/theme-categories`)).send(body);
    await post({ key: "Bad Key!", name: { en: "X", ar: "س" } }).expect(400);
    await post({ key: "pets", name: { en: "Pets" } }).expect(400); // Arabic name required
    await post({ key: "pets", name: { en: "", ar: "حيوانات" } }).expect(400);
    await post({ key: "pets", name: { en: "Pets", ar: "حيوانات" }, extra: 1 }).expect(400);
    await post({ key: "-pets", name: { en: "Pets", ar: "حيوانات" } }).expect(400);
    await post({ key: "fashion", name: { en: "Dup", ar: "مكرر" } }).expect(409);
    await as(owner)(request(app).patch(`${BASE}/theme-categories/fashion`)).send({}).expect(400);
    await as(owner)(request(app).patch(`${BASE}/theme-categories/nope`)).send({ active: false }).expect(404);
    await as(owner)(request(app).put(`${BASE}/theme-categories/order`)).send({ keys: ["general", "fashion"] }).expect(400);
  });

  it("create, rename, hide, reorder and delete — every write audited", async () => {
    const created = await as(owner)(request(app).post(`${BASE}/theme-categories`))
      .send({ key: "pets", name: { en: "Pet supplies", ar: "مستلزمات الحيوانات" }, aliases: ["pets", "animals"], reason: "new vertical" })
      .expect(201);
    assert.equal(created.body.data.key, "pets");
    assert.equal(created.body.data.order, THEME_CATEGORIES.length); // appended last

    let pub = (await request(app).get("/api/themes/categories").expect(200)).body.data.categories;
    assert.equal(pub.at(-1).key, "pets");
    assert.equal(pub.at(-1).themeCount, 0);

    await as(owner)(request(app).patch(`${BASE}/theme-categories/pets`)).send({ name: { ar: "الحيوانات الأليفة" } }).expect(200);
    const renamed = (await request(app).get("/api/themes/categories")).body.data.categories.find((c) => c.key === "pets");
    assert.deepEqual(renamed.name, { en: "Pet supplies", ar: "الحيوانات الأليفة" });

    // Hidden categories disappear from signup; "general" can't be hidden.
    await as(owner)(request(app).patch(`${BASE}/theme-categories/books`)).send({ active: false }).expect(200);
    await as(owner)(request(app).patch(`${BASE}/theme-categories/general`)).send({ active: false }).expect(409);
    pub = (await request(app).get("/api/themes/categories")).body.data.categories;
    assert.ok(!pub.some((c) => c.key === "books"));
    assert.ok(pub.some((c) => c.key === "general"));

    // Reorder: pets first.
    const all = (await as(owner)(request(app).get(`${BASE}/theme-categories`))).body.data.categories.map((c) => c.key);
    const next = ["pets", ...all.filter((k) => k !== "pets")];
    const reordered = await as(owner)(request(app).put(`${BASE}/theme-categories/order`)).send({ keys: next }).expect(200);
    assert.deepEqual(reordered.body.data.categories.map((c) => c.key), next);
    pub = (await request(app).get("/api/themes/categories")).body.data.categories;
    assert.equal(pub[0].key, "pets");

    await as(owner)(request(app).delete(`${BASE}/theme-categories/general`)).expect(409);
    await as(owner)(request(app).delete(`${BASE}/theme-categories/pets`)).send({ reason: "not needed" }).expect(200);
    pub = (await request(app).get("/api/themes/categories")).body.data.categories;
    assert.ok(!pub.some((c) => c.key === "pets"));

    const audit = await mongoose.model("PlatformAuditLog").find({ action: /^theme_category\./ }).sort({ createdAt: 1 }).lean();
    assert.deepEqual(audit.map((a) => a.action), [
      "theme_category.create",
      "theme_category.update",
      "theme_category.update",
      "theme_category.reorder",
      "theme_category.delete",
    ]);
    assert.equal(audit[0].reason, "new vertical");
    assert.equal(audit[0].resourceId, "pets");
    assert.equal(audit[2].before.active, true);
    assert.equal(audit[2].after.active, false);
  });

  it("assigns a theme to categories; the theme library and signup follow", async () => {
    const Theme = mongoose.model("Theme");
    const starter = await Theme.findOne({ slug: "starter" }).lean();
    await as(owner)(request(app).post(`${BASE}/theme-categories`)).send({ key: "pets", name: { en: "Pets", ar: "حيوانات أليفة" } }).expect(201);

    await as(owner)(request(app).put(`${BASE}/themes/${starter._id}/categories`)).send({ categoryKeys: ["nope"] }).expect(400);
    await as(owner)(request(app).put(`${BASE}/themes/${starter._id}/categories`)).send({}).expect(400);
    await as(owner)(request(app).put(`${BASE}/themes/${new mongoose.Types.ObjectId()}/categories`)).send({ categoryKeys: [] }).expect(404);

    const set = await as(owner)(request(app).put(`${BASE}/themes/${starter._id}/categories`))
      .send({ categoryKeys: ["pets", "fashion", "pets"], reason: "pet shops" })
      .expect(200);
    assert.deepEqual(set.body.data.categoryKeys, ["fashion", "pets"]); // category order, deduplicated
    assert.equal(set.body.data.categoryKeysManaged, true);

    const lib = (await request(app).get("/api/themes/active").expect(200)).body.data;
    assert.deepEqual(lib.themes.find((t) => t.slug === "starter").categoryKeys, ["fashion", "pets"]);
    const petsChip = lib.categories.find((c) => c.key === "pets");
    assert.equal(petsChip.count, 1);
    assert.equal(petsChip.labelAr, "حيوانات أليفة");

    const signup = (await request(app).get("/api/themes/categories")).body.data;
    assert.deepEqual(signup.themes.find((t) => t.slug === "starter").categoryKeys, ["fashion", "pets"]);
    assert.equal(signup.categories.find((c) => c.key === "pets").themeCount, 1);

    // Console list shows the assignment.
    const consoleRows = (await as(owner)(request(app).get(`${BASE}/themes`))).body;
    assert.deepEqual(consoleRows.data.find((t) => t.slug === "starter").categoryKeys, ["fashion", "pets"]);
    assert.ok(consoleRows.meta.categoryOptions.some((c) => c.key === "pets" && c.labelAr === "حيوانات أليفة"));

    // A hidden category drops out of the merchant view but keeps the assignment.
    await as(owner)(request(app).patch(`${BASE}/theme-categories/pets`)).send({ active: false }).expect(200);
    const hidden = (await request(app).get("/api/themes/active")).body.data;
    assert.deepEqual(hidden.themes.find((t) => t.slug === "starter").categoryKeys, ["fashion"]);

    // Deleting a category removes it from explicit assignments.
    const del = await as(owner)(request(app).delete(`${BASE}/theme-categories/pets`)).expect(200);
    assert.equal(del.body.data.themesUpdated, 1);
    assert.deepEqual((await Theme.findById(starter._id).lean()).categoryKeys, ["fashion"]);

    // null → automatic again (derived from the manifest).
    const auto = await as(owner)(request(app).put(`${BASE}/themes/${starter._id}/categories`)).send({ categoryKeys: null }).expect(200);
    assert.equal(auto.body.data.categoryKeysManaged, false);
    assert.deepEqual(auto.body.data.categoryKeys, ["general"]);

    const audit = await mongoose.model("PlatformAuditLog").find({ action: "theme.categories.update" }).sort({ createdAt: 1 }).lean();
    assert.equal(audit.length, 2);
    assert.equal(audit[0].reason, "pet shops");
    assert.deepEqual(audit[0].before, { categoryKeys: ["general"], managed: false });
    assert.deepEqual(audit[0].after, { categoryKeys: ["fashion", "pets"], managed: true });
  });

  it("derives manifest categories through aliases (beauty, jewelry, health themes reach signup)", async () => {
    const signup = (await request(app).get("/api/themes/categories")).body.data;
    const count = (k) => signup.categories.find((c) => c.key === k)?.themeCount ?? 0;
    // Every theme lands in at least one category.
    for (const t of signup.themes) assert.ok(t.categoryKeys.length > 0, t.slug);
    assert.equal(count("general") >= 1, true);
    const Theme = mongoose.model("Theme");
    const nutreko = await Theme.findOne({ slug: "nutreko" }).lean();
    if (nutreko) {
      const consoleRows = (await as(owner)(request(app).get(`${BASE}/themes`))).body.data;
      assert.deepEqual(consoleRows.find((t) => t.slug === "nutreko").categoryKeys, ["health"]);
    }
  });

  it("a store's niche accepts any active category key and the old niche ids", async () => {
    await as(owner)(request(app).post(`${BASE}/theme-categories`)).send({ key: "pets", name: { en: "Pets", ar: "حيوانات أليفة" } }).expect(201);
    assert.equal(await resolveStoreNicheKey("pets"), "pets");
    assert.equal(await resolveStoreNicheKey(" Beauty "), "beauty");
    assert.equal(await resolveStoreNicheKey("toys"), "toys");
    assert.equal(await resolveStoreNicheKey("made-up"), null);
    assert.equal(await resolveStoreNicheKey(42), null);
    await as(owner)(request(app).patch(`${BASE}/theme-categories/pets`)).send({ active: false }).expect(200);
    assert.equal(await resolveStoreNicheKey("pets"), null);
    // Old niche ids stay valid even when hidden (presets are keyed by them).
    await as(owner)(request(app).patch(`${BASE}/theme-categories/books`)).send({ active: false }).expect(200);
    assert.equal(await resolveStoreNicheKey("books"), "books");
  });

  it("migration 017 seeds categories and records current assignments, idempotently", async () => {
    const db = mongoose.connection.db;
    await db.collection("themecategories").deleteMany({});
    await db.collection("themes").updateMany({}, { $unset: { categoryKeys: "" } });
    await db.collection("themes").updateOne({ slug: "starter" }, { $set: { categoryKeys: ["fashion"] } });

    await migration017.up(db, {});
    const cats = await db.collection("themecategories").find({}).sort({ order: 1 }).toArray();
    assert.deepEqual(cats.map((c) => c.key), THEME_CATEGORIES.map((c) => c.key));
    const themes = await db.collection("themes").find({}).toArray();
    for (const t of themes) assert.ok(Array.isArray(t.categoryKeys), `${t.slug} assigned`);
    assert.deepEqual(themes.find((t) => t.slug === "starter").categoryKeys, ["fashion"]); // untouched
    const nutreko = themes.find((t) => t.slug === "nutreko");
    if (nutreko) assert.deepEqual(nutreko.categoryKeys, ["health"]);

    // Owner edit survives a re-run; nothing duplicated.
    await db.collection("themecategories").updateOne({ key: "fashion" }, { $set: { "name.en": "Clothing" } });
    await migration017.up(db, {});
    assert.equal(await db.collection("themecategories").countDocuments(), THEME_CATEGORIES.length);
    assert.equal((await db.collection("themecategories").findOne({ key: "fashion" })).name.en, "Clothing");

    await migration017.down(db, {});
    assert.equal(await db.collection("themes").countDocuments({ categoryKeys: { $exists: true } }), 0);
    // The app re-seeds the defaults on first read.
    const pub = (await request(app).get("/api/themes/categories").expect(200)).body.data.categories;
    assert.equal(pub.length, THEME_CATEGORIES.length);
  });
});
