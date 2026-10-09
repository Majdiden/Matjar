/**
 * Brand-kit form helpers (PBI 10-12, 10-14): dashboard/src/lib/bilingual.ts
 * and dashboard/src/lib/storeProfile.ts. Dependency-free TypeScript, imported
 * directly via Node's built-in type stripping (same as storeLink.test.js).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanBilingual, sameBilingual, validateBilingual } from "../../dashboard/src/lib/bilingual.ts";
import {
  firstMissingBrandItem,
  profileErrorMessage,
  socialInputToLink,
  toStoreProfile,
  unwrapWhatsappLink,
} from "../../dashboard/src/lib/storeProfile.ts";
import { unwrapWhatsappLink as serverUnwrap } from "../../utils/brandKit.js";

describe("validateBilingual", () => {
  it("accepts empty, Arabic only, and Arabic + English", () => {
    assert.equal(validateBilingual({}), null);
    assert.equal(validateBilingual({ ar: "عطور" }), null);
    assert.equal(validateBilingual({ ar: "عطور", en: "Perfumes" }), null);
  });
  it("rejects English without Arabic (the API rule)", () => {
    assert.equal(validateBilingual({ en: "Perfumes" }), "en_only");
    assert.equal(validateBilingual({ ar: "   ", en: "Perfumes" }), "en_only");
  });
  it("requires Arabic only when asked", () => {
    assert.equal(validateBilingual({ ar: " " }, { required: true }), "ar_required");
    assert.equal(validateBilingual({ ar: "نص" }, { required: true }), null);
  });
});

describe("cleanBilingual / sameBilingual", () => {
  it("trims, drops empty English, and returns null when empty", () => {
    assert.deepEqual(cleanBilingual({ ar: " عطور ", en: "  " }), { ar: "عطور" });
    assert.deepEqual(cleanBilingual({ ar: "عطور", en: " Perfumes " }), { ar: "عطور", en: "Perfumes" });
    assert.equal(cleanBilingual({ ar: " ", en: "" }), null);
  });
  it("compares after trimming", () => {
    assert.ok(sameBilingual({ ar: "عطور " }, { ar: "عطور", en: "" }));
    assert.ok(sameBilingual(null, { ar: "" }));
    assert.ok(!sameBilingual({ ar: "عطور", en: "x" }, { ar: "عطور" }));
  });
});

describe("firstMissingBrandItem", () => {
  it("nudges in order: logo, WhatsApp, tagline, colour, cover", () => {
    const p = toStoreProfile(null);
    assert.equal(firstMissingBrandItem(p), "logo");
    p.logo = "/uploads/logo.png";
    assert.equal(firstMissingBrandItem(p), "whatsapp");
    p.brand.whatsapp = "+249912345678";
    assert.equal(firstMissingBrandItem(p), "tagline");
    p.brand.tagline = { ar: "عطور أصلية" };
    assert.equal(firstMissingBrandItem(p), "color");
    p.brand.color = "#0f766e";
    assert.equal(firstMissingBrandItem(p), "cover");
    p.brand.coverImage = "https://cdn.example/cover.jpg";
    assert.equal(firstMissingBrandItem(p), null);
  });
});

describe("socialInputToLink", () => {
  it("turns handles into profile links", () => {
    assert.equal(socialInputToLink("instagram", "@nile.perfumes"), "https://instagram.com/nile.perfumes");
    assert.equal(socialInputToLink("tiktok", "nile_perfumes"), "https://www.tiktok.com/@nile_perfumes");
    assert.equal(socialInputToLink("facebook", " nileperfumes "), "https://facebook.com/nileperfumes");
  });
  it("leaves links and odd input for the server to judge", () => {
    assert.equal(socialInputToLink("facebook", "facebook.com/nile"), "facebook.com/nile");
    assert.equal(socialInputToLink("instagram", "https://instagram.com/x"), "https://instagram.com/x");
    assert.equal(socialInputToLink("instagram", "عطور النيل"), "عطور النيل");
    assert.equal(socialInputToLink("instagram", "  "), "");
  });
});

describe("unwrapWhatsappLink", () => {
  it("matches the backend rule", () => {
    for (const input of [
      "https://wa.me/249912345678",
      "wa.me/+249912345678?text=hi",
      "https://api.whatsapp.com/send?phone=249912345678&text=x",
      "0912345678",
    ]) {
      const expected = serverUnwrap(input);
      assert.equal(unwrapWhatsappLink(input).trim(), expected, input);
    }
  });
});

describe("profileErrorMessage", () => {
  const t = (key) => key;
  it("maps the brand-kit service's 400s to friendly per-field copy", () => {
    const cases = [
      ["Brand tagline needs an Arabic text (English is optional)", "storeDesign:bilingual.error.en_only"],
      ["WhatsApp: Phone number is too short", "storeDesign:errors.whatsapp"],
      ["Invalid social link for: instagram", "storeDesign:errors.social_instagram"],
      ["Invalid social link for: x", "storeDesign:errors.generic"],
      ['Brand colour must look like "#1a2b3c"', "storeDesign:errors.color"],
      ["Cover image must be an https:// URL or an uploaded image", "storeDesign:errors.image"],
      ["Store name must be 2–100 characters", "storeDesign:errors.store_name"],
    ];
    for (const [serverMessage, key] of cases) {
      assert.equal(profileErrorMessage({ serverMessage, message: "localized" }, t), key, serverMessage);
    }
  });
  it("falls back to the already-localized message", () => {
    assert.equal(profileErrorMessage({ serverMessage: "Nothing to update", message: "localized" }, t), "localized");
    assert.equal(profileErrorMessage("offline text", t), "offline text");
    assert.equal(profileErrorMessage(null, t), "storeDesign:errors.generic");
  });
});
