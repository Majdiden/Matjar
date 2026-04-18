/**
 * E2E: theme customization safety + versioning.
 *
 * Pins:
 *   1. Publish snapshots the draft into both `themeCustomization.published`
 *      and a new ThemeCustomizationVersion row, version starts at 1.
 *   2. Subsequent publishes monotonically increment the version number.
 *   3. Storefront /store-info serves the *published* snapshot, not the
 *      draft. Editing the draft after publish does NOT leak to shoppers.
 *   4. Listing versions returns rows newest-first.
 *   5. Getting a single version returns its full snapshot.
 *   6. Rolling back to a prior version restores the draft to that snapshot
 *      and marks isDraft=true (does NOT auto-publish — merchant gets a
 *      preview chance).
 *   7. Publish rejects a draft whose section type is not declared by the
 *      active theme manifest (manifest schema validation gate).
 *   8. Customers cannot read versions or trigger rollback.
 *
 * Why we test the storefront isolation explicitly: the original
 * implementation served `themeCustomization` directly to /store-info, so a
 * dashboard edit-in-progress would leak to live shoppers. The split into
 * draft + published is the entire point of this task.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";

const HOST = "acme.localhost";

async function provisionTenant(app) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Acme Coffee",
      email: "owner@acme.test",
      password: "Sup3rSecret!",
      subdomain: "acme",
    })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function loginAdmin(app) {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Host", HOST)
    .send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: "acme.localhost" })
    .expect(200);
  return res.body.responseObject.accessToken;
}

async function registerCustomer(app) {
  const res = await request(app)
    .post("/storefront/auth/register")
    .set("Host", HOST)
    .send({ name: "Jane Doe", email: "jane@buyer.test", password: "Sup3rSecret!" })
    .expect(201);
  return res.body.data.accessToken;
}

// Seed an active "modern" theme + a draft customization with a single
// `hero` section using a real manifest setting key. Bypasses the section-
// add controller because we want full control over the draft state.
async function seedDraft(tenantId, { sections } = {}) {
  const Tenant = mongoose.model("Tenant");
  const defaultSections = sections || [
    {
      id: "hero-1",
      type: "hero",
      enabled: true,
      order: 0,
      settings: { heading: "Original heading" },
    },
  ];
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: {
      "settings.activeTheme": "modern",
      "themeCustomization.sections": defaultSections,
      "themeCustomization.settings.colors": { primary: "#ff0000" },
      "themeCustomization.customCSS": ".body { color: red; }",
      "themeCustomization.isDraft": true,
    },
  });
}

describe("E2E theme customization safety + versioning", () => {
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

  it("publish creates version 1, sets published snapshot, clears draft flag", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedDraft(tenantId);

    const pub = await request(app)
      .post("/api/theme-customization/publish")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ label: "Initial launch" })
      .expect(200);

    assert.equal(pub.body.success, true);
    assert.equal(pub.body.data.customization.published.version, 1);
    assert.equal(pub.body.data.customization.isDraft, false);

    const list = await request(app)
      .get("/api/theme-customization/versions")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(list.body.data.versions.length, 1);
    assert.equal(list.body.data.versions[0].version, 1);
    assert.equal(list.body.data.versions[0].label, "Initial launch");
  });

  it("subsequent publishes monotonically increment the version", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedDraft(tenantId);

    for (let i = 0; i < 3; i++) {
      // Mutate the draft slightly between publishes so each snapshot is
      // distinct in the inspector. The version counter is what we're
      // pinning here, not the contents.
      const Tenant = mongoose.model("Tenant");
      await Tenant.findByIdAndUpdate(tenantId, {
        $set: { "themeCustomization.sections.0.settings.heading": `Heading v${i + 1}` },
      });

      await request(app)
        .post("/api/theme-customization/publish")
        .set("Host", HOST)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({})
        .expect(200);
    }

    const list = await request(app)
      .get("/api/theme-customization/versions")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const versions = list.body.data.versions.map((v) => v.version);
    assert.deepEqual(versions, [3, 2, 1]);
  });

  it("storefront /store-info serves the published snapshot, not the draft", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedDraft(tenantId);

    // Publish initial state.
    await request(app)
      .post("/api/theme-customization/publish")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    // Then mutate the draft to a "broken-looking" heading. This should
    // NOT appear in the storefront response.
    const Tenant = mongoose.model("Tenant");
    await Tenant.findByIdAndUpdate(tenantId, {
      $set: { "themeCustomization.sections.0.settings.heading": "DRAFT IN PROGRESS — DO NOT SHIP" },
    });

    const store = await request(app)
      .get("/storefront/store-info")
      .set("Host", HOST)
      .expect(200);

    const tc = store.body.data.store.themeCustomization;
    assert.ok(tc, "published themeCustomization should be present");
    assert.equal(tc.version, 1);
    assert.equal(tc.sections[0].settings.heading, "Original heading");
  });

  it("brand-new tenant with no published version returns null themeCustomization", async () => {
    await provisionTenant(app);
    const store = await request(app)
      .get("/storefront/store-info")
      .set("Host", HOST)
      .expect(200);
    assert.equal(store.body.data.store.themeCustomization, null);
  });

  it("get a single version returns its full snapshot", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedDraft(tenantId);

    await request(app)
      .post("/api/theme-customization/publish")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ label: "v1" })
      .expect(200);

    const v1 = await request(app)
      .get("/api/theme-customization/versions/1")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    assert.equal(v1.body.data.version.version, 1);
    assert.equal(v1.body.data.version.themeSlug, "modern");
    assert.equal(v1.body.data.version.sections[0].settings.heading, "Original heading");
    assert.equal(v1.body.data.version.customCSS, ".body { color: red; }");
  });

  it("rollback restores draft to a prior version and marks isDraft=true", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedDraft(tenantId);

    // v1: original
    await request(app)
      .post("/api/theme-customization/publish")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    // Mutate + publish v2
    const Tenant = mongoose.model("Tenant");
    await Tenant.findByIdAndUpdate(tenantId, {
      $set: { "themeCustomization.sections.0.settings.heading": "Second heading" },
    });
    await request(app)
      .post("/api/theme-customization/publish")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    // Rollback to v1.
    const rb = await request(app)
      .post("/api/theme-customization/versions/1/rollback")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    assert.equal(rb.body.data.rolledBackTo, 1);
    assert.equal(rb.body.data.customization.isDraft, true);
    assert.equal(rb.body.data.customization.sections[0].settings.heading, "Original heading");

    // Storefront still serves v2 because rollback does NOT auto-publish.
    const store = await request(app)
      .get("/storefront/store-info")
      .set("Host", HOST)
      .expect(200);
    assert.equal(store.body.data.store.themeCustomization.version, 2);
    assert.equal(store.body.data.store.themeCustomization.sections[0].settings.heading, "Second heading");
  });

  it("publish rejects a draft with a section type the manifest doesn't declare", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedDraft(tenantId, {
      sections: [
        { id: "ghost-1", type: "totally-fake-section-type", enabled: true, order: 0, settings: {} },
      ],
    });

    const res = await request(app)
      .post("/api/theme-customization/publish")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.message || "", /not declared by theme/);

    // No version row should have been created.
    const list = await request(app)
      .get("/api/theme-customization/versions")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(list.body.data.versions.length, 0);
  });

  it("publish rejects a draft with a setting key the section type doesn't declare", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await seedDraft(tenantId, {
      sections: [
        {
          id: "hero-1",
          type: "hero",
          enabled: true,
          order: 0,
          settings: { heading: "OK", definitely_not_a_real_setting: "boom" },
        },
      ],
    });

    const res = await request(app)
      .post("/api/theme-customization/publish")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.message || "", /unknown setting/);
  });

  it("customers cannot list versions or trigger rollback", async () => {
    await provisionTenant(app);
    const customerToken = await registerCustomer(app);

    const list = await request(app)
      .get("/api/theme-customization/versions")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`);
    assert.equal(list.status, 403);

    const rb = await request(app)
      .post("/api/theme-customization/versions/1/rollback")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({});
    assert.equal(rb.status, 403);
  });
});
