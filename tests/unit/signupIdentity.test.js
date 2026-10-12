/**
 * Signup identity (dashboard/src/lib/signupIdentity.ts): the colour suggested
 * from the merchant's logo, and the files kept until the store exists.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SIGNUP_COLOR_SWATCHES,
  dominantColor,
  hasPendingIdentity,
  setPendingIdentity,
  takePendingIdentity,
} from "../../dashboard/src/lib/signupIdentity.ts";

/** RGBA pixels: `n` of each [r,g,b,a]. */
const pixels = (...groups) => groups.flatMap(([rgba, n]) => Array.from({ length: n }, () => rgba).flat());

describe("dominantColor", () => {
  it("finds the logo's colour, ignoring white background and dark outline", () => {
    const c = dominantColor(pixels([[255, 255, 255, 255], 600], [[10, 10, 10, 255], 100], [[91, 58, 41, 255], 300]));
    assert.equal(c, "#5b3a29");
  });

  it("ignores transparent pixels", () => {
    assert.equal(dominantColor(pixels([[0, 0, 0, 0], 900], [[29, 78, 216, 255], 100])), "#1d4ed8");
  });

  it("has no suggestion for a black-and-white logo", () => {
    assert.equal(dominantColor(pixels([[255, 255, 255, 255], 700], [[0, 0, 0, 255], 300])), null);
    assert.equal(dominantColor(pixels([[128, 128, 128, 255], 100])), null);
    assert.equal(dominantColor([]), null);
  });

  it("picks the most common colour when there are several", () => {
    const c = dominantColor(pixels([[220, 38, 38, 255], 300], [[22, 163, 74, 255], 100]));
    assert.equal(c, "#dc2626");
  });
});

describe("pending identity", () => {
  it("hands the files over once", () => {
    const logo = { name: "logo.png" };
    setPendingIdentity({ logo, cover: null });
    assert.equal(hasPendingIdentity(), true);
    assert.deepEqual(takePendingIdentity(), { logo, cover: null });
    assert.equal(hasPendingIdentity(), false);
    assert.deepEqual(takePendingIdentity(), {});
  });

  it("offers valid colours the server accepts", () => {
    for (const c of SIGNUP_COLOR_SWATCHES) assert.match(c, /^#[0-9a-f]{6}$/);
  });
});
