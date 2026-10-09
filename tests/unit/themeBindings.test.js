/**
 * Brand-kit bindings, simple-mode levels and niche presets (PBI 10, tasks
 * 10-6 / 10-7 / 10-8).
 *
 *   1. Resolution precedence: merchant override → brand-kit value → manifest
 *      default, including the bilingual `<id>` / `<id>__ar` rule and blanks.
 *   2. The brand colour feeds the primary token unless the merchant changed it.
 *   3. Level helpers (`isBasicSetting` / `isBasicSection`).
 *   4. The manifest validator accepts and rejects `level` / `bind` / `presets`.
 *   5. Preset selection at store creation.
 *   6. Every built theme: annotations stay within the rules, and a store with
 *      no brand data resolves to exactly the settings it had before.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveBoundSettings,
  resolvePrimaryColor,
  brandSettingValues,
  isSettingOverridden,
  manifestInstanceDefaults,
  BRAND_BINDINGS,
} from "../../utils/themeBindings.js";
import {
  validateManifestExtensions,
  MAX_BASIC_SETTINGS_PER_SECTION,
} from "../../utils/themeManifestRules.js";
import {
  isBasicSetting,
  isBasicSection,
  basicSettingsOf,
  SETTING_LEVELS,
} from "../../storefront-themes/_shared/theme/settingLevels.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEMES_ROOT = path.resolve(__dirname, "..", "..", "storefront-themes");

const HERO_DEFS = [
  { id: "heading", type: "text", default: "" },
  { id: "subheading", type: "textarea", default: "", bind: "brand.tagline" },
  { id: "background_image", type: "image", bind: "brand.coverImage" },
  { id: "button_text", type: "text", default: "Shop" },
];
const HERO_DEFAULTS = { heading: "", subheading: "", button_text: "Shop" };

const BRAND = {
  name: "متجر النيل",
  logo: "/uploads/logo.png",
  brand: {
    tagline: { ar: "عطور أصلية", en: "Genuine perfumes" },
    coverImage: "https://cdn.example.com/cover.jpg",
    color: "#aa33cc",
  },
};

describe("brand binding resolution", () => {
  it("falls back to the manifest default when there is no brand kit", () => {
    const values = { ...HERO_DEFAULTS };
    const r = resolveBoundSettings(HERO_DEFS, values, HERO_DEFAULTS, { name: "Nile", logo: null, brand: null });
    assert.equal(r.settings, values, "same object: nothing is filled");
    assert.deepEqual(r.brandValues, {});
    assert.deepEqual(r.sources, {
      heading: "default",
      subheading: "default",
      background_image: "default",
      button_text: "default",
    });
  });

  it("fills unchanged bound settings from the brand kit (bilingual → base + __ar)", () => {
    const r = resolveBoundSettings(HERO_DEFS, { ...HERO_DEFAULTS }, HERO_DEFAULTS, BRAND);
    assert.equal(r.settings.subheading, "Genuine perfumes");
    assert.equal(r.settings.subheading__ar, "عطور أصلية");
    assert.equal(r.settings.background_image, "https://cdn.example.com/cover.jpg");
    assert.equal(r.settings.heading, "", "unbound settings keep their default");
    assert.equal(r.sources.subheading, "brand");
    assert.equal(r.sources.background_image, "brand");
    assert.equal(r.sources.heading, "default");
  });

  it("uses the Arabic text for both keys when there is no English", () => {
    const filled = brandSettingValues("subheading", "brand.tagline", { brand: { tagline: { ar: "عطور" } } });
    assert.deepEqual(filled, { subheading: "عطور", subheading__ar: "عطور" });
  });

  it("ignores a bilingual brand text without Arabic and blank brand values", () => {
    assert.equal(brandSettingValues("x", "brand.tagline", { brand: { tagline: { en: "Only English" } } }), null);
    assert.equal(brandSettingValues("x", "brand.coverImage", { brand: { coverImage: "  " } }), null);
    assert.equal(brandSettingValues("x", "brand.unknown", { brand: { unknown: "v" } }), null);
  });

  it("store.name and store.logo read the store, not the brand kit", () => {
    assert.deepEqual(brandSettingValues("title", "store.name", BRAND), { title: "متجر النيل" });
    assert.deepEqual(brandSettingValues("logo", "store.logo", BRAND), { logo: "/uploads/logo.png" });
    assert.equal(brandSettingValues("logo", "store.logo", { name: "x", logo: null }), null);
  });

  it("a merchant override wins over the brand kit — base key or Arabic twin", () => {
    const base = resolveBoundSettings(HERO_DEFS, { ...HERO_DEFAULTS, subheading: "My words" }, HERO_DEFAULTS, BRAND);
    assert.equal(base.settings.subheading, "My words");
    assert.equal(base.settings.subheading__ar, undefined);
    assert.equal(base.sources.subheading, "override");

    const twin = resolveBoundSettings(HERO_DEFS, { ...HERO_DEFAULTS, subheading__ar: "كلماتي" }, HERO_DEFAULTS, BRAND);
    assert.equal(twin.settings.subheading__ar, "كلماتي");
    assert.equal(twin.settings.subheading, "", "the merchant owns the whole setting");
    assert.equal(twin.sources.subheading, "override");
  });

  it("a value equal to the default, or blank like a blank default, is not an override", () => {
    assert.equal(isSettingOverridden("button_text", { button_text: "Shop" }, HERO_DEFAULTS), false);
    assert.equal(isSettingOverridden("subheading", { subheading: "   " }, HERO_DEFAULTS), false);
    assert.equal(isSettingOverridden("subheading", { subheading__ar: "" }, HERO_DEFAULTS), false);
    assert.equal(isSettingOverridden("background_image", {}, HERO_DEFAULTS), false);
    // Clearing a non-empty default is the merchant's choice.
    assert.equal(isSettingOverridden("button_text", { button_text: "" }, HERO_DEFAULTS), true);
  });

  it("instance defaults overlay the manifest template instance on the type defaults", () => {
    const manifest = {
      sections: [{ type: "hero", settings: HERO_DEFS }],
      templates: { index: [{ id: "hero", type: "hero", settings: { heading: "Hi" } }] },
      homeVariants: { alt: [{ id: "hero-alt", type: "hero", settings: { button_text: "Go" } }] },
    };
    const d = manifestInstanceDefaults(manifest);
    assert.deepEqual(d.forInstance("hero", "hero"), { ...HERO_DEFAULTS, heading: "Hi" });
    assert.deepEqual(d.forInstance("hero-alt", "hero"), { ...HERO_DEFAULTS, button_text: "Go" });
    assert.deepEqual(d.forInstance("hero-added", "hero"), HERO_DEFAULTS);
  });
});

describe("brand colour → primary token", () => {
  it("brand colour replaces an unchanged primary", () => {
    assert.deepEqual(resolvePrimaryColor("#2563eb", undefined, BRAND), { color: "#aa33cc", source: "brand" });
    assert.deepEqual(resolvePrimaryColor("#2563eb", "#2563EB", BRAND), { color: "#aa33cc", source: "brand" });
  });

  it("the merchant's own primary wins", () => {
    assert.deepEqual(resolvePrimaryColor("#2563eb", "#123456", BRAND), { color: "#123456", source: "override" });
  });

  it("no brand colour → the stored or manifest colour, unchanged", () => {
    assert.deepEqual(resolvePrimaryColor("#2563eb", undefined, { brand: null }), { color: "#2563eb", source: "default" });
    assert.deepEqual(resolvePrimaryColor("#2563eb", "#2563EB", { brand: null }), { color: "#2563EB", source: "default" });
  });
});

describe("simple-mode level helpers", () => {
  it("settings are advanced unless marked basic; sections are basic unless marked advanced", () => {
    assert.deepEqual([...SETTING_LEVELS], ["basic", "advanced"]);
    assert.equal(isBasicSetting({ id: "a" }), false);
    assert.equal(isBasicSetting({ id: "a", level: "basic" }), true);
    assert.equal(isBasicSetting({ id: "a", level: "advanced" }), false);
    assert.equal(isBasicSection({ type: "hero" }), true);
    assert.equal(isBasicSection({ type: "spacer", level: "advanced" }), false);
    assert.equal(isBasicSection(null), true);
    assert.deepEqual(
      basicSettingsOf({ settings: [{ id: "a", level: "basic" }, { id: "b" }] }).map((s) => s.id),
      ["a"]
    );
  });
});

const baseManifest = () => ({
  slug: "t",
  settings: [{ id: "hours", type: "text", default: "" }],
  sections: [
    { type: "hero", settings: [...HERO_DEFS], blocks: [{ type: "slide", settings: [{ id: "image", type: "image" }] }] },
    { type: "newsletter", limit: 1, settings: [{ id: "heading", type: "text", default: "" }] },
  ],
  templates: {
    index: [
      { id: "hero", type: "hero", settings: {} },
      { id: "newsletter", type: "newsletter", settings: {} },
    ],
  },
});

describe("manifest validator: level / bind / presets", () => {
  it("accepts a manifest without the new fields and a fully annotated one", () => {
    assert.deepEqual(validateManifestExtensions(baseManifest()), []);
    const m = baseManifest();
    m.settings[0].bind = "brand.hours";
    m.sections[0].level = "basic";
    m.sections[0].settings[0].level = "basic";
    m.sections[0].settings[1].level = "basic";
    m.sections[0].settings[2].level = "basic";
    m.sections[1].level = "advanced";
    m.presets = {
      food: { index: [{ id: "newsletter", type: "newsletter", settings: { heading: "Hi" } }, { id: "hero", type: "hero", settings: {}, disabled: true }] },
    };
    assert.deepEqual(validateManifestExtensions(m), []);
  });

  it("rejects unknown levels and too many basic settings", () => {
    const m = baseManifest();
    m.sections[0].level = "expert";
    m.sections[0].settings[0].level = "simple";
    const errors = validateManifestExtensions(m);
    assert.ok(errors.some((e) => /sections\[0\] \(hero\): level must be/.test(e)), errors.join("\n"));
    assert.ok(errors.some((e) => /settings\[0\] \(heading\): level must be/.test(e)), errors.join("\n"));

    const four = baseManifest();
    four.sections[0].settings.forEach((s) => (s.level = "basic"));
    assert.equal(four.sections[0].settings.length, MAX_BASIC_SETTINGS_PER_SECTION + 1);
    assert.ok(validateManifestExtensions(four).some((e) => /4 basic settings — at most 3/.test(e)));
  });

  it("rejects unknown bindings, incompatible setting types and bound block settings", () => {
    const m = baseManifest();
    m.sections[0].settings[0].bind = "brand.slogan";
    m.sections[0].settings[3].bind = "brand.coverImage"; // text ≠ image
    m.sections[0].blocks[0].settings[0].bind = "brand.coverImage";
    m.settings[0].type = "richtext";
    m.settings[0].bind = "brand.hours"; // brand text is never rendered as HTML
    const errors = validateManifestExtensions(m);
    assert.ok(errors.some((e) => /bind must be one of/.test(e)), errors.join("\n"));
    assert.ok(errors.some((e) => /bind "brand.coverImage" needs a image setting \(got "text"\)/.test(e)), errors.join("\n"));
    assert.ok(errors.some((e) => /not block settings/.test(e)), errors.join("\n"));
    assert.ok(errors.some((e) => /bind "brand.hours" needs a text or textarea setting \(got "richtext"\)/.test(e)), errors.join("\n"));
    assert.equal(BRAND_BINDINGS.length, 8);
  });

  it("rejects bad presets", () => {
    const cases = [
      [{ pets: { index: [] } }, /unknown niche/],
      [{ food: { sections: [] } }, /must be \{ index/],
      [{ food: { index: [{ id: "hero", type: "carousel", settings: {} }] } }, /not declared by the theme/],
      [{ food: { index: [{ id: "hero", type: "hero", settings: { nope: 1 } }, { id: "newsletter", type: "newsletter" }] } }, /unknown setting "nope"/],
      [{ food: { index: [{ id: "hero", type: "hero", settings: { subheading__ar: "x" } }, { id: "newsletter", type: "newsletter" }] } }, /must not set "subheading__ar" — it is bound to brand.tagline/],
      [{ food: { index: [{ id: "hero", type: "hero" }] } }, /missing section "newsletter"/],
      [{ food: { index: [{ id: "hero", type: "hero" }, { id: "hero", type: "hero" }, { id: "newsletter", type: "newsletter" }] } }, /duplicate section id "hero"/],
      [{ food: { index: [{ id: "hero", type: "hero" }, { id: "newsletter", type: "newsletter" }, { id: "n2", type: "newsletter" }] } }, /its limit is 1/],
      [[], /presets must be an object/],
    ];
    for (const [presets, re] of cases) {
      const m = baseManifest();
      m.presets = presets;
      const errors = validateManifestExtensions(m);
      assert.ok(errors.some((e) => re.test(e)), `${JSON.stringify(presets)} → ${errors.join(" | ")}`);
    }
  });
});

// ─── Built themes ────────────────────────────────────────────────

function builtManifests() {
  if (!fs.existsSync(THEMES_ROOT)) return [];
  return fs
    .readdirSync(THEMES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => path.join(THEMES_ROOT, d.name, "dist", "manifest.json"))
    .filter((p) => fs.existsSync(p))
    .map((p) => JSON.parse(fs.readFileSync(p, "utf8")));
}

describe("built themes", () => {
  const manifests = builtManifests();

  it("pass the level / bind / presets rules", (t) => {
    if (manifests.length === 0) return t.skip("no built themes (run npm run build-themes)");
    for (const m of manifests) {
      assert.deepEqual(validateManifestExtensions(m), [], `${m.slug}`);
    }
  });

  it("modern and starter are annotated: every section has 0–3 basic settings, the hero binds the brand kit", (t) => {
    const bySlug = new Map(manifests.map((m) => [m.slug, m]));
    if (!bySlug.has("modern") || !bySlug.has("starter")) return t.skip("modern/starter not built");
    for (const slug of ["modern", "starter"]) {
      const hero = bySlug.get(slug).sections.find((s) => s.type === "hero");
      const binds = Object.fromEntries(hero.settings.filter((s) => s.bind).map((s) => [s.id, s.bind]));
      assert.deepEqual(binds, { subheading: "brand.tagline", background_image: "brand.coverImage" }, slug);
      assert.ok(hero.settings.filter((s) => s.level === "basic").length >= 2, slug);
    }
  });

  it("a store with no brand data resolves every section and theme setting to exactly what it had", (t) => {
    if (manifests.length === 0) return t.skip("no built themes");
    const noBrand = { name: "Any store", logo: null, brand: null };
    let checked = 0;
    for (const m of manifests) {
      // store.name / store.logo are always set, so a theme must not bind
      // them where that would change today's rendering — none does.
      const storeBound = [
        ...(m.settings || []),
        ...m.sections.flatMap((s) => s.settings || []),
      ].filter((s) => s.bind === "store.name" || s.bind === "store.logo");
      assert.deepEqual(storeBound.map((s) => s.id), [], `${m.slug} binds store facts`);

      const defaults = manifestInstanceDefaults(m);
      const defsByType = new Map(m.sections.map((d) => [d.type, d]));
      const lists = [...Object.values(m.templates || {}), ...Object.values(m.homeVariants || {})];
      for (const inst of lists.flat()) {
        const def = defsByType.get(inst.type);
        if (!def) continue;
        const d = defaults.forInstance(inst.id, inst.type);
        const values = { ...d };
        const r = resolveBoundSettings(def.settings, values, d, noBrand);
        assert.equal(r.settings, values, `${m.slug}/${inst.id}`);
        assert.deepEqual(r.brandValues, {});
        checked++;
      }
      const globals = Object.fromEntries((m.settings || []).filter((s) => s.default !== undefined).map((s) => [s.id, s.default]));
      const g = resolveBoundSettings(m.settings, globals, globals, noBrand);
      assert.equal(g.settings, globals, `${m.slug} theme settings`);
      assert.equal(resolvePrimaryColor(m.colors.primary, m.colors.primary, noBrand).color, m.colors.primary);
    }
    assert.ok(checked > 0);
  });
});
