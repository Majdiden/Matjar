/**
 * Brand kit (PBI 10) — normalisation rules and the store-profile update
 * builder. Themes render these values straight into `src`, `href` and CSS,
 * so the scheme/colour rules here are the XSS boundary for the brand kit.
 *
 * WhatsApp normalisation runs against the catalog phone-country defaults
 * (Sudan enabled + default): with no DB connection services/phoneCountries.js
 * falls back to them, which is exactly a fresh platform's config.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BRAND_TEXT_MAX_LENGTH,
  normalizeBrandColor,
  normalizeBrandImageUrl,
  normalizeBilingualText,
  unwrapWhatsappLink,
  publicBrand,
} from "../../utils/brandKit.js";
import { buildStoreProfileUpdate, normalizeWhatsapp, toStoreProfile } from "../../services/storeProfile.js";
import { updateStoreProfileSchema } from "../../validators/storeProfile.validator.js";
import { DEFAULT_FLAGS, getFlagDef } from "../../config/featureFlags.js";

const rejects400 = (promise) =>
  assert.rejects(promise, (err) => err.statusCode === 400);

describe("normalizeBrandColor", () => {
  it("accepts #rrggbb in any case and stores it lowercase", () => {
    assert.equal(normalizeBrandColor("#A1B2C3"), "#a1b2c3");
    assert.equal(normalizeBrandColor("  #0f0f0f "), "#0f0f0f");
  });

  it("rejects short, named, rgb() and CSS-injection values", () => {
    for (const bad of ["#fff", "red", "a1b2c3", "#a1b2c3ff", "rgb(0,0,0)", "#a1b2c3;background:url(x)", "", null, 7]) {
      assert.equal(normalizeBrandColor(bad), null, `${bad} must be rejected`);
    }
  });
});

describe("normalizeBrandImageUrl", () => {
  it("accepts https URLs and our own /uploads/ paths", () => {
    assert.equal(normalizeBrandImageUrl("https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg");
    assert.equal(normalizeBrandImageUrl(" /uploads/brand/cover.webp "), "/uploads/brand/cover.webp");
  });

  it("rejects javascript:, data:, http:, protocol-relative and other paths", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:image/png;base64,AAAA",
      "http://example.com/a.jpg",
      "//evil.example/a.jpg",
      "/\\evil.example/a.jpg",
      "/uploads//evil.example/a.jpg",
      "/uploads/../secrets",
      "/api/anything",
      "https://user:pass@example.com/a.jpg",
      "cover.jpg",
      `https://example.com/${"a".repeat(3000)}`,
    ]) {
      assert.equal(normalizeBrandImageUrl(bad), null, `${bad} must be rejected`);
    }
  });
});

describe("normalizeBilingualText", () => {
  it("trims each language and drops empty ones", () => {
    assert.deepEqual(normalizeBilingualText("tagline", { ar: "  أحلى عطور  ", en: "   " }), {
      value: { ar: "أحلى عطور" },
      invalid: [],
    });
  });

  it("clears on null, empty string or all-empty languages", () => {
    for (const empty of [null, undefined, "", { ar: "", en: null }]) {
      assert.equal(normalizeBilingualText("city", empty).value, null);
    }
  });

  it("requires Arabic whenever a text is set; English stays optional", () => {
    assert.deepEqual(normalizeBilingualText("city", { en: "Khartoum" }).invalid, ["ar"]);
    assert.deepEqual(normalizeBilingualText("city", { ar: "", en: "Khartoum" }).invalid, ["ar"]);
    assert.deepEqual(normalizeBilingualText("city", { ar: "الخرطوم" }), { value: { ar: "الخرطوم" }, invalid: [] });
    assert.deepEqual(normalizeBilingualText("city", { ar: "الخرطوم", en: "Khartoum" }).invalid, []);
  });

  it("flags over-long or non-string languages and non-object input", () => {
    const long = "ب".repeat(BRAND_TEXT_MAX_LENGTH.tagline + 1);
    assert.deepEqual(normalizeBilingualText("tagline", { ar: long }).invalid, ["ar"]);
    assert.deepEqual(normalizeBilingualText("hours", { ar: "٩ص–٩م", en: 5 }).invalid, ["en"]);
    assert.deepEqual(normalizeBilingualText("city", "Khartoum").invalid, ["city"]);
    // Exactly at the cap is fine.
    const exact = "ب".repeat(BRAND_TEXT_MAX_LENGTH.tagline);
    assert.equal(normalizeBilingualText("tagline", { ar: exact }).value.ar, exact);
  });
});

describe("WhatsApp normalisation", () => {
  it("unwraps pasted wa.me / api.whatsapp.com links", () => {
    assert.equal(unwrapWhatsappLink("https://wa.me/249912345678"), "+249912345678");
    assert.equal(unwrapWhatsappLink("wa.me/+249912345678?text=hi"), "+249912345678");
    assert.equal(unwrapWhatsappLink("https://api.whatsapp.com/send?phone=249912345678&text=x"), "+249912345678");
    assert.equal(unwrapWhatsappLink(" 0912345678 "), "0912345678");
  });

  it("normalises local, international, Arabic-digit and link input to E.164", async () => {
    for (const raw of ["0912345678", "+249 912 345 678", "00249912345678", "٠٩١٢٣٤٥٦٧٨", "https://wa.me/249912345678"]) {
      assert.equal(await normalizeWhatsapp(raw), "+249912345678", raw);
    }
  });

  it("rejects too-short numbers, letters and countries that are not enabled", async () => {
    await rejects400(normalizeWhatsapp("0912"));
    await rejects400(normalizeWhatsapp("call me"));
    await rejects400(normalizeWhatsapp("+20 100 123 4567")); // Egypt not enabled by default
    await rejects400(normalizeWhatsapp("0912345678", "EG"));
  });
});

describe("buildStoreProfileUpdate", () => {
  it("sets only the provided keys, normalised", async () => {
    const { $set, $unset } = await buildStoreProfileUpdate({
      storeName: "  متجر النيل ",
      brand: {
        color: "#AABBCC",
        tagline: { ar: " عطور أصلية ", en: "" },
        whatsapp: "0912345678",
        coverImage: "/uploads/brand/c.jpg",
      },
      socialLinks: { facebook: "facebook.com/nile" },
    });
    assert.deepEqual($set, {
      "settings.storeName": "متجر النيل",
      "settings.brand.tagline": { ar: "عطور أصلية" },
      "settings.brand.coverImage": "/uploads/brand/c.jpg",
      "settings.brand.color": "#aabbcc",
      "settings.brand.whatsapp": "+249912345678",
      "settings.socialLinks.facebook": "https://facebook.com/nile",
    });
    assert.deepEqual($unset, {});
  });

  it("clears brand and social fields with $unset and name/logo with null", async () => {
    const { $set, $unset } = await buildStoreProfileUpdate({
      storeName: "",
      logo: null,
      brand: { color: null, city: { ar: "  " }, hours: null, whatsapp: "", coverImage: "" },
      socialLinks: { instagram: "" },
    });
    assert.deepEqual($set, { "settings.storeName": null, "settings.logo": null });
    assert.deepEqual(Object.keys($unset).sort(), [
      "settings.brand.city",
      "settings.brand.color",
      "settings.brand.coverImage",
      "settings.brand.hours",
      "settings.brand.whatsapp",
      "settings.socialLinks.instagram",
    ]);
  });

  it("rejects bad values with 400 (nothing is built, so nothing is written)", async () => {
    await rejects400(buildStoreProfileUpdate({ brand: { color: "red" } }));
    await rejects400(buildStoreProfileUpdate({ brand: { coverImage: "javascript:alert(1)" } }));
    await rejects400(buildStoreProfileUpdate({ brand: { coverImage: "data:image/png;base64,AA" } }));
    await rejects400(buildStoreProfileUpdate({ logo: "//evil.example/logo.png" }));
    await rejects400(buildStoreProfileUpdate({ brand: { whatsapp: "12" } }));
    await rejects400(buildStoreProfileUpdate({ socialLinks: { facebook: "https://evil.example/fb" } }));
    await rejects400(buildStoreProfileUpdate({ storeName: "x" }));
    await rejects400(buildStoreProfileUpdate({}));
  });

  it("caps contact fields with the shared settings rules", async () => {
    const { $set } = await buildStoreProfileUpdate({ contact: { phone: "  0912 ", email: null } });
    assert.deepEqual($set, { "settings.contact.phone": "0912", "settings.contact.email": "" });
  });
});

describe("updateStoreProfileSchema", () => {
  const parse = (body) => updateStoreProfileSchema.safeParse({ body });

  it("accepts a partial body and null/empty clears", () => {
    assert.ok(parse({ brand: { color: null, tagline: { ar: "x" } } }).success);
    assert.ok(parse({ storeName: "" }).success);
  });

  it("rejects unknown keys, over-long text, short names and empty bodies", () => {
    assert.equal(parse({ brand: { colour: "#000000" } }).success, false);
    assert.equal(parse({ socialLinks: { myspace: "https://myspace.com/x" } }).success, false);
    assert.equal(parse({ brand: { city: { ar: "ب".repeat(BRAND_TEXT_MAX_LENGTH.city + 1) } } }).success, false);
    assert.equal(parse({ storeName: "x" }).success, false);
    assert.equal(parse({}).success, false);
  });
});

describe("publicBrand / toStoreProfile", () => {
  it("is null when nothing is set and drops empty or invalid stored values", () => {
    assert.equal(publicBrand(undefined), null);
    assert.equal(publicBrand({ tagline: { ar: "", en: "" }, color: "" }), null);
    assert.deepEqual(
      publicBrand({ color: "javascript:x", coverImage: "http://x/a.jpg", whatsapp: "0912", city: { ar: "الخرطوم" } }),
      { city: { ar: "الخرطوم" } }
    );
  });

  it("gives the dashboard objects (never null) to bind a form to", () => {
    assert.deepEqual(toStoreProfile({ settings: {} }), {
      storeName: null,
      logo: null,
      brand: {},
      socialLinks: {},
      contact: { email: null, phone: null, address: null },
    });
  });
});

describe("design.simpleMode flag", () => {
  it("is registered as a boolean that defaults to OFF", () => {
    const def = getFlagDef("design.simpleMode");
    assert.ok(def, "flag missing from FEATURE_REGISTRY");
    assert.equal(def.type, "boolean");
    assert.equal(def.default, false);
    assert.equal(DEFAULT_FLAGS["design.simpleMode"], false);
  });

  it("is mirrored in the dashboard key list", () => {
    const src = readFileSync(new URL("../../dashboard/src/lib/features.ts", import.meta.url), "utf8");
    assert.match(src, /'design\.simpleMode'/);
    assert.match(src, /'design\.simpleMode': false/);
  });
});
