/**
 * Brand colour palette (storefront-themes/_shared/theme/brandColor.ts): the
 * tokens themes paint their signature areas with must stay readable.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { brandCssVars, brandPalette, contrastRatio, parseHex } from "../../storefront-themes/_shared/theme/brandColor.ts";

describe("brandPalette", () => {
  it("picks readable text on the colour and keeps it as given", () => {
    const teal = brandPalette("#0f766e");
    assert.equal(teal.brand, "#0f766e");
    assert.equal(teal.contrast, "#ffffff");
    const yellow = brandPalette("#facc15");
    assert.equal(yellow.contrast, "#111111");
    assert.equal(brandPalette("#FFF").brand, "#ffffff");
  });

  it("darkens the ink of light colours until it reads on white", () => {
    for (const c of ["#facc15", "#fde68a", "#a7f3d0", "#ffffff", "#0f766e", "#7c3aed"]) {
      const p = brandPalette(c);
      assert.ok(contrastRatio(parseHex(p.ink), [255, 255, 255]) >= 4.5, `${c} → ${p.ink}`);
      assert.ok(contrastRatio(parseHex(p.brand), parseHex(p.contrast)) >= 3, `${c} on its contrast`);
    }
  });

  it("gives a light tint and a deeper shade", () => {
    const p = brandPalette("#0f766e");
    assert.ok(parseHex(p.soft).every((v) => v > 200), p.soft);
    assert.ok(parseHex(p.strong).every((v, i) => v <= parseHex(p.brand)[i]));
  });

  it("writes nothing for a missing or invalid colour", () => {
    for (const bad of [null, undefined, "", "teal", "#12", "rgb(0,0,0)"]) {
      assert.equal(brandPalette(bad), null);
      assert.equal(brandCssVars(bad), "");
    }
    assert.match(brandCssVars("#0f766e"), /--brand: #0f766e;[\s\S]*--brand-contrast: #ffffff;/);
  });
});
