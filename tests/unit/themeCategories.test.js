import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normaliseThemeCategories, summariseThemeCategories, THEME_CATEGORIES, THEME_CATEGORY_ICONS, defaultThemeCategoryDocs, resolveThemeCategoryKeys } from "../../config/themeCategories.js";
import { STORE_NICHES } from "../../config/storeNiches.js";
import { deriveCategoryKeys } from "../../migrations/017_seed_theme_categories.js";

describe("theme categories", () => {
  it("maps loose manifest keys onto the curated set in registry order", () => {
    assert.deepEqual(normaliseThemeCategories(["cosmetics", "beauty"]), ["beauty"]);
    assert.deepEqual(normaliseThemeCategories(["supplements", "health", "fitness"]), ["health"]);
    assert.deepEqual(normaliseThemeCategories(["electronics", "general", "fashion"]), ["general", "fashion", "electronics"]);
    assert.deepEqual(normaliseThemeCategories(["Apparel", " LUXURY "]), ["fashion"]);
  });
  it("falls back to general for unknown or empty input", () => {
    assert.deepEqual(normaliseThemeCategories(["weird-niche"]), ["general"]);
    assert.deepEqual(normaliseThemeCategories([]), ["general"]);
    assert.deepEqual(normaliseThemeCategories(undefined), ["general"]);
  });
  it("summarises counts and omits empty categories", () => {
    const summary = summariseThemeCategories([{ categories: ["beauty"] }, { categories: ["cosmetics", "fashion"] }, { categories: [] }]);
    assert.deepEqual(summary.map((c) => [c.key, c.count]), [["general", 1], ["fashion", 1], ["beauty", 2]]);
    assert.ok(summary.every((c) => c.label && c.labelAr));
  });
  it("registry keys and aliases are unique", () => {
    const keys = THEME_CATEGORIES.map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length);
    const aliases = THEME_CATEGORIES.flatMap((c) => c.aliases);
    assert.equal(new Set(aliases).size, aliases.length);
  });
  it("every signup niche is a default category (old niche values stay offered)", () => {
    const keys = THEME_CATEGORIES.map((c) => c.key);
    for (const n of STORE_NICHES) assert.ok(keys.includes(n), n);
  });
  it("seed docs carry en/ar names, ascending order and every alias", () => {
    const docs = defaultThemeCategoryDocs();
    assert.deepEqual(docs.map((d) => d.order), docs.map((_, i) => i));
    assert.ok(docs.every((d) => d.name.en && d.name.ar && d.active));
  });
  it("uses an explicit assignment when present, aliases otherwise", () => {
    const cats = [{ key: "general" }, { key: "pets", aliases: ["animals"] }, { key: "fashion", aliases: ["apparel"] }];
    assert.deepEqual(resolveThemeCategoryKeys({ categoryKeys: ["fashion", "gone", "pets"] }, cats), ["pets", "fashion"]);
    assert.deepEqual(resolveThemeCategoryKeys({ categoryKeys: [] }, cats), []);
    assert.deepEqual(resolveThemeCategoryKeys({ categoryKeys: null, categories: ["Animals", "apparel"] }, cats), ["pets", "fashion"]);
    assert.deepEqual(resolveThemeCategoryKeys({ categories: ["x"] }, cats), ["general"]);
    assert.deepEqual(resolveThemeCategoryKeys({ categories: ["x"] }, [{ key: "pets" }]), []);
  });
  it("migration 017 derives the same keys as the app", () => {
    const cats = defaultThemeCategoryDocs();
    for (const raw of [["cosmetics", "beauty"], ["supplements", "fitness"], ["kids", "general"], [], ["weird"]]) {
      assert.deepEqual(deriveCategoryKeys(raw, cats), normaliseThemeCategories(raw, cats), JSON.stringify(raw));
    }
  });

  it("the icon list matches the console picker and signup", () => {
    // Both apps declare the map as `CATEGORY_ICONS ... = { A, B, ... };`.
    const namesIn = (file) => {
      const src = fs.readFileSync(new URL(file, import.meta.url), "utf8");
      const body = src.match(/export const CATEGORY_ICONS[^=]*=\s*\{([^}]*)\}/)[1];
      return body.split(",").map((n) => n.trim()).filter(Boolean);
    };
    assert.deepEqual(namesIn("../../platform-admin/src/pages/storefront/categoryIcons.tsx"), [...THEME_CATEGORY_ICONS]);
    assert.deepEqual(namesIn("../../dashboard/src/lib/categoryIcons.ts"), [...THEME_CATEGORY_ICONS]);
    for (const c of THEME_CATEGORIES) assert.ok(THEME_CATEGORY_ICONS.includes(c.icon), `${c.key}: ${c.icon}`);
  });
});
