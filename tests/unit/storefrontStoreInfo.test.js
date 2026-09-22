/**
 * Shared store payload — the contract between GET /storefront/store-info and
 * the payload the SPA shell embeds (middlewares/storefrontServe.js).
 *
 * Both callers MUST produce the same object. The embedded copy is what the
 * storefront renders on its first paint; if it disagreed with the fetched
 * copy the page would paint one store and then swap to another — the exact
 * flash the embedding was added to remove. These tests pin the payload's
 * shape and the two preview branches that change it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStoreInfo } from "../../services/storefrontStoreInfo.js";

const PUBLISHED_AT = new Date("2026-01-01T00:00:00.000Z");

/** Minimal tenant with a published customization for the `linen` theme. */
const tenant = () => ({
  name: "Fallback Name",
  settings: {
    storeName: "Beauxe Cosmetics",
    storeDescription: "Honest skincare",
    currency: "SDG",
    activeTheme: "linen",
    policies: {
      privacy: { title: "Privacy", body: "<p>privacy</p>" },
      returns: { title: "Returns", body: "" },
    },
  },
  themeCustomization: {
    settings: { colors: { primary: "#draft" } },
    sectionsByTemplate: { index: [{ id: "draft-hero" }] },
    customCSS: ".draft{}",
    published: {
      publishedAt: PUBLISHED_AT,
      themeSlug: "linen",
      settings: { colors: { primary: "#published" } },
      sectionsByTemplate: { index: [{ id: "live-hero" }], product: [{ id: "live-pdp" }] },
      customCSS: ".live{}",
      version: 7,
    },
  },
});

describe("buildStoreInfo", () => {
  it("returns the PUBLISHED snapshot for an ordinary visitor", () => {
    const s = buildStoreInfo(tenant());
    assert.equal(s.name, "Beauxe Cosmetics");
    assert.equal(s.currency, "SDG");
    assert.equal(s.theme, "linen");
    assert.equal(s.themeCustomization.version, 7);
    assert.equal(s.themeCustomization.settings.colors.primary, "#published");
    assert.deepEqual(s.themeCustomization.sections, [{ id: "live-hero" }]);
    assert.ok(s.themeCustomization.sectionsByTemplate.product, "per-template store is kept");
    assert.ok(!s.themeCustomization.preview);
  });

  it("falls back to the tenant name when no store name is set", () => {
    const t = tenant();
    delete t.settings.storeName;
    assert.equal(buildStoreInfo(t).name, "Fallback Name");
  });

  it("drops policies that have no body", () => {
    const s = buildStoreInfo(tenant());
    assert.deepEqual(Object.keys(s.policies), ["privacy"]);
    const bare = tenant();
    bare.settings.policies = {};
    assert.equal(buildStoreInfo(bare).policies, null);
  });

  it("serves the DRAFT snapshot for a valid editor preview token", () => {
    const t = tenant();
    t.themeCustomization.previewToken = "a".repeat(64);
    t.themeCustomization.previewTokenExpiry = new Date(Date.now() + 60_000);
    const s = buildStoreInfo(t, { previewParam: "a".repeat(64) });
    assert.equal(s.themeCustomization.preview, true);
    assert.equal(s.themeCustomization.settings.colors.primary, "#draft");
    assert.deepEqual(s.themeCustomization.sections, [{ id: "draft-hero" }]);
  });

  it("ignores a wrong or absent preview token", () => {
    const t = tenant();
    t.themeCustomization.previewToken = "a".repeat(64);
    t.themeCustomization.previewTokenExpiry = new Date(Date.now() + 60_000);
    for (const bad of ["b".repeat(64), "", null, undefined]) {
      const s = buildStoreInfo(t, { previewParam: bad });
      assert.equal(s.themeCustomization.version, 7, `token ${bad} must not unlock the draft`);
    }
  });

  it("reports the preview theme and drops a customization it cannot understand", () => {
    const s = buildStoreInfo(tenant(), { previewTheme: "aurum" });
    assert.equal(s.theme, "aurum");
    assert.equal(
      s.themeCustomization,
      null,
      "another theme's sections would render as foreign section types"
    );
  });

  it("returns no customization when the published snapshot belongs to another theme", () => {
    const t = tenant();
    t.themeCustomization.published.themeSlug = "atelier";
    assert.equal(buildStoreInfo(t).themeCustomization, null);
  });

  it("survives a tenant with no settings at all", () => {
    const s = buildStoreInfo({ name: "Bare" });
    assert.equal(s.name, "Bare");
    assert.equal(s.currency, "SDG");
    assert.equal(s.theme, null);
    assert.equal(s.themeCustomization, null);
    assert.equal(s.policies, null);
    assert.equal(s.giftCards.enabled, true);
  });

  it("is JSON-serialisable — it is embedded in an HTML <script> tag", () => {
    const json = JSON.stringify(buildStoreInfo(tenant()));
    assert.deepEqual(JSON.parse(json).themeCustomization.version, 7);
  });
});
