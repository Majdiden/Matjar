/**
 * Operator edits to a theme's presentation (name, description, cover,
 * categories) are stored as overrides, re-applied after every manifest
 * sync, and cleared back to the manifest with null.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { generateHash } from "../../utils/misc.js";
import { reloadAllManifests, getThemeManifest } from "../../services/themeManifestRegistry.js";
import { syncThemeCatalog } from "../../services/themeCatalogSync.js";

async function platformToken(app, role) {
  const TenantUser = mongoose.model("TenantUser");
  const email = `${role}@matjar.test`;
  await TenantUser.create({ tenantId: new mongoose.Types.ObjectId(), name: role, email, platformAdmin: true, platformRole: role, platformPasswordHash: await generateHash("PlatformPass2025!!") });
  const res = await request(app).post("/api/platform/login").send({ email, password: "PlatformPass2025!!" }).expect(200);
  return res.body.data.token;
}

describe("E2E theme details overrides", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); reloadAllManifests(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); await syncThemeCatalog(); });

  it("edits survive a manifest resync and null restores the manifest", async () => {
    const manifest = getThemeManifest("starter");
    assert.ok(manifest, "starter manifest built on disk");
    const owner = await platformToken(app, "owner");
    const support = await platformToken(app, "support");
    const list = await request(app).get("/api/platform/storefront/themes").set("Authorization", `Bearer ${owner}`).expect(200);
    const starter = list.body.data.find((t) => t.slug === "starter");
    assert.ok(starter);
    assert.ok(list.body.meta.categoryOptions.some((c) => c.key === "fashion"));

    await request(app).patch(`/api/platform/storefront/themes/${starter._id}`).set("Authorization", `Bearer ${support}`).send({ name: "Nope" }).expect(403);
    await request(app).patch(`/api/platform/storefront/themes/${starter._id}`).set("Authorization", `Bearer ${owner}`).send({ reason: "x" }).expect(400);
    await request(app).patch(`/api/platform/storefront/themes/${starter._id}`).set("Authorization", `Bearer ${owner}`).send({ previewImage: "javascript:alert(1)" }).expect(400);

    const edited = await request(app)
      .patch(`/api/platform/storefront/themes/${starter._id}`)
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Starter Pro", description: "Our simplest theme.", previewImage: "https://cdn.example.com/starter.jpg", categories: ["general", "fashion"], reason: "rebrand" })
      .expect(200);
    assert.equal(edited.body.data.name, "Starter Pro");
    assert.equal(edited.body.data.previewImage, "https://cdn.example.com/starter.jpg");
    assert.deepEqual(edited.body.data.categories, ["general", "fashion"]);

    // Merchants see the edited presentation.
    const merchantView = await request(app).get("/api/themes/active").expect(200);
    const seen = merchantView.body.data.themes.find((t) => t.slug === "starter");
    assert.equal(seen.name, "Starter Pro");
    assert.deepEqual(seen.categoryKeys, ["general", "fashion"]);

    // A manifest resync (boot / rebuild) must not undo the edit.
    await syncThemeCatalog();
    const Theme = mongoose.model("Theme");
    const afterSync = await Theme.findById(starter._id).lean();
    assert.equal(afterSync.name, "Starter Pro");
    assert.equal(afterSync.previewImage, "https://cdn.example.com/starter.jpg");
    assert.deepEqual(afterSync.categories, ["general", "fashion"]);

    // null clears an override → manifest value is back; other overrides stay.
    const reset = await request(app)
      .patch(`/api/platform/storefront/themes/${starter._id}`)
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: null, categories: null })
      .expect(200);
    assert.equal(reset.body.data.name, manifest.name);
    assert.deepEqual(reset.body.data.categories, manifest.categories);
    assert.equal(reset.body.data.description, "Our simplest theme.");

    const audit = await mongoose.model("PlatformAuditLog").find({ action: "theme.details.update" }).lean();
    assert.equal(audit.length, 2);
    assert.equal(audit[0].reason, "rebrand");
  });
});
