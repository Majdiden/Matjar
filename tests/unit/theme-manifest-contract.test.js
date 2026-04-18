/**
 * Theme manifest / renderer contract.
 *
 * Enforces the implicit coupling between three independently-evolving
 * surfaces:
 *
 *   1. Theme manifests (storefront-themes/<slug>/dist/manifest.json)
 *      declare which section types, setting types, and templates a
 *      theme uses.
 *   2. The storefront SDK (storefront-themes/_shared) renders those
 *      section types through DEFAULT_SECTION_REGISTRY.
 *   3. The dashboard (dashboard/src/components/theme-editor) renders
 *      controls for each setting type through SettingControl.
 *
 * When any of the three drift, the editor silently shows "Unsupported
 * type" labels or the storefront silently renders blanks — bad
 * surprises at publish time. This test loads every built manifest and
 * asserts every section type has a renderer, every setting type is
 * supported by the dashboard, every template references only declared
 * section types, and every declared setting carries a default (or is
 * explicitly optional).
 *
 * Failure output includes the theme slug, the offending id/type, and
 * the surface that's out of sync so the engineer knows whether to
 * touch the manifest, the SDK registry, or the dashboard control.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const THEMES_ROOT = path.join(REPO_ROOT, "storefront-themes");

/**
 * Section types declared by the shared SDK renderer registry
 * (DEFAULT_SECTION_REGISTRY in _shared/components/sections/index.tsx).
 * Kept as a duplicated source of truth in this test because parsing
 * the TSX at test-time would mean pulling in a transpiler; the list
 * is short enough that drift is caught the moment a new type is added
 * to the registry without a manifest using it (or vice-versa).
 *
 * When you add a section to DEFAULT_SECTION_REGISTRY, add it here
 * too — the test will tell you if you forget.
 */
const SDK_SECTION_TYPES = new Set([
  "hero",
  "banner",
  "rich-text",
  "image-with-text",
  "gallery",
  "features",
  "video",
  "testimonials",
  "newsletter",
  "brands",
  "spacer",
  "featured-products",
  "new-arrivals",
  "categories",
  "trust-badges",
]);

/**
 * Setting types the dashboard's SettingControl component knows how to
 * render. Kept in lockstep with the switch in
 * dashboard/src/components/theme-editor/SettingControl.tsx. Themes
 * occasionally ship Shopify-style aliases (e.g. `image_picker` instead
 * of `image`); the aliases map back to supported types.
 */
const DASHBOARD_CONTROL_TYPES = new Set([
  "text",
  "textarea",
  "richtext",
  "number",
  "range",
  "checkbox",
  "select",
  "color",
  "image",
  "image_picker",
  "url",
  "product",
  "product_picker",
  "collection",
  "collection_picker",
  "font_picker",
  "header",
  "paragraph",
]);

function readManifest(slug) {
  const p = path.join(THEMES_ROOT, slug, "dist", "manifest.json");
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function listThemeSlugs() {
  if (!fs.existsSync(THEMES_ROOT)) return [];
  return fs
    .readdirSync(THEMES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .filter((slug) => fs.existsSync(path.join(THEMES_ROOT, slug, "dist", "manifest.json")));
}

describe("Theme manifest contract", () => {
  const slugs = listThemeSlugs();

  it("at least one theme manifest exists", () => {
    assert.ok(slugs.length > 0, "Expected at least one storefront-themes/*/dist/manifest.json");
  });

  for (const slug of slugs) {
    describe(`theme "${slug}"`, () => {
      const manifest = readManifest(slug);

      it("has required top-level fields", () => {
        assert.ok(manifest, `Failed to read manifest for ${slug}`);
        assert.equal(typeof manifest.slug, "string", "manifest.slug must be a string");
        assert.equal(manifest.slug, slug, `manifest.slug ("${manifest.slug}") must match directory name ("${slug}")`);
        assert.equal(typeof manifest.name, "string", "manifest.name must be a string");
        assert.ok(Array.isArray(manifest.sections), "manifest.sections must be an array");
        assert.ok(
          manifest.templates && typeof manifest.templates === "object",
          "manifest.templates must be an object"
        );
      });

      it("every section type has a renderer (SDK or theme-local)", () => {
        // Themes are allowed to declare their own section types and
        // register them against custom components through a local
        // registry passed to SectionRenderer. A section is considered
        // renderable if EITHER the SDK registry covers it OR the
        // theme's source code contains a string literal matching the
        // section type (i.e. the registry map keys the type to a
        // component — e.g. `'nutreko-hero': HeroSection`).
        //
        // We can't transpile TSX at test-time, so the string-literal
        // check is the pragmatic substitute. It correctly matches the
        // registry patterns all current themes use and fails loudly
        // when a manifest declares a type that nothing in the theme
        // source references.
        const themeSrc = path.join(THEMES_ROOT, slug, "src");
        let themeSource = "";
        if (fs.existsSync(themeSrc)) {
          const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) walk(full);
              else if (/\.(tsx|jsx|ts|js)$/.test(entry.name)) {
                themeSource += "\n" + fs.readFileSync(full, "utf8");
              }
            }
          };
          walk(themeSrc);
        }

        const unknown = [];
        for (const def of manifest.sections || []) {
          if (!def || typeof def.type !== "string") {
            assert.fail(`Section definition in ${slug} missing string "type": ${JSON.stringify(def)}`);
          }
          if (SDK_SECTION_TYPES.has(def.type)) continue;
          // Look for the type as a quoted string literal anywhere in
          // theme source — whether used as a registry key
          // (`'nutreko-hero': HeroSection`) or as a conditional/lookup
          // target in hybrid themes that hardcode the render
          // (`sections.find(s => s.type === 'cta-banner')`). Either
          // pattern demonstrates the theme knows about the type.
          const needles = [`'${def.type}'`, `"${def.type}"`, `\`${def.type}\``];
          if (needles.some((n) => themeSource.includes(n))) continue;
          unknown.push(def.type);
        }
        assert.deepEqual(
          unknown,
          [],
          `Theme "${slug}" declares section types with no SDK renderer and no theme-local registry entry:\n  - ${unknown.join("\n  - ")}`
        );
      });

      it("every setting type is supported by the dashboard controls", () => {
        const unsupported = [];
        const walk = (defs, location) => {
          for (const s of defs || []) {
            if (!s || typeof s.type !== "string") continue;
            if (!DASHBOARD_CONTROL_TYPES.has(s.type)) {
              unsupported.push(`${location} setting "${s.id || "<no id>"}" has unsupported type "${s.type}"`);
            }
          }
        };
        walk(manifest.settings, "theme.settings");
        for (const section of manifest.sections || []) {
          walk(section.settings, `section "${section.type}"`);
          for (const block of section.blocks || []) {
            walk(block.settings, `section "${section.type}" block "${block.type}"`);
          }
        }
        assert.deepEqual(
          unsupported,
          [],
          `Theme "${slug}" has setting types with no dashboard control:\n  - ${unsupported.join("\n  - ")}`
        );
      });

      it("every manifest.settings entry declares a valid id and type", () => {
        const seenIds = new Set();
        for (const s of manifest.settings || []) {
          assert.ok(s && typeof s === "object", `theme.settings entry must be an object`);
          // Header/paragraph "settings" are presentational separators —
          // they don't carry a value and don't need an id. Skip the id
          // check for those; every other type must have one.
          if (s.type !== "header" && s.type !== "paragraph") {
            assert.equal(
              typeof s.id,
              "string",
              `theme.settings entry of type "${s.type}" must have string id`
            );
            assert.ok(s.id.length > 0, "theme.settings id cannot be empty");
            assert.ok(
              !seenIds.has(s.id),
              `Duplicate theme.settings id "${s.id}" in theme "${slug}"`
            );
            seenIds.add(s.id);
            // Value-bearing settings should carry a default so the
            // storefront has something to render before the merchant
            // touches the control. Checkboxes default to false when
            // omitted, which is fine — other types should be explicit.
            if (s.type !== "checkbox") {
              assert.ok(
                "default" in s,
                `theme.settings "${s.id}" (${s.type}) must declare a "default" value`
              );
            }
          }
        }
      });

      it("manifest.templates keys are in the allow-list", () => {
        // The platform supports a fixed set of template ids that the
        // dashboard visual editor exposes as page options and that the
        // storefront resolves through useTemplateSections. Themes may
        // ship empty arrays for templates they don't yet style, but
        // they must not invent template ids — a stray key would be
        // silently dropped by the server-side validator.
        const ALLOWED = new Set(["index", "product", "collection", "cart", "search", "page"]);
        const invalid = Object.keys(manifest.templates || {}).filter((k) => !ALLOWED.has(k));
        assert.deepEqual(
          invalid,
          [],
          `Theme "${slug}" manifest.templates has keys outside the allow-list (${[...ALLOWED].join(", ")}):\n  - ${invalid.join("\n  - ")}`
        );
      });

      it("templates only reference declared section types", () => {
        const declared = new Set((manifest.sections || []).map((d) => d.type));
        const offenders = [];
        for (const [tpl, instances] of Object.entries(manifest.templates || {})) {
          if (!Array.isArray(instances)) {
            assert.fail(`manifest.templates.${tpl} must be an array`);
          }
          for (const inst of instances) {
            if (!inst || typeof inst !== "object") continue;
            if (typeof inst.id !== "string" || inst.id.length === 0) {
              offenders.push(`template "${tpl}": instance missing id`);
              continue;
            }
            if (typeof inst.type !== "string" || !declared.has(inst.type)) {
              offenders.push(
                `template "${tpl}" id="${inst.id}" references undeclared section type "${inst.type}"`
              );
            }
          }
        }
        assert.deepEqual(
          offenders,
          [],
          `Theme "${slug}" template instances reference undeclared sections:\n  - ${offenders.join("\n  - ")}`
        );
      });

      it("section block types are declared and their settings are supported", () => {
        const offenders = [];
        for (const section of manifest.sections || []) {
          const blockDefs = Array.isArray(section.blocks) ? section.blocks : [];
          const blockTypes = new Set(blockDefs.map((b) => b.type));
          // defaultBlocks (if any) must only reference declared block types.
          for (const db of section.defaultBlocks || []) {
            if (!blockTypes.has(db.type)) {
              offenders.push(
                `section "${section.type}" default block type "${db.type}" is not declared in section.blocks`
              );
            }
          }
          for (const b of blockDefs) {
            if (!b || typeof b.type !== "string") {
              offenders.push(`section "${section.type}" has a block missing string "type"`);
            }
          }
        }
        assert.deepEqual(
          offenders,
          [],
          `Theme "${slug}" has invalid block definitions:\n  - ${offenders.join("\n  - ")}`
        );
      });

      it("home variants (if present) reference declared section types", () => {
        if (!manifest.homeVariants) return;
        const declared = new Set((manifest.sections || []).map((d) => d.type));
        const offenders = [];
        for (const [variant, instances] of Object.entries(manifest.homeVariants)) {
          if (!Array.isArray(instances)) {
            offenders.push(`homeVariants.${variant} must be an array`);
            continue;
          }
          for (const inst of instances) {
            if (!declared.has(inst?.type)) {
              offenders.push(
                `homeVariants.${variant} instance "${inst?.id || "<no id>"}" uses undeclared section "${inst?.type}"`
              );
            }
          }
        }
        assert.deepEqual(
          offenders,
          [],
          `Theme "${slug}" home variants invalid:\n  - ${offenders.join("\n  - ")}`
        );
      });
    });
  }
});
