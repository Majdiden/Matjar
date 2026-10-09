/**
 * Homepage simple editor helpers (PBI 10-13): dashboard/src/lib/homepageEditor.ts.
 * Dependency-free TypeScript, imported directly via Node's built-in type
 * stripping (same as storeProfileHelpers.test.js).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyOp,
  applyOps,
  effectiveBilingual,
  effectiveValue,
  inverseOp,
  liveSettings,
  moveAmong,
  opKey,
  readBilingual,
  reconcileOrder,
  sortSections,
  withoutOverride,
  writeBilingual,
} from "../../dashboard/src/lib/homepageEditor.ts";
import { brandSettingValues } from "../../storefront-themes/_shared/theme/brandBindings.ts";
import { basicSettingsOf, isBasicSection } from "../../storefront-themes/_shared/theme/settingLevels.ts";

const section = (id, extra = {}) => ({ id, type: id, settings: {}, ...extra });

describe("bilingual mapping (base key + __ar twin)", () => {
  it("writes Arabic to the twin and English (or Arabic) to the base key", () => {
    assert.deepEqual(writeBilingual({}, "heading", { ar: "أهلًا", en: "Welcome" }), {
      heading: "Welcome",
      heading__ar: "أهلًا",
    });
    assert.deepEqual(writeBilingual({}, "heading", { ar: " أهلًا " }), { heading: "أهلًا", heading__ar: "أهلًا" });
  });

  it("matches how a bilingual brand-kit text fills a setting (10-7)", () => {
    for (const tagline of [{ ar: "عطور أصلية" }, { ar: "عطور أصلية", en: "Genuine perfumes" }]) {
      const brand = brandSettingValues("subheading", "brand.tagline", { brand: { tagline } });
      assert.deepEqual(writeBilingual({}, "subheading", tagline), brand);
      assert.deepEqual(readBilingual(brand, "subheading"), { ar: tagline.ar, en: tagline.en || "" });
    }
  });

  it("round-trips and keeps other settings", () => {
    const stored = writeBilingual({ other: 1 }, "heading", { ar: "عروض", en: "Offers" });
    assert.equal(stored.other, 1);
    assert.deepEqual(readBilingual(stored, "heading"), { ar: "عروض", en: "Offers" });
  });

  it("clearing writes a blank base and drops the twin", () => {
    assert.deepEqual(writeBilingual({ heading: "x", heading__ar: "س" }, "heading", { ar: "", en: "" }), { heading: "" });
  });

  it("reads a base-only value by its script", () => {
    assert.deepEqual(readBilingual({ heading: "مرحبًا" }, "heading"), { ar: "مرحبًا", en: "" });
    assert.deepEqual(readBilingual({ heading: "Welcome" }, "heading"), { ar: "", en: "Welcome" });
    assert.deepEqual(readBilingual({}, "heading"), { ar: "", en: "" });
  });
});

describe("effective value (override → brand → default)", () => {
  const hero = section("hero", {
    settings: { heading: "Sale", subheading: "" },
    settingSources: { heading: "override", subheading: "brand", background_image: "default" },
    brandValues: { subheading: "Genuine perfumes", subheading__ar: "عطور أصلية" },
  });
  it("uses brandValues only when the source is brand", () => {
    assert.equal(effectiveValue(hero, "heading"), "Sale");
    assert.equal(effectiveValue(hero, "subheading"), "Genuine perfumes");
    assert.equal(effectiveValue(hero, "subheading__ar", "subheading"), "عطور أصلية");
    assert.equal(effectiveValue(hero, "background_image"), undefined);
  });
  it("shows the brand text in the bilingual field", () => {
    assert.deepEqual(effectiveBilingual(hero, "subheading"), { ar: "عطور أصلية", en: "Genuine perfumes" });
    assert.deepEqual(effectiveBilingual(hero, "heading"), { ar: "", en: "Sale" });
  });
  it("hands a setting back to the brand kit by removing it and its twin", () => {
    assert.deepEqual(withoutOverride({ subheading: "a", subheading__ar: "ب", heading: "h" }, "subheading"), { heading: "h" });
  });
  it("live message sends removed keys as defaults (the preview merges)", () => {
    assert.deepEqual(
      liveSettings({ subheading: "a", subheading__ar: "ب", heading: "h" }, { heading: "h" }, { subheading: "" }),
      { heading: "h", subheading: "", subheading__ar: "" },
    );
  });
});

describe("order", () => {
  it("sorts by order, then list position", () => {
    const list = [section("c", { order: 2 }), section("a", { order: 0 }), section("b", { order: "1" }), section("d", { order: 2 })];
    assert.deepEqual(sortSections(list).map((s) => s.id), ["a", "b", "c", "d"]);
  });

  it("moves among listed sections and leaves the others in place", () => {
    const all = ["hero", "hidden-adv", "cats", "featured"];
    const listed = ["hero", "cats", "featured"];
    assert.deepEqual(moveAmong(all, listed, "cats", -1), ["cats", "hidden-adv", "hero", "featured"]);
    assert.deepEqual(moveAmong(all, listed, "cats", 1), ["hero", "hidden-adv", "featured", "cats"]);
    assert.equal(moveAmong(all, listed, "hero", -1), null);
    assert.equal(moveAmong(all, listed, "featured", 1), null);
    assert.equal(moveAmong(all, listed, "nope", 1), null);
  });

  it("reconciles a saved order with the current sections", () => {
    assert.deepEqual(reconcileOrder(["b", "gone", "a", "b"], ["a", "b", "new"]), ["b", "a", "new"]);
  });
});

describe("ops, replay and undo", () => {
  const base = [
    section("hero", { order: 0, settings: { heading: "A" }, settingSources: { heading: "override" }, brandValues: {} }),
    section("cats", { order: 1, disabled: false, enabled: true }),
  ];

  it("keys: newest change per section/kind wins", () => {
    assert.equal(opKey({ kind: "order", sectionIds: [] }), "order");
    assert.equal(opKey({ kind: "visible", sectionId: "x", visible: true }), "visible:x");
    assert.equal(opKey({ kind: "settings", sectionId: "x", settings: {} }), "settings:x");
  });

  it("applies settings (with display sources), visibility and order", () => {
    const list = applyOps(base, [
      { kind: "settings", sectionId: "hero", settings: { heading: "B" }, sources: { heading: "override" } },
      { kind: "visible", sectionId: "cats", visible: false },
      { kind: "order", sectionIds: ["cats", "hero"] },
    ]);
    assert.deepEqual(list.map((s) => [s.id, s.order]), [["cats", 0], ["hero", 1]]);
    assert.equal(list[1].settings.heading, "B");
    assert.equal(list[0].disabled, true);
    assert.equal(list[0].enabled, false);
    assert.equal(base[0].settings.heading, "A", "input not mutated");
  });

  it("an order op never drops a section", () => {
    const list = applyOp(base, { kind: "order", sectionIds: ["cats"] });
    assert.deepEqual(list.map((s) => s.id), ["cats", "hero"]);
  });

  it("the inverse op restores the state before the change", () => {
    const ops = [
      { kind: "settings", sectionId: "hero", settings: {}, sources: { heading: "brand" }, brandValues: { heading: "x" } },
      { kind: "visible", sectionId: "cats", visible: false },
      { kind: "order", sectionIds: ["cats", "hero"] },
    ];
    for (const op of ops) {
      const after = applyOp(base, op);
      const restored = applyOp(after, inverseOp(base, op));
      assert.deepEqual(
        sortSections(restored).map((s) => ({ id: s.id, settings: s.settings, shown: s.disabled !== true, src: s.settingSources, bv: s.brandValues })),
        sortSections(base).map((s) => ({ id: s.id, settings: s.settings, shown: s.disabled !== true, src: s.settingSources, bv: s.brandValues })),
        op.kind,
      );
    }
    assert.equal(inverseOp(base, { kind: "visible", sectionId: "gone", visible: true }), null);
  });
});

describe("simple-mode filtering (shared helpers the editor uses)", () => {
  it("lists basic sections and only their basic settings", () => {
    assert.equal(isBasicSection({}), true);
    assert.equal(isBasicSection({ level: "advanced" }), false);
    const def = { settings: [{ id: "a", level: "basic" }, { id: "b" }, { id: "c", level: "basic" }] };
    assert.deepEqual(basicSettingsOf(def).map((s) => s.id), ["a", "c"]);
  });
});
