/**
 * Homepage reset (utils/homepageReset.js, migration 016): stores move to the
 * theme's default homepage (hero, new arrivals, featured) and keep what they
 * wrote in the sections that stay.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resetHomepageList, sameHomepageShape, stripTextFrom } from "../../utils/homepageReset.js";

const INDEX = [
  { id: "hero", type: "hero", settings: { overlay: 40 } },
  { id: "new-arrivals", type: "new-arrivals", settings: {} },
  { id: "featured-products", type: "featured-products", settings: { product_limit: 8 } },
];

describe("resetHomepageList", () => {
  it("keeps only the default sections, in order, shown, with the merchant's settings", () => {
    const old = [
      { id: "glowing-strip", type: "glowing-top-strip", enabled: true, settings: { text: "Sale" } },
      { id: "featured-products", type: "featured-products", enabled: false, order: 1, settings: { heading: "Best" } },
      { id: "newsletter", type: "newsletter", settings: {} },
      { id: "hero", type: "hero", order: 3, settings: { heading: "عطور النيل", primary_button_text: "اطلب الآن" }, blocks: [{ id: "b1" }] },
    ];
    const next = resetHomepageList(old, INDEX);
    assert.deepEqual(next.map((s) => s.id), ["hero", "new-arrivals", "featured-products"]);
    assert.deepEqual(next.map((s) => s.order), [0, 1, 2]);
    assert.ok(next.every((s) => s.enabled === true));
    assert.deepEqual(next[0].settings, { overlay: 40, heading: "عطور النيل", primary_button_text: "اطلب الآن" });
    assert.deepEqual(next[0].blocks, [{ id: "b1" }]);
    assert.deepEqual(next[2].settings, { product_limit: 8, heading: "Best" });
    assert.deepEqual(next[1].settings, {});
  });

  it("matches by type when the store's instance has a generated id, using each old section once", () => {
    const old = [{ id: "hero-abc", type: "hero", settings: { heading: "A" } }];
    const next = resetHomepageList(old, [...INDEX, { id: "hero-2", type: "hero", settings: {} }]);
    assert.equal(next[0].settings.heading, "A");
    assert.equal(next[3].settings.heading, undefined);
  });

  it("is idempotent and tolerates junk", () => {
    const once = resetHomepageList([null, 5, { id: "hero", type: "hero", settings: { heading: "x" } }], INDEX);
    assert.ok(sameHomepageShape(once, resetHomepageList(once, INDEX)));
    assert.deepEqual(resetHomepageList(undefined, INDEX).map((s) => s.id), INDEX.map((s) => s.id));
    assert.deepEqual(resetHomepageList([], undefined), []);
  });

  it("sees visibility and order as shape changes", () => {
    const next = resetHomepageList([], INDEX);
    assert.ok(!sameHomepageShape(next, [...next].reverse()));
    assert.ok(!sameHomepageShape(next, next.map((s, i) => (i === 1 ? { ...s, enabled: false } : s))));
  });
});

describe("stripTextFrom", () => {
  it("takes the text (and Arabic twin) of a shown theme top-strip section", () => {
    assert.deepEqual(stripTextFrom([{ type: "nutreko-top-strip", settings: { text: " Free delivery ", text__ar: "توصيل مجاني" } }]), {
      announcement_text: "Free delivery",
      announcement_text__ar: "توصيل مجاني",
    });
    assert.deepEqual(stripTextFrom([{ type: "beauxe-top-bar", settings: { text__ar: "عرض" } }]), {
      announcement_text: "عرض",
      announcement_text__ar: "عرض",
    });
  });

  it("ignores hidden, empty or other sections", () => {
    assert.equal(stripTextFrom([{ type: "glowing-top-strip", enabled: false, settings: { text: "x" } }]), null);
    assert.equal(stripTextFrom([{ type: "milmaa-top-strip", settings: { text: "  " } }]), null);
    assert.equal(stripTextFrom([{ type: "banner", settings: { text: "x" } }]), null);
    assert.equal(stripTextFrom(undefined), null);
  });
});

describe("undeclaredThemeKeys", async () => {
  const { undeclaredThemeKeys } = await import("../../utils/homepageReset.js");
  const defs = [
    { id: "announcement_text", type: "text" },
    { id: "show_announcement_bar", type: "checkbox" },
  ];
  it("lists keys the theme dropped, keeping text twins", () => {
    assert.deepEqual(
      undeclaredThemeKeys(
        { announcement_text: "x", announcement_text__ar: "س", show_announcement_bar: true, home_variant: "mega", show_announcement_bar__ar: "x", announcement_text_2: "y" },
        defs
      ).sort(),
      ["announcement_text_2", "home_variant", "show_announcement_bar__ar"]
    );
    assert.deepEqual(undeclaredThemeKeys(null, defs), []);
  });
});
