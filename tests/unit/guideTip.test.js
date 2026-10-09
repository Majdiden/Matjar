/**
 * Guided setup tip (dashboard/src/lib/guideTip.ts): where the bubble goes,
 * which marked element it points at, and when a target counts as in view.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ARROW_INSET,
  GUIDE_RANK,
  guideAttrs,
  guideMenuAttrs,
  parseRank,
  pickGuideTarget,
  placeTip,
  targetView,
} from "../../dashboard/src/lib/guideTip.ts";

const SCREEN = { top: 0, left: 0, width: 400, height: 800 };
const BUBBLE = { width: 288, height: 140 };

describe("placeTip", () => {
  it("opens below a target with room, centred on it and kept on screen", () => {
    const p = placeTip({ top: 100, left: 20, width: 100, height: 40 }, BUBBLE, SCREEN);
    assert.equal(p.side, "bottom");
    assert.equal(p.top, 152);
    assert.equal(p.left, 8, "clamped to the margin");
    assert.equal(p.arrow, 62, "arrow still points at the target's centre");
  });

  it("flips above near the bottom", () => {
    const p = placeTip({ top: 700, left: 100, width: 200, height: 48 }, BUBBLE, SCREEN);
    assert.equal(p.side, "top");
    assert.equal(p.top, 700 - 12 - 140);
  });

  it("opens beside sidebar rows, toward the reading end", () => {
    const wide = { top: 0, left: 0, width: 1280, height: 800 };
    const ltr = placeTip({ top: 200, left: 16, width: 220, height: 40 }, BUBBLE, wide, { prefer: "side", dir: "ltr" });
    assert.equal(ltr.side, "right");
    assert.equal(ltr.left, 16 + 220 + 12);
    const rtl = placeTip({ top: 200, left: 1044, width: 220, height: 40 }, BUBBLE, wide, { prefer: "side", dir: "rtl" });
    assert.equal(rtl.side, "left");
    assert.equal(rtl.left, 1044 - 12 - 288);
  });

  it("keeps the arrow off the corners and the bubble inside a tight area", () => {
    const p = placeTip({ top: 300, left: 395, width: 4, height: 4 }, BUBBLE, SCREEN);
    assert.ok(p.left >= 8 && p.left + BUBBLE.width <= 392);
    assert.equal(p.arrow, BUBBLE.width - ARROW_INSET);
    const cramped = placeTip({ top: 0, left: 0, width: 400, height: 790 }, BUBBLE, SCREEN);
    assert.ok(cramped.top >= 8 && cramped.top + BUBBLE.height <= 792);
  });
});

describe("targetView", () => {
  const area = { top: 64, left: 0, width: 400, height: 600 };
  it("is in view when enough of it shows, else above or below", () => {
    assert.equal(targetView({ top: 100, left: 0, width: 10, height: 40 }, area), "in");
    assert.equal(targetView({ top: 44, left: 0, width: 10, height: 40 }, area), "in", "half shows under the header");
    assert.equal(targetView({ top: 10, left: 0, width: 10, height: 40 }, area), "above");
    assert.equal(targetView({ top: 700, left: 0, width: 10, height: 40 }, area), "below");
    assert.equal(targetView({ top: 600, left: 0, width: 10, height: 900 }, area), "in", "a tall field needs only 24px");
  });
});

describe("pickGuideTarget", () => {
  it("prefers the most specific shown target, then one in view", () => {
    const menu = { rank: GUIDE_RANK.menu, shown: true, view: "in" };
    const field = { rank: GUIDE_RANK.field, shown: true, view: "below" };
    const fieldInView = { rank: GUIDE_RANK.field, shown: true, view: "in" };
    const hiddenEntry = { rank: GUIDE_RANK.entry, shown: false, view: "in" };
    assert.equal(pickGuideTarget([menu, field]), 1, "a field scrolled away still beats the menu");
    assert.equal(pickGuideTarget([menu, field, fieldInView]), 2);
    assert.equal(pickGuideTarget([menu, hiddenEntry]), 0);
    assert.equal(pickGuideTarget([hiddenEntry]), -1);
    assert.equal(pickGuideTarget([]), -1);
  });
});

describe("attributes", () => {
  it("marks steps, ranks and hints", () => {
    assert.deepEqual(guideAttrs("brand", "field", "logo"), { "data-guide": "brand", "data-guide-rank": "3", "data-guide-hint": "logo" });
    assert.deepEqual(guideAttrs("share", "entry"), { "data-guide": "share", "data-guide-rank": "2" });
    assert.deepEqual(guideMenuAttrs("/dashboard/store"), { "data-guide": "brand policies", "data-guide-rank": "1", "data-guide-place": "side" });
    assert.deepEqual(guideMenuAttrs("/dashboard/products", "auto"), { "data-guide": "product", "data-guide-rank": "1" });
    assert.deepEqual(guideMenuAttrs("/dashboard/orders"), {});
    assert.equal(parseRank("3"), 3);
    assert.equal(parseRank(undefined), GUIDE_RANK.menu);
    assert.equal(parseRank("x"), GUIDE_RANK.menu);
  });
});
