/**
 * Language-pair order in the dashboard (dashboard/src/lib/languageOrder.ts):
 * the current UI language's field comes first, the other one second, and each
 * input follows its own language's direction. Stored base + translations
 * turn into one Arabic and one English box, and back.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  uiLang,
  languageOrder,
  uiLanguageFirst,
  langDir,
  hasArabicLetters,
  storeLanguage,
  splitByLanguage,
  readLangText,
  writeLangText,
  writeLangFields,
  isLangTextEmpty,
  langTextIn,
} from "../../dashboard/src/lib/languageOrder.ts";

describe("uiLang", () => {
  it("reads i18next language codes, Arabic when unknown", () => {
    assert.equal(uiLang("ar"), "ar");
    assert.equal(uiLang("ar-SD"), "ar");
    assert.equal(uiLang("en"), "en");
    assert.equal(uiLang("en-US"), "en");
    assert.equal(uiLang("EN"), "en");
    assert.equal(uiLang(""), "ar");
    assert.equal(uiLang(undefined), "ar");
    assert.equal(uiLang("fr"), "ar");
  });
});

describe("languageOrder", () => {
  it("puts the UI language first", () => {
    assert.deepEqual(languageOrder("ar"), ["ar", "en"]);
    assert.deepEqual(languageOrder("en-GB"), ["en", "ar"]);
  });
});

describe("uiLanguageFirst", () => {
  const fields = [
    { lang: "en", id: "title" },
    { lang: "en", id: "body" },
    { lang: "ar", id: "title-ar" },
    { lang: "ar", id: "body-ar" },
  ];

  it("moves the UI language's fields first and keeps their order", () => {
    assert.deepEqual(uiLanguageFirst(fields, "ar").map((f) => f.id), ["title-ar", "body-ar", "title", "body"]);
    assert.deepEqual(uiLanguageFirst(fields, "en").map((f) => f.id), ["title", "body", "title-ar", "body-ar"]);
  });

  it("does not change the input list", () => {
    const before = fields.map((f) => f.id);
    uiLanguageFirst(fields, "ar");
    assert.deepEqual(fields.map((f) => f.id), before);
  });

  it("orders a pair the same whichever way it is written", () => {
    const arFirst = [{ lang: "ar" }, { lang: "en" }];
    const enFirst = [{ lang: "en" }, { lang: "ar" }];
    for (const ui of ["ar", "en"]) {
      assert.deepEqual(uiLanguageFirst(arFirst, ui), uiLanguageFirst(enFirst, ui));
      assert.equal(uiLanguageFirst(arFirst, ui)[0].lang, ui);
    }
  });
});

describe("langDir", () => {
  it("gives each input its own language's direction", () => {
    assert.equal(langDir("ar"), "rtl");
    assert.equal(langDir("en"), "ltr");
  });
});

describe("hasArabicLetters / storeLanguage", () => {
  it("spots Arabic letters", () => {
    assert.equal(hasArabicLetters("عطر"), true);
    assert.equal(hasArabicLetters("Oud عود"), true);
    assert.equal(hasArabicLetters("Oud 12"), false);
    assert.equal(hasArabicLetters("٣٤"), true);
    assert.equal(hasArabicLetters(""), false);
    assert.equal(hasArabicLetters(undefined), false);
  });

  it("reads the store language from settings or the cached locale, Arabic by default", () => {
    assert.equal(storeLanguage("en"), "en");
    assert.equal(storeLanguage("en-US"), "en");
    assert.equal(storeLanguage("ar-SD"), "ar");
    assert.equal(storeLanguage(null), "ar");
    assert.equal(storeLanguage("fr"), "ar");
  });
});

describe("splitByLanguage / readLangText (load)", () => {
  it("quick add: Arabic in the base only goes to the Arabic box", () => {
    assert.deepEqual(splitByLanguage("عطر العود", {}), { ar: "عطر العود", en: "" });
  });

  it("old forms: English base + Arabic translation", () => {
    assert.deepEqual(splitByLanguage("Oud perfume", { ar: "عطر العود" }), { ar: "عطر العود", en: "Oud perfume" });
  });

  it("seeded menus: store language in the base + English translation", () => {
    assert.deepEqual(splitByLanguage("الرئيسية", { ar: "الرئيسية", en: "Home" }), { ar: "الرئيسية", en: "Home" });
    assert.deepEqual(splitByLanguage("Home", { ar: "الرئيسية", en: "Home" }), { ar: "الرئيسية", en: "Home" });
  });

  it("translations win over the base; nothing stored is two empty boxes", () => {
    assert.deepEqual(splitByLanguage("Base", { ar: "عربي", en: "English" }), { ar: "عربي", en: "English" });
    assert.deepEqual(splitByLanguage(undefined, null), { ar: "", en: "" });
  });

  it("reads a field of a stored document", () => {
    const product = { name: "عطر", translations: { en: { name: "Perfume" }, ar: { name: "" } } };
    assert.deepEqual(readLangText(product, "name"), { ar: "عطر", en: "Perfume" });
    assert.deepEqual(readLangText({ title: "Care" }, "title"), { ar: "", en: "Care" });
    assert.deepEqual(readLangText(null, "label"), { ar: "", en: "" });
  });
});

describe("writeLangText / writeLangFields (save)", () => {
  it("writes both translations and puts the store language in the base", () => {
    assert.deepEqual(writeLangText({ ar: " عطر ", en: " Perfume " }, "ar"), { ar: "عطر", en: "Perfume", base: "عطر" });
    assert.deepEqual(writeLangText({ ar: "عطر", en: "Perfume" }, "en"), { ar: "عطر", en: "Perfume", base: "Perfume" });
  });

  it("falls back to the other language and clears an emptied translation with ''", () => {
    assert.deepEqual(writeLangText({ ar: "", en: "Perfume" }, "ar"), { ar: "", en: "Perfume", base: "Perfume" });
    assert.deepEqual(writeLangText({ ar: "عطر", en: "  " }, "en"), { ar: "عطر", en: "", base: "عطر" });
  });

  it("round-trips legacy data without losing text", () => {
    const stored = { name: "Oud perfume", translations: { ar: { name: "عطر العود" } } };
    const out = writeLangText(readLangText(stored, "name"), "ar");
    assert.deepEqual(out, { ar: "عطر العود", en: "Oud perfume", base: "عطر العود" });
  });

  it("builds a payload for several fields", () => {
    const out = writeLangFields({ name: { ar: "عطر", en: "Perfume" }, description: { ar: "", en: "Nice" } }, "ar");
    assert.deepEqual(out, {
      base: { name: "عطر", description: "Nice" },
      translations: { ar: { name: "عطر", description: "" }, en: { name: "Perfume", description: "Nice" } },
    });
  });
});

describe("isLangTextEmpty / langTextIn", () => {
  it("needs one language filled", () => {
    assert.equal(isLangTextEmpty({ ar: " ", en: "" }), true);
    assert.equal(isLangTextEmpty({ ar: "", en: "x" }), false);
  });

  it("shows the text in the given language, else the other", () => {
    assert.equal(langTextIn({ ar: "عطر", en: "Perfume" }, "ar"), "عطر");
    assert.equal(langTextIn({ ar: "عطر", en: "Perfume" }, "en"), "Perfume");
    assert.equal(langTextIn({ ar: "عطر", en: "" }, "en"), "عطر");
  });
});
