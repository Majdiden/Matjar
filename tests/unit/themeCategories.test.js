import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normaliseThemeCategories, summariseThemeCategories, THEME_CATEGORIES } from "../../config/themeCategories.js";

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
});
