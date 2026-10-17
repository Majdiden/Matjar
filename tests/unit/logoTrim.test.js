/**
 * Store logos (PBI 10-45): uploads are cropped to the logo itself
 * (services/logoTrim.js) and drawn at a size that fits their shape
 * (storefront-themes/_shared/theme/logoScale.ts).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { trimLogo } from "../../services/logoTrim.js";
import { logoHeightFactor, splitHeightClasses, MAX_TALL, MIN_WIDE } from "../../storefront-themes/_shared/theme/logoScale.ts";

const svg = (w, h, bg, body) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ""}${body}</svg>`)).png().toBuffer();

const sizeOf = async (buf) => {
  const { width, height } = await sharp(buf).metadata();
  return { width, height };
};

describe("trimLogo", () => {
  it("crops a phone screenshot to the logo, dropping the bars and the status bar", async () => {
    const input = await svg(600, 1200, "#000",
      `<rect x="40" y="20" width="80" height="24" fill="#fff"/><rect x="480" y="22" width="60" height="24" fill="#fff"/>
       <rect x="0" y="300" width="600" height="600" fill="#ec4899"/>`);
    const { buffer, trimmed } = await trimLogo(input);
    assert.equal(trimmed, true);
    const { width, height } = await sizeOf(buffer);
    assert.equal(width, 600);
    assert.ok(height >= 600 && height < 700, `height ${height}`);
  });

  it("removes a white margin and keeps transparent logos' text under the icon", async () => {
    const wide = await trimLogo(await svg(1000, 620, "#fff", `<rect x="200" y="250" width="600" height="120" fill="#0f766e"/>`));
    assert.equal(wide.trimmed, true);
    const w = await sizeOf(wide.buffer);
    assert.ok(w.width < 700 && w.height < 200, JSON.stringify(w));

    const stacked = await trimLogo(await svg(500, 500, null,
      `<circle cx="250" cy="180" r="110" fill="#7c3aed"/><rect x="120" y="340" width="260" height="50" fill="#7c3aed"/>`));
    const s = await sizeOf(stacked.buffer);
    assert.ok(s.height >= 320, `text kept: ${s.height}`);
  });

  it("cuts a coloured square down around a small mark, keeping its colour", async () => {
    const input = await svg(500, 500, "#5b2a4a", `<circle cx="250" cy="250" r="70" fill="#d4a017"/>`);
    const { buffer, trimmed } = await trimLogo(input);
    assert.equal(trimmed, true);
    const { width, height } = await sizeOf(buffer);
    assert.ok(width < 220 && width > 150 && height === width, `${width}x${height}`);
    const { data } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([data[0], data[1], data[2]], [0x5b, 0x2a, 0x4a], "corner keeps the square's colour");
  });

  it("leaves a mark that already fills its coloured square, a tight logo and unreadable input alone", async () => {
    const tile = await trimLogo(await svg(500, 500, "#be185d", `<circle cx="250" cy="250" r="190" fill="#fff"/>`));
    assert.equal(tile.trimmed, false);
    const tight = await trimLogo(await svg(400, 400, "#fff", `<rect x="4" y="4" width="392" height="392" fill="#111"/>`));
    assert.equal(tight.trimmed, false);
    const junk = Buffer.from("not an image");
    assert.deepEqual(await trimLogo(junk), { buffer: junk, trimmed: false });
  });
});

describe("logoHeightFactor", () => {
  it("grows tall logos, shrinks wide ones, within bounds", () => {
    assert.equal(logoHeightFactor(1), 1);
    assert.equal(logoHeightFactor(null), 1);
    assert.ok(logoHeightFactor(0.5) > 1 && logoHeightFactor(0.5) <= MAX_TALL);
    assert.equal(logoHeightFactor(0.1), MAX_TALL);
    assert.ok(logoHeightFactor(3) < 1 && logoHeightFactor(3) >= MIN_WIDE);
    assert.equal(logoHeightFactor(50), MIN_WIDE);
  });

  it("splits the theme's height classes from the rest", () => {
    assert.deepEqual(splitHeightClasses("h-9 w-auto md:h-12 max-w-[96px] lg:h-[72px] rounded-md"), {
      height: "h-9 md:h-12 lg:h-[72px]",
      rest: "w-auto max-w-[96px] rounded-md",
    });
  });
});
