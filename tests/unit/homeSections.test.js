/**
 * Homepage with no products yet (storefront-themes/_shared/theme/homeSections.ts):
 * only the hero stays, and the "No products to show yet" message shows.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gateHomeSections, isHeroSection } from "../../storefront-themes/_shared/theme/homeSections.ts";

const home = [
  { id: "hero", type: "atelier-hero" },
  { id: "new", type: "atelier-product-grid" },
  { id: "featured", type: "featured-products" },
];

describe("gateHomeSections", () => {
  it("keeps every section while unknown or when the store has products", () => {
    for (const hasProducts of [null, true]) {
      const out = gateHomeSections(home, hasProducts);
      assert.deepEqual(out.sections, home);
      assert.equal(out.showEmpty, false);
    }
  });

  it("keeps only the hero and shows the message when there are no products", () => {
    const out = gateHomeSections(home, false);
    assert.deepEqual(out.sections.map((s) => s.id), ["hero"]);
    assert.equal(out.showEmpty, true);
  });

  it("recognises every theme's hero type", () => {
    for (const type of ["hero", "atelier-hero", "aurum-split-hero", "hero-showcase"]) {
      assert.equal(isHeroSection(type), true, type);
    }
    for (const type of ["new-arrivals", "featured-products", "staff-picks", undefined]) {
      assert.equal(isHeroSection(type), false, String(type));
    }
  });
});
