/**
 * Parity: backend utils/slugify.js vs dashboard/src/lib/storeLink.ts.
 *
 * The dashboard previews a product's link with storeLink.ts while the server
 * stores what utils/slugify.js produces. The mapping is duplicated (one is
 * TypeScript for the browser, one plain JS for Node), so this test fails the
 * moment the two drift. storeLink.ts is imported via Node's type stripping.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  slugify,
  transliterateArabic as backendTransliterate,
} from "../../utils/slugify.js";
import {
  SUBDOMAIN_MAX_LENGTH,
  slugifyLink,
  slugifyStoreName,
  transliterateArabic as dashboardTransliterate,
} from "../../dashboard/src/lib/storeLink.ts";

// Every Arabic letter the mapping knows, plus the cases that matter in
// practice: semivowels at word start vs inside, hamza forms, taa marbuta,
// Persian letters, diacritics, tatweel, both digit sets, mixed scripts.
const SAMPLES = [
  "عطر الورد",
  "متجر النيل",
  "قهوة سودانية",
  "ذهب وفضة",
  "يوسف للأزياء",
  "بيـــت ٢٤",
  "عُطُور",
  "مقاس ۳",
  "إبريق آمن ٱلأصل ؤ ئ ء",
  "ثوب خفيف غامق ظل ضوء صابون شاي",
  "پ چ ڤ گ ک ی",
  "قميص Polo أزرق",
  "Café & Co.",
  "Men's Shoes 2024",
  "Nile Perfumes",
  "",
  "😀",
];

describe("slugify parity (utils/slugify.js ↔ dashboard storeLink.ts)", () => {
  it("transliterates every sample identically", () => {
    for (const s of SAMPLES) {
      assert.equal(backendTransliterate(s), dashboardTransliterate(s), `transliterate(${JSON.stringify(s)})`);
    }
  });

  it("slugify matches the dashboard's link preview (slugifyLink)", () => {
    // slugifyLink also strips invisible format characters — test those too.
    for (const s of [...SAMPLES, "‏عطر‎ ورد⁦", "عطر الورد"]) {
      assert.equal(slugify(s), slugifyLink(s), `slugify(${JSON.stringify(s)})`);
    }
  });

  it("slugify capped at the subdomain length matches slugifyStoreName", () => {
    const long = "متجر النيل للعطور والبخور السودانية الأصلية من أم درمان والخرطوم";
    for (const s of [...SAMPLES, long]) {
      assert.equal(
        slugify(s, { maxLength: SUBDOMAIN_MAX_LENGTH }),
        slugifyStoreName(s),
        `slugifyStoreName(${JSON.stringify(s)})`
      );
    }
  });
});
