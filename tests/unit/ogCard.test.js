/**
 * Store share card (services/ogCard.js) and its page tags
 * (middlewares/storefrontMeta.js): a square card about the store, whose URL
 * changes when what it shows changes, so cached link previews refresh.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { buildStoreCardPng, clearOgCardCache, storeCardVersion, textColorOn, CARD_WIDTH, CARD_HEIGHT } from "../../services/ogCard.js";
import { buildStorefrontHead } from "../../middlewares/storefrontMeta.js";

const BASE = "https://eifa.matjar.to";
const tenant = (settings) => ({ _id: "t1", settings: { storeName: "عِفة للعطور والبخور", ...settings } });

describe("store share card", () => {
  it("is a square PNG, with an Arabic name and no logo (initial on the store colour)", async () => {
    clearOgCardCache();
    const png = await buildStoreCardPng(tenant({ brand: { color: "#5b3a29", tagline: { ar: "عطور و بخورات سودانية" } } }), BASE);
    const meta = await sharp(png).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, CARD_WIDTH);
    assert.equal(meta.height, CARD_HEIGHT);
    assert.equal(CARD_WIDTH, CARD_HEIGHT, "square: WhatsApp shows it large");
  });

  it("still renders when the logo cannot be fetched", async () => {
    const png = await buildStoreCardPng(tenant({ logo: "http://127.0.0.1:9/missing.png" }), BASE);
    assert.equal((await sharp(png).metadata()).width, CARD_WIDTH);
  });

  it("changes version when the name, logo, colour, cover or short line changes", () => {
    const base = { logo: "https://cdn.example.com/a.png", brand: { color: "#5b3a29", tagline: { ar: "عطور" }, coverImage: null } };
    const v = storeCardVersion(tenant(base), BASE);
    assert.equal(storeCardVersion(tenant(base), BASE), v, "stable");
    for (const change of [
      { storeName: "اسم آخر" },
      { logo: "https://cdn.example.com/b.png" },
      { brand: { ...base.brand, color: "#123456" } },
      { brand: { ...base.brand, coverImage: "https://cdn.example.com/c.jpg" } },
      { brand: { ...base.brand, tagline: { ar: "بخور" } } },
    ]) {
      assert.notEqual(storeCardVersion(tenant({ ...base, ...change }), BASE), v, JSON.stringify(change));
    }
  });

  it("picks readable text for the store colour", () => {
    assert.equal(textColorOn([91, 58, 41]), "#ffffff");
    assert.equal(textColorOn([245, 215, 122]), "#111111");
  });
});

describe("share tags", () => {
  it("point the store page at the square, versioned card", () => {
    const t = tenant({ logo: "https://cdn.example.com/a.png" });
    const head = buildStorefrontHead({ tenant: t, baseUrl: BASE, path: "/" });
    const v = storeCardVersion(t, BASE);
    assert.ok(head.includes(`content="${BASE}/og/store-card.png?v=${v}"`));
    assert.match(head, /og:image:width" content="1200"/);
    assert.match(head, /og:image:height" content="1200"/);
  });
});
