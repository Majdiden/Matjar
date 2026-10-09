/**
 * Parity: backend utils/themeBindings.js (+ the level and niche constants)
 * vs storefront-themes/_shared/theme/brandBindings.ts and settingLevels.ts.
 *
 * The storefront resolves brand bindings while rendering; the backend uses
 * the same rule to tell the dashboard where each value comes from. The rule
 * is duplicated (TypeScript for the browser, plain JS for Node), so this test
 * runs both over the same cases and fails the moment they drift. The .ts
 * files are imported via Node's type stripping.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as backend from "../../utils/themeBindings.js";
import { SETTING_LEVELS, MAX_BASIC_SETTINGS_PER_SECTION } from "../../utils/themeManifestRules.js";
import { STORE_NICHES } from "../../config/storeNiches.js";
import * as shared from "../../storefront-themes/_shared/theme/brandBindings.ts";
import * as sharedLevels from "../../storefront-themes/_shared/theme/settingLevels.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFS = [
  { id: "title", type: "text", bind: "store.name" },
  { id: "logo", type: "image", bind: "store.logo" },
  { id: "subheading", type: "textarea", default: "", bind: "brand.tagline" },
  { id: "cover", type: "image", bind: "brand.coverImage" },
  { id: "accent", type: "color", default: "#000000", bind: "brand.color" },
  { id: "phone", type: "text", default: "", bind: "brand.whatsapp" },
  { id: "city", type: "text", default: "Town", bind: "brand.city" },
  { id: "hours", type: "textarea", bind: "brand.hours" },
  { id: "plain", type: "text", default: "x" },
];
const DEFAULTS = { subheading: "", accent: "#000000", phone: "", city: "Town", plain: "x" };

const SOURCES = [
  null,
  { name: "", logo: null, brand: null },
  { name: "Nile", logo: "/uploads/l.png", brand: null },
  {
    name: "متجر",
    logo: "https://cdn.example.com/l.png",
    brand: {
      tagline: { ar: "عطور", en: "Perfume" },
      coverImage: "/uploads/c.jpg",
      color: "#aa33cc",
      whatsapp: "+249912345678",
      city: { ar: "الخرطوم" },
      hours: { en: "English only" },
    },
  },
];

const VALUE_SETS = [
  {},
  { ...DEFAULTS },
  { ...DEFAULTS, subheading: "Mine", city: "", accent: "#000000" },
  { ...DEFAULTS, subheading__ar: "لي", phone: "  ", hours__ar: "" },
  { title: "Custom", logo: "/uploads/x.png", cover: "", plain: "y" },
];

describe("brand binding parity (backend ↔ storefront)", () => {
  it("shares the same constants", () => {
    assert.deepEqual([...backend.BRAND_BINDINGS], [...shared.BRAND_BINDINGS]);
    assert.deepEqual([...backend.BILINGUAL_BRAND_BINDINGS], [...shared.BILINGUAL_BRAND_BINDINGS]);
    assert.deepEqual(
      JSON.parse(JSON.stringify(backend.BRAND_BINDING_SETTING_TYPES)),
      JSON.parse(JSON.stringify(shared.BRAND_BINDING_SETTING_TYPES))
    );
    assert.deepEqual([...backend.SETTING_SOURCES], [...shared.SETTING_SOURCES]);
    assert.equal(backend.ARABIC_SETTING_SUFFIX, shared.ARABIC_SETTING_SUFFIX);
    assert.equal(backend.BRAND_COLOR_TOKEN, shared.BRAND_COLOR_TOKEN);
  });

  it("shares the level constants", () => {
    assert.deepEqual([...SETTING_LEVELS], [...sharedLevels.SETTING_LEVELS]);
    assert.equal(MAX_BASIC_SETTINGS_PER_SECTION, sharedLevels.MAX_BASIC_SETTINGS_PER_SECTION);
  });

  it("niche ids match the backend, the theme SDK and the signup screen", () => {
    assert.deepEqual([...STORE_NICHES], [...shared.NICHE_IDS]);
    const register = fs.readFileSync(path.resolve(__dirname, "../../dashboard/src/pages/Register.tsx"), "utf8");
    const m = /const NICHE_IDS = \[([^\]]+)\]/.exec(register);
    assert.ok(m, "Register.tsx declares NICHE_IDS");
    const dashboard = [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
    assert.deepEqual(dashboard, [...STORE_NICHES]);
  });

  it("resolves every case identically", () => {
    let cases = 0;
    for (const source of SOURCES) {
      for (const values of VALUE_SETS) {
        const a = backend.resolveBoundSettings(DEFS, values, DEFAULTS, source);
        const b = shared.resolveBoundSettings(DEFS, values, DEFAULTS, source);
        assert.deepEqual(a, b, JSON.stringify({ source, values }));
        assert.equal(a.settings === values, b.settings === values, "same identity rule");
        for (const binding of backend.BRAND_BINDINGS) {
          assert.deepEqual(
            backend.brandSettingValues("k", binding, source),
            shared.brandSettingValues("k", binding, source),
            binding
          );
        }
        for (const stored of [undefined, null, "", "#2563EB", "#2563eb", "#123456"]) {
          assert.deepEqual(
            backend.resolvePrimaryColor("#2563eb", stored, source),
            shared.resolvePrimaryColor("#2563eb", stored, source)
          );
        }
        cases++;
      }
    }
    assert.equal(cases, SOURCES.length * VALUE_SETS.length);
  });
});
