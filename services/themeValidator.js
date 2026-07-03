/**
 * Theme Customization Validator
 * ─────────────────────────────
 *
 * Full, strict validation of a tenant's customization payload against
 * the active theme manifest. This is the single gate that guarantees
 * the on-disk published snapshot is *always* consistent with what the
 * theme declares, so the storefront renderer can trust every section,
 * setting, and block it encounters.
 *
 * Why strict (not permissive + sanitize):
 *
 *   Historically the publish pipeline ran a permissive validator that
 *   only flagged unknown section types, then silently stripped unknown
 *   setting keys and out-of-range values in a separate "sanitize"
 *   pass. That hid merchant mistakes — a typo'd setting id would
 *   silently disappear, and a bad range value would silently clamp,
 *   which meant the editor could show one state while the published
 *   snapshot contained another. The storefront then drifted from the
 *   merchant's intent without anyone knowing.
 *
 *   Strict validation fails loudly on any mismatch so the editor can
 *   surface it, and the merchant fixes the draft before it can go
 *   live. A rejected publish is infinitely safer than a silent data
 *   loss in the snapshot.
 *
 * Rule-table extraction (audit 2.5):
 *
 *   The primitive value patterns, setting-type rules, template
 *   allow-list, and per-value validators used to live inline here.
 *   They now live in `utils/themeManifestRules.js` so the theme-PACKAGE
 *   linter (`scripts/validate-theme.js`) can share the EXACT same rules
 *   without booting the backend. This module keeps the manifest-aware
 *   layers (sections, blocks, global buckets, per-template limits) and
 *   the public API below unchanged.
 *
 * Return shape:
 *
 *   { valid: boolean, errors: string[] }
 *
 *   The caller treats a non-empty `errors` array as a publish block
 *   and propagates the messages to the editor. Error strings are
 *   human-readable and include the offending id/type/key so the
 *   editor can highlight the exact control at fault.
 */

import { getThemeManifest } from "./themeManifestRegistry.js";
import {
  ALLOWED_TEMPLATE_IDS,
  ALLOWED_TEMPLATE_SET,
  TEMPLATE_METADATA,
  TYPOGRAPHY_LENGTH_KEYS,
  SAFE_SETTING_ID_RE,
  hasCssInjectionMarker,
  validateCssColor,
  validateFontStack,
  validateLayoutValue,
  validateSettingValue,
  validateSettingsBag,
} from "../utils/themeManifestRules.js";

// ─── Template allow-list (re-exported) ───────────────────────────
//
// Kept as named re-exports so existing importers
// (services/themeCustomization.js, controllers/themeCustomization.js)
// don't have to change their import paths.
export { ALLOWED_TEMPLATE_IDS, TEMPLATE_METADATA };

/**
 * Validate a caller-supplied template id. Returns the canonical id on
 * success; throws on anything outside the allow-list. Used by the
 * section-CRUD routes/services so a typo or tampered query string
 * can't spawn a rogue template bucket.
 */
export function assertValidTemplateId(templateId) {
  if (typeof templateId !== "string" || !ALLOWED_TEMPLATE_SET.has(templateId)) {
    const err = new Error(
      `Invalid template id "${templateId}". Allowed: ${ALLOWED_TEMPLATE_IDS.join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }
  return templateId;
}

export function isValidTemplateId(templateId) {
  return typeof templateId === "string" && ALLOWED_TEMPLATE_SET.has(templateId);
}

// ─── Section / block validation ──────────────────────────────────

/**
 * Validate a single block instance against its declared block
 * definition.
 */
function validateBlock(block, blockDefsByType, sectionPrefix, index) {
  const errors = [];
  const prefix = `${sectionPrefix} block[${index}]`;
  if (!block || typeof block !== "object") {
    errors.push(`${prefix}: block entry is not an object`);
    return errors;
  }
  if (!block.type || typeof block.type !== "string") {
    errors.push(`${prefix}: missing or invalid "type"`);
    return errors;
  }
  const def = blockDefsByType.get(block.type);
  if (!def) {
    errors.push(`${prefix}: unknown block type "${block.type}"`);
    return errors;
  }
  errors.push(...validateSettingsBag(block.settings, def.settings, `${prefix} (${block.type})`));
  return errors;
}

/**
 * Validate a single section instance against its manifest definition.
 */
function validateSection(section, sectionDefsByType, index) {
  const errors = [];
  if (!section || typeof section !== "object") {
    errors.push(`Section at index ${index}: entry is not an object`);
    return errors;
  }
  if (!section.id || typeof section.id !== "string") {
    errors.push(`Section at index ${index}: missing or invalid "id"`);
  }
  if (!section.type || typeof section.type !== "string") {
    errors.push(`Section "${section.id || `<index ${index}>`}": missing or invalid "type"`);
    return errors;
  }

  const def = sectionDefsByType.get(section.type);
  if (!def) {
    errors.push(
      `Section type "${section.type}" is not declared by theme "${section.__themeSlug || "active"}"`
    );
    return errors;
  }

  const prefix = `Section "${section.id}" (${section.type})`;

  // Settings validation — strict: unknown keys are a hard error.
  errors.push(...validateSettingsBag(section.settings, def.settings, prefix));

  // Blocks validation.
  if (section.blocks != null) {
    if (!Array.isArray(section.blocks)) {
      errors.push(`${prefix}: blocks must be an array`);
    } else if (section.blocks.length > 0) {
      const blockDefs = Array.isArray(def.blocks) ? def.blocks : [];
      if (blockDefs.length === 0) {
        errors.push(`${prefix}: section type does not accept blocks`);
      } else {
        const blockDefsByType = new Map(blockDefs.map((b) => [b.type, b]));

        // Per-block-type count must respect the block definition's
        // `limit` (if any).
        const countsByType = new Map();
        for (let i = 0; i < section.blocks.length; i++) {
          const b = section.blocks[i];
          errors.push(...validateBlock(b, blockDefsByType, prefix, i));
          if (b && b.type) {
            countsByType.set(b.type, (countsByType.get(b.type) || 0) + 1);
          }
        }
        for (const [type, count] of countsByType) {
          const blockDef = blockDefsByType.get(type);
          if (blockDef && typeof blockDef.limit === "number" && count > blockDef.limit) {
            errors.push(
              `${prefix}: block type "${type}" exceeds its limit of ${blockDef.limit} (found ${count})`
            );
          }
        }
      }
    }
  }

  return errors;
}

// ─── Global settings validation ──────────────────────────────────
//
// The three "standard" buckets (colors/typography/layout) are typed
// structurally — every key in colors is a color, every key in layout
// is a length/number, every key in typography is either a font stack
// or a length (fontSize, lineHeight). We validate them keyswise so a
// merchant editing an ad-hoc color token ("--color-accent-soft") still
// gets CSS-safe enforcement even if the manifest didn't declare it.
//
// The fourth bucket — `theme` — carries merchant overrides of the
// manifest-level `settings[]` array (Shopify-style global settings
// like "Show announcement bar", "Logo width", "Primary CTA color"). We
// validate it key-by-key against the manifest's declared types, exactly
// the same way per-section settings are validated, so typo'd keys and
// out-of-range values fail the publish instead of silently disappearing.

function validateSettingsKey(key, errors, prefix) {
  if (!SAFE_SETTING_ID_RE.test(key)) {
    errors.push(`${prefix}: setting key "${key}" contains forbidden characters`);
    return false;
  }
  return true;
}

function validateColorsBucket(colors, errors) {
  if (colors == null) return;
  if (typeof colors !== "object" || Array.isArray(colors)) {
    errors.push("settings.colors must be an object");
    return;
  }
  for (const [key, value] of Object.entries(colors)) {
    if (!validateSettingsKey(key, errors, "settings.colors")) continue;
    validateCssColor(value, `settings.colors.${key}`, errors);
  }
}

function validateTypographyBucket(typography, errors) {
  if (typography == null) return;
  if (typeof typography !== "object" || Array.isArray(typography)) {
    errors.push("settings.typography must be an object");
    return;
  }
  for (const [key, value] of Object.entries(typography)) {
    if (!validateSettingsKey(key, errors, "settings.typography")) continue;
    if (TYPOGRAPHY_LENGTH_KEYS.has(key)) {
      // lineHeight is commonly unitless; layout validator already
      // accepts unitless numbers + CSS lengths.
      validateLayoutValue(value, `settings.typography.${key}`, errors, {
        clampMin: 0,
        clampMax: 1000,
      });
    } else {
      // Default: treat as font stack (fontFamily, headingFontFamily, ...).
      validateFontStack(value, `settings.typography.${key}`, errors);
    }
  }
}

function validateLayoutBucket(layout, errors) {
  if (layout == null) return;
  if (typeof layout !== "object" || Array.isArray(layout)) {
    errors.push("settings.layout must be an object");
    return;
  }
  for (const [key, value] of Object.entries(layout)) {
    if (!validateSettingsKey(key, errors, "settings.layout")) continue;
    // Headers/footers/layout style: accept a small string enum list
    // without unit grammar. Anything else gets the CSS-length rule.
    if (
      typeof value === "string" &&
      /^(standard|minimal|centered|expanded|transparent|wide|boxed|rounded|square|pill)$/i.test(value.trim())
    ) {
      // Keyword layout values — still guard against injection.
      const marker = hasCssInjectionMarker(value.trim());
      if (marker) {
        errors.push(
          `settings.layout.${key} contains forbidden CSS construct (${marker})`
        );
      }
      continue;
    }
    validateLayoutValue(value, `settings.layout.${key}`, errors, {
      clampMin: 0,
      clampMax: 10000,
    });
  }
}

/**
 * Validate the `theme` bucket — merchant overrides of manifest-level
 * `settings[]`. Unknown keys are rejected against the manifest's
 * declared setting ids; known keys run through the same per-type
 * validator used for section settings (so a manifest "color" setting
 * inside theme.settings gets the same CSS-safety treatment).
 */
function validateThemeBucket(themeSettings, manifestSettings, errors) {
  if (themeSettings == null) return;
  if (typeof themeSettings !== "object" || Array.isArray(themeSettings)) {
    errors.push("settings.theme must be an object");
    return;
  }
  const defs = Array.isArray(manifestSettings) ? manifestSettings : [];
  const defsById = new Map(defs.map((d) => [d.id, d]));
  for (const [key, value] of Object.entries(themeSettings)) {
    if (!validateSettingsKey(key, errors, "settings.theme")) continue;
    const def = defsById.get(key);
    if (!def) {
      errors.push(`settings.theme: unknown setting "${key}" (not declared by manifest)`);
      continue;
    }
    errors.push(...validateSettingValue(def, value, "settings.theme"));
  }
}

/**
 * Public entry point — validate a full customization payload against
 * the declared manifest of `themeSlug`.
 *
 * @param {string} themeSlug
 * @param {{ sections?: any[], settings?: any, customCSS?: string }} customization
 * @param {{ templateKey?: string }} [opts]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCustomization(themeSlug, customization, _opts = {}) {
  const errors = [];
  const manifest = getThemeManifest(themeSlug);
  if (!manifest) {
    errors.push(`Unknown theme slug: ${themeSlug}`);
    return { valid: false, errors };
  }

  // Global settings — only run when the caller supplies a settings
  // object. A publish payload always does; a targeted section-only
  // update is allowed to omit it.
  if (customization?.settings != null) {
    const s = customization.settings;
    if (typeof s !== "object" || Array.isArray(s)) {
      errors.push("Customization settings must be an object");
    } else {
      validateColorsBucket(s.colors, errors);
      validateTypographyBucket(s.typography, errors);
      validateLayoutBucket(s.layout, errors);
      validateThemeBucket(s.theme, manifest.settings, errors);
    }
  }

  const sectionDefs = Array.isArray(manifest.sections) ? manifest.sections : [];
  const sectionDefsByType = new Map(sectionDefs.map((s) => [s.type, s]));

  // Validate the flat `sections` array (treated as the index template)
  // AND, when present, each per-template bucket in `sectionsByTemplate`.
  // Both carry the same shape — per-template section lists — so we run
  // the same inner loop for each.
  const sections = customization?.sections;
  if (sections != null && !Array.isArray(sections)) {
    errors.push("Customization sections must be an array");
    return { valid: errors.length === 0, errors };
  }

  const validateSectionList = (list, templateLabel) => {
    const countsByType = new Map();
    for (let i = 0; i < list.length; i++) {
      const section = list[i];
      if (section && typeof section === "object") section.__themeSlug = themeSlug;
      const sectionErrors = validateSection(section, sectionDefsByType, i);
      // Prefix errors with the template label so the editor can surface
      // "Section 'hero-1' on product page: ..." instead of a generic line.
      for (const e of sectionErrors) {
        errors.push(templateLabel ? `[${templateLabel}] ${e}` : e);
      }
      if (section && section.type) {
        countsByType.set(section.type, (countsByType.get(section.type) || 0) + 1);
      }
      if (section && typeof section === "object") delete section.__themeSlug;
    }
    for (const [type, count] of countsByType) {
      const def = sectionDefsByType.get(type);
      if (def && typeof def.limit === "number" && count > def.limit) {
        errors.push(
          `${templateLabel ? `[${templateLabel}] ` : ""}Section type "${type}" exceeds its limit of ${def.limit} (found ${count})`
        );
      }
    }
  };

  if (sections != null) validateSectionList(sections, null);

  const byTemplate = customization?.sectionsByTemplate;
  if (byTemplate != null) {
    if (typeof byTemplate !== "object" || Array.isArray(byTemplate)) {
      errors.push("sectionsByTemplate must be an object keyed by template id");
    } else {
      for (const [templateId, list] of Object.entries(byTemplate)) {
        if (!ALLOWED_TEMPLATE_SET.has(templateId)) {
          errors.push(
            `sectionsByTemplate: template "${templateId}" is not in the allow-list (${ALLOWED_TEMPLATE_IDS.join(", ")})`
          );
          continue;
        }
        if (list == null) continue;
        if (!Array.isArray(list)) {
          errors.push(`sectionsByTemplate.${templateId} must be an array`);
          continue;
        }
        validateSectionList(list, templateId);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate just the global-settings buckets (colors/typography/layout/
 * theme) for a given theme slug. Separate entry point so partial
 * updates (PUT /theme-customization/settings, PATCH /…/theme-settings)
 * can run the same strict rules without having to construct a full
 * customization payload.
 */
export function validateGlobalSettings(themeSlug, settings) {
  const errors = [];
  const manifest = getThemeManifest(themeSlug);
  if (!manifest) {
    errors.push(`Unknown theme slug: ${themeSlug}`);
    return { valid: false, errors };
  }
  if (settings == null) return { valid: true, errors };
  if (typeof settings !== "object" || Array.isArray(settings)) {
    errors.push("Settings must be an object");
    return { valid: false, errors };
  }
  validateColorsBucket(settings.colors, errors);
  validateTypographyBucket(settings.typography, errors);
  validateLayoutBucket(settings.layout, errors);
  validateThemeBucket(settings.theme, manifest.settings, errors);
  return { valid: errors.length === 0, errors };
}

/**
 * Throw-on-error variant used by service methods that want a clean
 * early exit. Joins all errors into one message so the API error
 * surface preserves every problem at once rather than dripping them
 * out one publish at a time.
 */
export function assertCustomizationValid(themeSlug, customization, opts) {
  const { valid, errors } = validateCustomization(themeSlug, customization, opts);
  if (!valid) {
    const err = new Error(errors.join("; "));
    err.validationErrors = errors;
    throw err;
  }
}
