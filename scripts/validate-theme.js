#!/usr/bin/env node
/**
 * validate-theme.js — theme PACKAGE linter (audit 2.5)
 * ────────────────────────────────────────────────────
 *
 * Lints a BUILT theme package (its `dist/`), complementing
 * services/themeValidator.js which lints a tenant CUSTOMIZATION payload
 * at publish time. Both share the same rule tables via
 * utils/themeManifestRules.js — nothing is duplicated.
 *
 * Usage:
 *   node scripts/validate-theme.js <slug>
 *   node scripts/validate-theme.js storefront-themes/<slug>
 *
 * Called standalone, from scripts/build-themes.sh after each build, and
 * from CI. Exit code 0 = pass (warnings allowed), 1 = validation error.
 *
 * Checks:
 *   1. dist/manifest.json exists, parses, `slug` matches the directory,
 *      required fields present (name, version, templates.index).
 *   2. Every section type referenced in manifest.templates.* and
 *      manifest.homeVariants.* has a matching section definition.
 *   3. Every section definition's settings (and block settings) use a
 *      KNOWN SectionSetting type; number/range min/max coherent; select
 *      options present; declared defaults satisfy their own rules.
 *   4. Section `limit` values are coherent (positive integers) and the
 *      manifest's own default templates don't exceed them.
 *   5. Bundle sanity: exactly one JS + one CSS entry in dist/assets/,
 *      dist/index.html present, total dist under 5 MB (warn only).
 *   6. minPlatformVersion (if declared) is satisfiable by this platform.
 *
 * This script imports ONLY dependency-free modules (the rule tables and
 * the platform-version helper) so it never boots Mongo/Redis/config.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  KNOWN_SETTING_TYPES,
  ALLOWED_TEMPLATE_SET,
  ALLOWED_TEMPLATE_IDS,
  validateSettingValue,
} from "../utils/themeManifestRules.js";
import { PLATFORM_VERSION, platformSatisfies } from "../utils/platformVersion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const THEMES_ROOT = path.join(REPO_ROOT, "storefront-themes");

// Total dist size threshold (warn, not fail).
const MAX_DIST_BYTES = 5 * 1024 * 1024;

// ─── tiny reporter ───────────────────────────────────────────────
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ─── resolve slug + dist ─────────────────────────────────────────
function resolveSlug(arg) {
  if (!arg) return null;
  // Accept either a bare slug or a path like storefront-themes/foo[/].
  const base = path.basename(arg.replace(/\/+$/, ""));
  return base;
}

const slug = resolveSlug(process.argv[2]);
if (!slug) {
  console.error("Usage: node scripts/validate-theme.js <slug>");
  process.exit(2);
}

const themeDir = path.join(THEMES_ROOT, slug);
const distDir = path.join(themeDir, "dist");

// ─── 1. manifest existence + required fields ─────────────────────
const manifestPath = path.join(distDir, "manifest.json");
let manifest = null;
if (!fs.existsSync(manifestPath)) {
  err(`dist/manifest.json not found at ${path.relative(REPO_ROOT, manifestPath)} — build the theme first`);
} else {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (e) {
    err(`dist/manifest.json is not valid JSON: ${e.message}`);
  }
}

function sectionDefsByType(m) {
  const defs = Array.isArray(m.sections) ? m.sections : [];
  return new Map(defs.map((d) => [d.type, d]));
}

if (manifest) {
  if (manifest.slug !== slug) {
    err(`manifest.slug "${manifest.slug}" does not match theme directory "${slug}"`);
  }
  if (!manifest.name || typeof manifest.name !== "string") {
    err(`manifest.name is required (a non-empty string)`);
  }
  if (!manifest.version || typeof manifest.version !== "string") {
    err(`manifest.version is required (a non-empty string)`);
  }
  const templates = manifest.templates && typeof manifest.templates === "object" ? manifest.templates : null;
  if (!templates) {
    err(`manifest.templates is required (an object of template id → section list)`);
  } else if (!Array.isArray(templates.index)) {
    err(`manifest.templates.index is required (the home template's section list)`);
  }

  // ─── 2. referenced section types have definitions ──────────────
  const defsByType = sectionDefsByType(manifest);

  const checkTemplateRefs = (list, where) => {
    if (!Array.isArray(list)) return;
    list.forEach((s, i) => {
      if (!s || typeof s !== "object") {
        err(`${where}[${i}] is not a section object`);
        return;
      }
      if (!s.type || typeof s.type !== "string") {
        err(`${where}[${i}] is missing a "type"`);
        return;
      }
      if (!defsByType.has(s.type)) {
        err(`${where}[${i}] references section type "${s.type}" which has no definition in manifest.sections`);
      }
    });
  };

  if (templates) {
    for (const [tid, list] of Object.entries(templates)) {
      // Template ids outside the platform allow-list would never render.
      if (!ALLOWED_TEMPLATE_SET.has(tid)) {
        err(`manifest.templates.${tid} is not an allowed template id (allowed: ${ALLOWED_TEMPLATE_IDS.join(", ")})`);
        continue;
      }
      checkTemplateRefs(list, `templates.${tid}`);
    }
  }

  // homeVariants: alternate home layouts keyed by variant name.
  if (manifest.homeVariants && typeof manifest.homeVariants === "object") {
    for (const [variant, list] of Object.entries(manifest.homeVariants)) {
      checkTemplateRefs(list, `homeVariants.${variant}`);
    }
  }

  // ─── 3 & 4. section definitions: setting types, ranges, limits ─
  const validateSettingDef = (setting, where) => {
    if (!setting || typeof setting !== "object") {
      err(`${where} is not a setting object`);
      return;
    }
    if (!setting.id || typeof setting.id !== "string") {
      err(`${where} is missing an "id"`);
    }
    if (!setting.type || typeof setting.type !== "string") {
      err(`${where} is missing a "type"`);
      return;
    }
    if (!KNOWN_SETTING_TYPES.has(setting.type)) {
      err(`${where} uses unknown SectionSetting type "${setting.type}" (known: ${[...KNOWN_SETTING_TYPES].join(", ")})`);
      return;
    }
    // Coherence: number/range min/max ordering.
    if ((setting.type === "number" || setting.type === "range")) {
      if (typeof setting.min === "number" && typeof setting.max === "number" && setting.min > setting.max) {
        err(`${where}: min (${setting.min}) is greater than max (${setting.max})`);
      }
    }
    // select must declare options.
    if (setting.type === "select") {
      if (!Array.isArray(setting.options) || setting.options.length === 0) {
        err(`${where}: select setting must declare a non-empty "options" array`);
      }
    }
    // Declared default must satisfy the setting's OWN rules — reuse the
    // shared per-value validator so a bad default fails the package.
    if (setting.default !== undefined && setting.default !== null && setting.default !== "") {
      const defErrors = validateSettingValue(setting, setting.default, where);
      for (const e of defErrors) err(`${e} (declared default)`);
    }
  };

  const defs = Array.isArray(manifest.sections) ? manifest.sections : [];
  defs.forEach((def, di) => {
    const dWhere = `sections[${di}] (${def?.type || "?"})`;
    if (!def || typeof def !== "object") {
      err(`${dWhere} is not a section-definition object`);
      return;
    }
    if (!def.type || typeof def.type !== "string") {
      err(`${dWhere} is missing a "type"`);
    }
    if (def.limit !== undefined) {
      if (typeof def.limit !== "number" || !Number.isInteger(def.limit) || def.limit < 1) {
        err(`${dWhere}: limit must be a positive integer when declared (got ${JSON.stringify(def.limit)})`);
      }
    }
    (Array.isArray(def.settings) ? def.settings : []).forEach((s, si) => {
      validateSettingDef(s, `${dWhere} settings[${si}]`);
    });
    // Block-level settings.
    (Array.isArray(def.blocks) ? def.blocks : []).forEach((b, bi) => {
      const bWhere = `${dWhere} blocks[${bi}] (${b?.type || "?"})`;
      if (!b || typeof b !== "object" || !b.type) {
        err(`${bWhere} is missing a "type"`);
        return;
      }
      (Array.isArray(b.settings) ? b.settings : []).forEach((s, si) => {
        validateSettingDef(s, `${bWhere} settings[${si}]`);
      });
    });
  });

  // Manifest's own default templates must respect declared section limits.
  const limitByType = new Map(defs.filter((d) => typeof d?.limit === "number").map((d) => [d.type, d.limit]));
  const checkLimits = (list, where) => {
    if (!Array.isArray(list)) return;
    const counts = new Map();
    for (const s of list) {
      if (s && s.type) counts.set(s.type, (counts.get(s.type) || 0) + 1);
    }
    for (const [type, count] of counts) {
      const lim = limitByType.get(type);
      if (typeof lim === "number" && count > lim) {
        err(`${where}: section type "${type}" appears ${count} times but its limit is ${lim}`);
      }
    }
  };
  if (templates) {
    for (const [tid, list] of Object.entries(templates)) checkLimits(list, `templates.${tid}`);
  }

  // ─── 6. minPlatformVersion satisfiable ─────────────────────────
  const minVer =
    manifest.minPlatformVersion ||
    manifest.compatibility?.minPlatformVersion ||
    null;
  if (minVer && !platformSatisfies(minVer)) {
    err(`manifest.minPlatformVersion "${minVer}" is not satisfied by platform version ${PLATFORM_VERSION}`);
  }
}

// ─── 5. bundle sanity ────────────────────────────────────────────
if (fs.existsSync(distDir)) {
  const assetsDir = path.join(distDir, "assets");
  if (!fs.existsSync(assetsDir)) {
    err(`dist/assets/ is missing — the bundle did not emit its JS/CSS`);
  } else {
    const assetFiles = fs.readdirSync(assetsDir);
    const jsEntries = assetFiles.filter((f) => f.endsWith(".js"));
    const cssEntries = assetFiles.filter((f) => f.endsWith(".css"));
    if (jsEntries.length !== 1) {
      err(`dist/assets/ must contain exactly one JS entry (found ${jsEntries.length}: ${jsEntries.join(", ") || "none"}) — the preview asset-rewrite in storefrontServe.js depends on a single JS bundle (no code-split chunks)`);
    }
    if (cssEntries.length !== 1) {
      err(`dist/assets/ must contain exactly one CSS entry (found ${cssEntries.length}: ${cssEntries.join(", ") || "none"})`);
    }
  }

  if (!fs.existsSync(path.join(distDir, "index.html"))) {
    err(`dist/index.html is missing`);
  }

  // Total dist size (warn only).
  const dirSize = (dir) => {
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) total += dirSize(p);
      else total += fs.statSync(p).size;
    }
    return total;
  };
  const total = dirSize(distDir);
  if (total > MAX_DIST_BYTES) {
    warn(`dist is ${(total / 1024 / 1024).toFixed(2)} MB — over the ${(MAX_DIST_BYTES / 1024 / 1024).toFixed(0)} MB soft budget`);
  }
} else {
  err(`dist/ directory not found at ${path.relative(REPO_ROOT, distDir)} — build the theme first`);
}

// ─── report ──────────────────────────────────────────────────────
for (const w of warnings) console.warn(`  ⚠ ${slug}: ${w}`);
if (errors.length === 0) {
  console.log(`  ✓ ${slug}: theme package valid${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
  process.exit(0);
}
console.error(`  ✗ ${slug}: ${errors.length} validation error(s):`);
for (const e of errors) console.error(`      - ${e}`);
process.exit(1);
