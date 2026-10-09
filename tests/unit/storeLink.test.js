/**
 * Signup store-link helpers (dashboard/src/lib/storeLink.ts).
 *
 * The cases here are the real ones that broke onboarding: merchants pasted
 * their Facebook page URL into the subdomain field, pasted the example
 * "https://store-name.matjar.to" verbatim, or typed an Arabic store name that
 * produced an empty link. The module is dependency-free TypeScript, imported
 * directly via Node's built-in type stripping.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SUBDOMAIN_PATTERN,
  finalizeSubdomain,
  cleanInput,
  extractLink,
  hasArabic,
  insertedText,
  interpretLinkInput,
  looksLikeLink,
  sanitizeSubdomainTyping,
  slugLooksLikeLink,
  slugifyStoreName,
  transliterateArabic,
} from "../../dashboard/src/lib/storeLink.ts";

const DOMAIN = "matjar.to";

describe("slugifyStoreName", () => {
  it("keeps the existing Latin behaviour", () => {
    assert.equal(slugifyStoreName("Rivera & Co."), "rivera-and-co");
    assert.equal(slugifyStoreName("  Café  Nile  "), "cafe-nile");
  });

  it("produces a usable link from an Arabic-only store name (was empty before)", () => {
    const slug = slugifyStoreName("متجر النيل");
    assert.equal(slug, "mtjr-alnil");
    assert.match(slug, SUBDOMAIN_PATTERN);
  });

  it("handles diacritics, tatweel, Arabic-Indic digits and mixed scripts", () => {
    assert.equal(slugifyStoreName("عُطُور"), "ator");
    assert.equal(slugifyStoreName("بيـــت ٢٤"), "bit-24");
    assert.equal(slugifyStoreName("Nile عطور"), "nile-ator");
  });

  it("caps the length at the DNS label limit without a trailing hyphen", () => {
    const slug = slugifyStoreName(`${"a".repeat(62)} b`);
    assert.ok(slug.length <= 63);
    assert.match(slug, SUBDOMAIN_PATTERN);
  });
});

describe("transliterateArabic", () => {
  it("treats و/ي as consonants word-initially and vowels inside a word", () => {
    assert.equal(transliterateArabic("ورد"), "wrd");
    assert.equal(transliterateArabic("نور"), "nor");
    assert.equal(transliterateArabic("ياسمين"), "yasmin");
  });

  it("detects Arabic text", () => {
    assert.equal(hasArabic("متجر"), true);
    assert.equal(hasArabic("store"), false);
  });
});

describe("sanitizeSubdomainTyping / finalizeSubdomain", () => {
  it("allows a trailing hyphen mid-typing and tidies it on blur", () => {
    assert.equal(sanitizeSubdomainTyping("My-"), "my-");
    assert.equal(finalizeSubdomain("my-", DOMAIN), "my");
  });

  it("turns spaces/dots into hyphens and drops other characters", () => {
    assert.equal(sanitizeSubdomainTyping("Nile Store!"), "nile-store");
    assert.equal(sanitizeSubdomainTyping("nile.matjar.to"), "nile-matjar-to");
  });

  it("strips URL leftovers typed character by character", () => {
    assert.equal(finalizeSubdomain(sanitizeSubdomainTyping("https://www.nile.matjar.to"), DOMAIN), "nile");
    assert.equal(finalizeSubdomain("nile-matjar-to", DOMAIN), "nile");
  });
});

describe("looksLikeLink", () => {
  it("recognises URLs with or without a scheme", () => {
    for (const t of ["https://facebook.com/x", "www.nile.com", "facebook.com/nile", "nile.matjar.to"]) {
      assert.equal(looksLikeLink(t), true, t);
    }
  });

  it("does not treat plain names as links", () => {
    for (const t of ["nile", "nile-store", "متجر النيل", "my store.com shop"]) {
      assert.equal(looksLikeLink(t), false, t);
    }
  });
});

describe("interpretLinkInput", () => {
  it("extracts the name from a pasted store link", () => {
    assert.deepEqual(interpretLinkInput("https://nile.matjar.to", DOMAIN), { kind: "platform", slug: "nile" });
    assert.deepEqual(interpretLinkInput("nile.matjar.to/products", DOMAIN), { kind: "platform", slug: "nile" });
  });

  it("recognises our example link/name copied verbatim and suggests nothing from it", () => {
    assert.deepEqual(interpretLinkInput("https://store-name.matjar.to", DOMAIN), { kind: "example", slug: "" });
    assert.deepEqual(interpretLinkInput("matjar.to", DOMAIN), { kind: "example", slug: "" });
    assert.deepEqual(interpretLinkInput("store-name", DOMAIN), { kind: "example", slug: "" });
  });

  it("recognises a Facebook page, keeps its URL and suggests a slug from the page name", () => {
    const r = interpretLinkInput("https://www.facebook.com/NileStore.SD#about", DOMAIN);
    assert.equal(r.kind, "social");
    assert.equal(r.platform, "facebook");
    assert.equal(r.url, "https://www.facebook.com/NileStore.SD");
    assert.equal(r.slug, "nilestore-sd");
  });

  it("keeps the URL but suggests nothing for id-only Facebook links", () => {
    const r = interpretLinkInput("https://m.facebook.com/profile.php?id=1000123", DOMAIN);
    assert.equal(r.kind, "social");
    assert.equal(r.url, "https://m.facebook.com/profile.php?id=1000123");
    assert.equal(r.slug, "");
  });

  it("handles Instagram and TikTok handles", () => {
    assert.equal(interpretLinkInput("instagram.com/nile.store/", DOMAIN).slug, "nile-store");
    const tiktok = interpretLinkInput("https://www.tiktok.com/@nile_store", DOMAIN);
    assert.equal(tiktok.platform, "tiktok");
    assert.equal(tiktok.slug, "nile-store");
  });

  it("recognises WhatsApp links without storing them", () => {
    assert.deepEqual(interpretLinkInput("https://wa.me/249912345678", DOMAIN), { kind: "whatsapp", slug: "" });
  });

  it("suggests a slug from any other website's name", () => {
    assert.deepEqual(interpretLinkInput("https://shop.nile.com.sd/home", DOMAIN), { kind: "website", slug: "nile" });
  });

  it("does not mistake look-alike hosts for social platforms", () => {
    assert.equal(interpretLinkInput("https://facebook.com.evil.example/x", DOMAIN).kind, "website");
  });

  it("treats non-http schemes as plain text", () => {
    assert.equal(interpretLinkInput("javascript://alert(1)", DOMAIN).kind, "text");
  });

  it("cleans plain text", () => {
    assert.deepEqual(interpretLinkInput("  Nile Store ", DOMAIN), { kind: "text", slug: "nile-store" });
  });
});

describe("insertedText", () => {
  it("returns the inserted segment wherever the cursor was", () => {
    assert.equal(insertedText("", "https://facebook.com/x"), "https://facebook.com/x");
    assert.equal(insertedText("nile", "nilehttps://facebook.com/x"), "https://facebook.com/x");
    assert.equal(insertedText("ab", "aXYb"), "XY");
    assert.equal(insertedText("nile", "nil"), "");
  });
});

describe("links copied from Arabic-interface apps", () => {
  // Facebook/WhatsApp in Arabic wrap copied links in invisible direction
  // marks; before this fix they defeated detection entirely.
  const FB = "https://www.facebook.com/profile.php?id=61575300460050";
  for (const [name, wrapped] of [
    ["LRE/PDF embedding", `\u202A${FB}\u202C`],
    ["RLM marks", `\u200F${FB}\u200F`],
    ["LRI/PDI isolate", `\u2066${FB}\u2069`],
    ["zero-width space + NBSP", `\u200B\u00A0${FB}\u00A0`],
  ]) {
    it(`recognises a Facebook link wrapped in ${name}`, () => {
      const r = interpretLinkInput(wrapped, DOMAIN);
      assert.equal(r.kind, "social");
      assert.equal(r.url, FB);
    });
  }

  it("cleans invisible characters out of names too", () => {
    assert.equal(cleanInput("\u202Bمتجر النيل\u202C"), "متجر النيل");
    assert.equal(slugifyStoreName("\u200Fمتجر\u200F"), "mtjr");
  });

  it("finds a link pasted with words around it", () => {
    assert.equal(extractLink("صفحتي: https://facebook.com/nile."), "https://facebook.com/nile");
    assert.equal(interpretLinkInput("my page (facebook.com/nile.store)", DOMAIN).platform, "facebook");
    assert.equal(extractLink("متجر النيل"), null);
  });
});

describe("slugLooksLikeLink", () => {
  it("flags web addresses with their punctuation stripped", () => {
    for (const s of ["httpswwwfacebookcomprofilephpid6157530046005", "https-www-facebook-com-x", "www-nile-com", "facebook-com-nile", "nile-instagram-com", "wa-me-249912345678", "whatsapp-nile", "http-nile"]) {
      assert.equal(slugLooksLikeLink(s), true, s);
    }
  });
  it("leaves ordinary store names alone", () => {
    for (const s of ["nile-perfumes", "mtjr-alshms", "httpie", "wame", "fbshop", "www3", "tme"]) {
      assert.equal(slugLooksLikeLink(s), false, s);
    }
  });
});
