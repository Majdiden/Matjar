/**
 * E2E: brand-kit bindings in the theme engine (PBI 10, tasks 10-6, 10-7,
 * 10-8 and 10-15), through the real routes and services.
 *
 *   1. GET /api/theme-customization reports, per setting, whether the value
 *      is the merchant's own ("override"), the brand kit's ("brand") or the
 *      theme's ("default") — all "default" for a store with no brand kit —
 *      and never writes brand values into the stored settings.
 *   2. A new store starts from its theme's niche preset (flag on), and from
 *      `templates.index` when the flag is off or the niche has no preset.
 *   3. Switching theme keeps the brand kit; each theme keeps its own
 *      customization (restored on switching back, never cross-applied).
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { installDefaultTheme, selectIndexTemplate } from "../../services/theme.js";
import { getThemeManifest } from "../../services/themeManifestRegistry.js";
import { setFeatureOverrides, invalidateFeatureFlagCache } from "../../services/featureFlags.js";

const PASSWORD = "Sup3rSecret!";
const SLUG = "nile";
const HOST = `${SLUG}.localhost`;

async function provisionTenant(app, extra = {}) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Nile Store", email: `owner@${SLUG}.test`, password: PASSWORD, subdomain: SLUG, ...extra })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function login(app) {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Host", HOST)
    .send({ email: `owner@${SLUG}.test`, password: PASSWORD, domain: HOST })
    .expect(200);
  return res.body.responseObject.accessToken;
}

const api = (app, token) => ({
  get: (url) => request(app).get(url).set("Host", HOST).set("Authorization", `Bearer ${token}`),
  put: (url, body) => request(app).put(url).set("Host", HOST).set("Authorization", `Bearer ${token}`).send(body),
  patch: (url, body) => request(app).patch(url).set("Host", HOST).set("Authorization", `Bearer ${token}`).send(body),
  post: (url, body) => request(app).post(url).set("Host", HOST).set("Authorization", `Bearer ${token}`).send(body || {}),
});

async function getCustomization(client) {
  const res = await client.get("/api/theme-customization").expect(200);
  return res.body.data.customization;
}

const hero = (c) => c.sectionsByTemplate.index.find((s) => s.id === "hero");

function seedTheme(slug) {
  return mongoose.model("Theme").create({
    name: slug[0].toUpperCase() + slug.slice(1),
    slug,
    version: "1.0.0",
    description: `${slug} theme`,
    status: "active",
    isPublished: true,
    storagePath: `/tmp/test-themes/${slug}`,
  });
}

const BRAND = {
  storeName: "متجر النيل",
  brand: {
    tagline: { ar: "عطور أصلية", en: "Genuine perfumes" },
    coverImage: "https://cdn.example.com/cover.jpg",
    color: "#aa33cc",
  },
};

describe("E2E theme engine: brand bindings, presets, theme switch", () => {
  let app;

  before(async () => {
    await startTestDb();
    app = buildTestApp();
    assert.ok(getThemeManifest("modern") && getThemeManifest("starter"), "build modern + starter first");
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearAllCollections();
    invalidateFeatureFlagCache();
  });

  it("reports override / brand / default per setting and keeps stored settings raw", async () => {
    await provisionTenant(app);
    const client = api(app, await login(app));

    // 1. No brand kit: everything is the theme's own; nothing is filled.
    const c0 = await getCustomization(client);
    assert.equal(c0.themeSlug, "modern");
    for (const list of Object.values(c0.sectionsByTemplate)) {
      for (const s of list) {
        assert.ok(s.settingSources, `${s.id} carries settingSources`);
        assert.ok(Object.values(s.settingSources).every((v) => v === "default"), `${s.id}: ${JSON.stringify(s.settingSources)}`);
        assert.deepEqual(s.brandValues, {});
      }
    }
    assert.ok(Object.values(c0.settingSources.theme).every((v) => v === "default"));
    assert.ok(Object.values(c0.settingSources.colors).every((v) => v === "default"));
    assert.deepEqual(c0.brandValues, { theme: {}, colors: {} });
    assert.equal(c0.savedByTheme, undefined);
    const sf0 = await request(app).get("/storefront/store-info").set("Host", HOST).expect(200);
    assert.equal(sf0.body.data.store.brand, null);

    // 2. Brand kit set: bound settings the merchant never touched take it.
    await client.put("/api/store-profile", BRAND).expect(200);
    const c1 = await getCustomization(client);
    const h1 = hero(c1);
    assert.equal(h1.settingSources.subheading, "brand");
    assert.equal(h1.settingSources.background_image, "brand");
    assert.equal(h1.settingSources.heading, "default", "the heading is not bound");
    assert.deepEqual(h1.brandValues, {
      subheading: "Genuine perfumes",
      subheading__ar: "عطور أصلية",
      background_image: "https://cdn.example.com/cover.jpg",
    });
    assert.equal(h1.settings.subheading, "", "stored values stay the theme's own");
    assert.equal(c1.settingSources.colors.primary, "brand");
    assert.deepEqual(c1.brandValues.colors, { primary: "#aa33cc" });
    assert.notEqual(c1.settings.colors.primary, "#aa33cc", "the brand colour is not written into the draft");

    // Sending the GET payload straight back stores no annotations.
    await client.put("/api/theme-customization/sections", { sections: c1.sectionsByTemplate.index }).expect(200);
    const storedIndex = (await mongoose.model("Tenant").findOne({ slug: SLUG }).lean()).themeCustomization
      .sectionsByTemplate.index;
    assert.ok(storedIndex.every((s) => !("settingSources" in s) && !("brandValues" in s)));
    assert.equal(storedIndex.find((s) => s.id === "hero").settings.subheading, "");

    // 3. The merchant's own value wins over the brand kit.
    await client
      .patch("/api/theme-customization/sections/hero/settings", { settings: { ...h1.settings, subheading: "My own words" } })
      .expect(200);
    await client.put("/api/theme-customization/settings", { settings: { colors: { primary: "#123456" } } }).expect(200);
    const c2 = await getCustomization(client);
    const h2 = hero(c2);
    assert.equal(h2.settingSources.subheading, "override");
    assert.equal(h2.settingSources.background_image, "brand");
    assert.deepEqual(h2.brandValues, { background_image: "https://cdn.example.com/cover.jpg" });
    assert.equal(c2.settingSources.colors.primary, "override");
    assert.deepEqual(c2.brandValues.colors, {});
  });

  it("starts a new store from the theme homepage; a niche preset is used only with the flag on", async () => {
    // Every theme's homepage is now the same short list (hero, new arrivals,
    // featured), so no theme ships a niche preset; the preset path is
    // checked on a manifest that has one.
    const sample = {
      templates: { index: [{ id: "hero" }, { id: "new-arrivals" }, { id: "featured-products" }] },
      presets: { food: { index: [{ id: "featured-products" }, { id: "hero" }, { id: "new-arrivals" }] } },
    };
    assert.deepEqual(selectIndexTemplate(sample, "food").map((s) => s.id), ["featured-products", "hero", "new-arrivals"]);
    assert.deepEqual(selectIndexTemplate(sample, "books").map((s) => s.id), ["hero", "new-arrivals", "featured-products"]);
    assert.deepEqual(selectIndexTemplate(sample, "pets").map((s) => s.id), ["hero", "new-arrivals", "featured-products"]);

    const theme = await seedTheme("modern");
    const defaultOrder = getThemeManifest("modern").templates.index.map((s) => s.id);
    assert.deepEqual(defaultOrder, ["hero", "new-arrivals", "featured-products"]);
    const Tenant = mongoose.model("Tenant");

    for (const flag of [false, true]) {
      await clearAllCollections();
      await theme.constructor.create(theme.toObject());
      if (flag) await setFeatureOverrides({ "design.simpleMode": true }, null);
      const id = await provisionTenant(app, { niche: "food", themeSlug: "modern" });
      const tenant = await Tenant.findById(id);
      assert.equal(tenant.settings.niche, "food", "the signup niche is recorded");
      assert.equal((await installDefaultTheme(tenant)).success, true);
      const tc = (await Tenant.findById(id).lean()).themeCustomization;
      assert.deepEqual(tc.published.sectionsByTemplate.index.map((s) => s.id), defaultOrder);
      assert.deepEqual(tc.sectionsByTemplate.index.map((s) => s.id), defaultOrder);
    }
  });

  it("switching theme keeps the brand kit and each theme's own customization", async () => {
    const modern = await seedTheme("modern");
    const starter = await seedTheme("starter");
    await provisionTenant(app, { themeSlug: "modern" });
    const client = api(app, await login(app));
    await client.put("/api/store-profile", BRAND).expect(200);

    // Customize modern: own subheading + primary colour + custom CSS, published.
    const m0 = await getCustomization(client);
    await client
      .patch("/api/theme-customization/sections/hero/settings", { settings: { ...hero(m0).settings, subheading: "Modern words" } })
      .expect(200);
    await client.put("/api/theme-customization/settings", { settings: { colors: { primary: "#123456" } } }).expect(200);
    await client.put("/api/theme-customization/custom-css", { css: ".x { color: red; }" }).expect(200);
    await client.post("/api/theme-customization/publish").expect(200);

    // → starter: brand kit still applies, nothing from modern leaks in.
    await client.post(`/api/themes/${starter._id}/install`).expect(200);
    const s1 = await getCustomization(client);
    assert.equal(s1.themeSlug, "starter");
    assert.equal(hero(s1).settingSources.subheading, "brand", "brand kit follows the store");
    assert.equal(hero(s1).brandValues.subheading__ar, "عطور أصلية");
    assert.notEqual(hero(s1).settings.subheading, "Modern words");
    assert.notEqual(s1.settings.colors.primary, "#123456");
    assert.equal(s1.customCSS, "");
    assert.equal(s1.settingSources.colors.primary, "brand");
    const profile = await client.get("/api/store-profile").expect(200);
    assert.deepEqual(profile.body.data.brand.tagline, BRAND.brand.tagline);
    const sf = await request(app).get("/storefront/store-info").set("Host", HOST).expect(200);
    assert.equal(sf.body.data.store.theme, "starter");
    assert.equal(sf.body.data.store.brand.color, "#aa33cc");

    // Customize starter, then go back to modern: modern comes back as left.
    await client
      .patch("/api/theme-customization/sections/hero/settings", { settings: { ...hero(s1).settings, heading: "Starter heading" } })
      .expect(200);
    await client.post(`/api/themes/${modern._id}/install`).expect(200);
    const m1 = await getCustomization(client);
    assert.equal(m1.themeSlug, "modern");
    assert.equal(hero(m1).settings.subheading, "Modern words");
    assert.equal(hero(m1).settingSources.subheading, "override");
    assert.notEqual(hero(m1).settings.heading, "Starter heading");
    assert.equal(m1.settings.colors.primary, "#123456");
    assert.equal(m1.customCSS, ".x { color: red; }");
    const live = await request(app).get("/storefront/store-info").set("Host", HOST).expect(200);
    const liveHero = live.body.data.store.themeCustomization.sectionsByTemplate.index.find((s) => s.id === "hero");
    assert.equal(liveHero.settings.subheading, "Modern words", "the published modern homepage is live again");

    // And starter's unpublished edit is still there when switching back again.
    await client.post(`/api/themes/${starter._id}/install`).expect(200);
    const s2 = await getCustomization(client);
    assert.equal(hero(s2).settings.heading, "Starter heading");
    assert.equal(s2.isDraft, true, "an unpublished draft comes back as a draft");

    const stored = (await mongoose.model("Tenant").findOne({ slug: SLUG }).lean()).themeCustomization;
    assert.deepEqual(Object.keys(stored.savedByTheme), ["modern"], "only themes not in use are kept aside");
  });
});
