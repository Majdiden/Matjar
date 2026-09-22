/**
 * Default header menu — bilingual seeding contract.
 *
 * The storefront renders `translations[lang].label` and only falls back to
 * `label` (storefront-themes/_shared/hooks/useMenu.ts). A seeder that writes
 * one language into `label` and leaves `translations` empty therefore pins the
 * nav to the store's creation language forever — an Arabic shopper on an
 * English store saw "Home / All Products / About / Contact". These tests hold
 * the seeder to writing both languages regardless of the store's own language.
 *
 * Mongo is not needed: seedDefaultMenus only touches `models.Menu`, so a stub
 * captures the document it would create. Migration 015 backfills stores that
 * were seeded before this contract existed.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  seedDefaultMenus,
  DEFAULT_HEADER_MENU_HANDLE,
} from "../../services/storeSetup.js";

/** Stub scoped models that records the created menu instead of writing it. */
function stubModels({ existing = null } = {}) {
  const created = [];
  return {
    created,
    models: {
      Menu: {
        findOne: async () => existing,
        create: async (doc) => {
          created.push(doc);
          return doc;
        },
      },
    },
  };
}

async function seed(language) {
  const { models, created } = stubModels();
  const result = await seedDefaultMenus(models, language);
  assert.equal(result.created, 1);
  assert.equal(created.length, 1);
  return created[0];
}

const EXPECTED = [
  { url: "/", en: "Home", ar: "الرئيسية" },
  { url: "/products", en: "All Products", ar: "جميع المنتجات" },
  { url: "/about", en: "About", ar: "من نحن" },
  { url: "/contact", en: "Contact", ar: "اتصل بنا" },
];

describe("seedDefaultMenus", () => {
  for (const language of ["en", "ar", "ar-SD", "en-US", undefined]) {
    it(`writes both languages on every item for language=${language}`, async () => {
      const menu = await seed(language);

      assert.equal(menu.handle, DEFAULT_HEADER_MENU_HANDLE);
      assert.equal(menu.location, "header");
      assert.equal(menu.items.length, EXPECTED.length);

      menu.items.forEach((item, i) => {
        const want = EXPECTED[i];
        assert.equal(item.url, want.url);
        assert.equal(item.order, i);
        assert.equal(
          item.translations?.en?.label,
          want.en,
          `item ${i} is missing its English translation`
        );
        assert.equal(
          item.translations?.ar?.label,
          want.ar,
          `item ${i} is missing its Arabic translation`
        );
        // `label` must never be empty — it is the storefront's fallback.
        assert.ok(item.label, `item ${i} has an empty label`);
      });
    });
  }

  it("puts the store's own language in `label` so the dashboard reads naturally", async () => {
    const en = await seed("en");
    const ar = await seed("ar");

    assert.deepEqual(en.items.map((i) => i.label), EXPECTED.map((e) => e.en));
    assert.deepEqual(ar.items.map((i) => i.label), EXPECTED.map((e) => e.ar));

    assert.equal(en.title, "Main menu");
    assert.equal(ar.title, "القائمة الرئيسية");
  });

  it("never clobbers an existing header menu", async () => {
    const { models, created } = stubModels({ existing: { handle: "header" } });
    const result = await seedDefaultMenus(models, "en");

    assert.deepEqual(result, { created: 0, skipped: true });
    assert.equal(created.length, 0);
  });

  it("is a no-op when the tenant has no Menu model", async () => {
    assert.deepEqual(await seedDefaultMenus({}, "en"), { created: 0 });
    assert.deepEqual(await seedDefaultMenus(null, "en"), { created: 0 });
  });
});
