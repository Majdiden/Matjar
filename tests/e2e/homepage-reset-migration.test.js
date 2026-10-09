/**
 * Migration 016: existing stores move to the theme's new homepage (hero, new
 * arrivals, featured), keep what they wrote in the sections that stay, keep
 * their old top-strip text in the layout strip, and lose theme-level keys
 * the theme no longer declares (which would block their next publish).
 * Uses the built theme manifests (npm run build-themes).
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { getThemeManifest } from "../../services/themeManifestRegistry.js";
import { up } from "../../migrations/016_reset_homepage_sections.js";

const tenants = () => mongoose.connection.db.collection("tenants");
const ids = (list) => list.map((s) => s.id);

describe("E2E migration 016: reset homepages", () => {
  before(async () => { await startTestDb(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  it("rebuilds draft, published and saved lists, carries the strip text, drops retired keys", async () => {
    const nutreko = getThemeManifest("nutreko").templates.index;
    const techhub = getThemeManifest("techhub").templates.index;
    const heroId = nutreko[0].id;
    const oldList = [
      { id: "nutreko-strip", type: "nutreko-top-strip", enabled: true, order: 0, settings: { text: "Free delivery", text__ar: "توصيل مجاني" } },
      { id: heroId, type: nutreko[0].type, enabled: false, order: 1, settings: { heading: "عطور النيل" } },
      { id: "nutreko-guarantee", type: "nutreko-guarantee", enabled: true, order: 2, settings: {} },
    ];
    const { insertedId } = await tenants().insertOne({
      name: "nile", slug: "nile", domains: { subdomain: { name: "nile" } },
      settings: { activeTheme: "nutreko" },
      themeCustomization: {
        settings: { theme: { home_variant: "mega", show_announcement_bar: true } },
        sectionsByTemplate: { index: oldList },
        published: { themeSlug: "nutreko", publishedAt: new Date(), settings: { theme: {} }, sectionsByTemplate: { index: oldList } },
        savedByTheme: { techhub: { draft: { sectionsByTemplate: { index: [{ id: "x", type: "category-icons", settings: {} }] } }, published: null } },
      },
    });
    const untouched = await tenants().insertOne({ name: "plain", slug: "plain", domains: { subdomain: { name: "plain" } }, settings: { activeTheme: "modern" } });

    await up(mongoose.connection.db, {});
    const tc = (await tenants().findOne({ _id: insertedId })).themeCustomization;

    for (const list of [tc.sectionsByTemplate.index, tc.published.sectionsByTemplate.index]) {
      assert.deepEqual(ids(list), ids(nutreko));
      assert.ok(list.every((s) => s.enabled === true));
      assert.equal(list[0].settings.heading, "عطور النيل", "the merchant's hero text stays");
    }
    assert.deepEqual(ids(tc.savedByTheme.techhub.draft.sectionsByTemplate.index), ids(techhub));
    assert.equal(tc.settings.theme.announcement_text, "Free delivery");
    assert.equal(tc.settings.theme.announcement_text__ar, "توصيل مجاني");
    assert.equal(tc.published.settings.theme.announcement_text__ar, "توصيل مجاني");
    assert.equal(tc.settings.theme.home_variant, undefined, "retired key removed");
    assert.equal(tc.settings.theme.show_announcement_bar, true);
    assert.equal((await tenants().findOne({ _id: untouched.insertedId })).themeCustomization, undefined);

    // Idempotent: a second run changes nothing.
    const before = JSON.stringify(await tenants().findOne({ _id: insertedId }));
    await up(mongoose.connection.db, {});
    assert.equal(JSON.stringify(await tenants().findOne({ _id: insertedId })), before);
  });

  it("keeps a strip text the store already set", async () => {
    const { insertedId } = await tenants().insertOne({
      slug: "glow",
      domains: { subdomain: { name: "glow" } },
      settings: { activeTheme: "glowing" },
      themeCustomization: {
        settings: { theme: { announcement_text: "Mine" } },
        sectionsByTemplate: { index: [{ id: "glowing-strip", type: "glowing-top-strip", settings: { text: "Old" } }] },
      },
    });
    await up(mongoose.connection.db, {});
    const tc = (await tenants().findOne({ _id: insertedId })).themeCustomization;
    assert.equal(tc.settings.theme.announcement_text, "Mine");
    assert.deepEqual(ids(tc.sectionsByTemplate.index), ids(getThemeManifest("glowing").templates.index));
  });
});
