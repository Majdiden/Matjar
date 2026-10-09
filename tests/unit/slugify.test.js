/**
 * Backend slug helper (utils/slugify.js).
 *
 * Merchants name products in Arabic; before this helper every backend
 * slugify dropped non-Latin characters, so "عطر الورد" produced an empty
 * slug. These cases pin the transliterated output and the uniqueness rules.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slugify, ensureUniqueSlug, SLUG_MAX_LENGTH } from "../../utils/slugify.js";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("slugify", () => {
  it("transliterates an Arabic name into a readable slug", () => {
    assert.equal(slugify("عطر الورد"), "atr-alord");
    assert.equal(slugify("متجر النيل"), "mtjr-alnil");
    // ق → g, ذ → z (Sudanese everyday spelling); و consonant word-initially.
    assert.equal(slugify("قهوة"), "ghoa");
    assert.equal(slugify("ورد ذهبي"), "wrd-zhbi");
  });

  it("handles mixed scripts, Arabic-Indic digits, diacritics and tatweel", () => {
    assert.equal(slugify("قميص Polo أزرق"), "gmis-polo-azrg");
    assert.equal(slugify("بيـــت ٢٤"), "bit-24");
    assert.equal(slugify("عُطُور"), "ator");
    assert.equal(slugify("Size ۳ XL"), "size-3-xl");
  });

  it("keeps the Latin behaviour and strips invisible format characters", () => {
    assert.equal(slugify("  Café & Co. "), "cafe-and-co");
    assert.equal(slugify("Men's Shoes"), "mens-shoes");
    assert.equal(slugify("‏عطر‎ ورد⁦"), "atr-wrd");
  });

  it("normalises a merchant-typed slug the same way", () => {
    assert.equal(slugify("My--Product__Name"), "my-product-name");
    assert.equal(slugify("-already-a-slug-"), "already-a-slug");
  });

  it("returns empty when nothing usable is left", () => {
    assert.equal(slugify(""), "");
    assert.equal(slugify("😀 !!"), "");
    assert.equal(slugify(null), "");
  });

  it("caps the length without leaving a trailing hyphen", () => {
    const long = slugify("ab ".repeat(80));
    assert.ok(long.length <= SLUG_MAX_LENGTH);
    assert.match(long, SLUG_RE);
    assert.equal(slugify("abcd efgh", { maxLength: 5 }), "abcd");
    assert.equal(slugify("عطر الورد الأحمر", { maxLength: 4 }), "atr");
  });
});

describe("ensureUniqueSlug", () => {
  const takenSet = (...slugs) => {
    const set = new Set(slugs);
    return async (candidate) => set.has(candidate);
  };

  it("returns the base when free and suffixes -2, -3… when taken", async () => {
    assert.equal(await ensureUniqueSlug(takenSet(), "atr"), "atr");
    assert.equal(await ensureUniqueSlug(takenSet("atr"), "atr"), "atr-2");
    assert.equal(await ensureUniqueSlug(takenSet("atr", "atr-2"), "atr"), "atr-3");
  });

  it("falls back to <prefix>-<6 hex> for an empty base", async () => {
    const slug = await ensureUniqueSlug(takenSet(), "", { fallback: "product" });
    assert.match(slug, /^product-[0-9a-f]{6}$/);
  });

  it("keeps suffixed candidates within maxLength", async () => {
    const base = "a".repeat(10);
    const slug = await ensureUniqueSlug(takenSet(base), base, { maxLength: 10 });
    assert.equal(slug, "aaaaaaaa-2");
  });

  it("gives up probing after a bounded number of attempts and still returns a slug", async () => {
    let calls = 0;
    const slug = await ensureUniqueSlug(async () => { calls += 1; return true; }, "busy");
    assert.ok(calls <= 50, `probed ${calls} times`);
    assert.match(slug, /^busy-[0-9a-f]{6}$/);
  });
});
