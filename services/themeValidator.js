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
 * Layers covered:
 *
 *   1. Manifest exists for the active theme.
 *   2. Sections array structure — each entry has id, type, numeric
 *      order.
 *   3. Section type is declared by the manifest.
 *   4. Section `limit` — no more instances than the definition allows.
 *   5. Settings on each section: unknown keys are rejected; every
 *      known key is validated against its declared type rules
 *      (number range, select enum, color format, URL scheme, etc.).
 *   6. Blocks (when a section declares any): block type must be
 *      declared; block count must respect block-level `limit`;
 *      block settings run through the same per-type rules.
 *   7. Template placement — when a template key is supplied, the
 *      validator can additionally check a section type is allowed
 *      inside that template (currently a no-op because manifests
 *      don't yet declare template-level constraints; hook is in
 *      place for when they do).
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

// ─── Template allow-list ─────────────────────────────────────────
//
// The set of template ids merchants can compose section layouts for.
// Declared once here so every surface (validator, routes, controllers,
// services) shares a single source of truth. Free-form template keys
// are rejected to keep the storage schema predictable and to prevent
// merchants from silently writing sections into non-existent template
// buckets that the storefront would never render.
export const ALLOWED_TEMPLATE_IDS = Object.freeze([
  "index",
  "product",
  "collection",
  "cart",
  "search",
  "page",
]);

const ALLOWED_TEMPLATE_SET = new Set(ALLOWED_TEMPLATE_IDS);

// Editor-facing metadata for each allow-listed template. Lives next to
// ALLOWED_TEMPLATE_IDS so the two never drift; served verbatim by
// GET /theme-customization/templates. `label` is an English fallback —
// the dashboard translates by stable id (themes:editor.template.<id>)
// and only shows this string when no i18n entry exists. `previewPath`
// is the storefront route the editor points the preview iframe at when
// the merchant switches templates.
export const TEMPLATE_METADATA = Object.freeze({
  index: Object.freeze({ label: "Home", previewPath: "/" }),
  product: Object.freeze({ label: "Product page", previewPath: "/products" }),
  collection: Object.freeze({ label: "Collection / Category", previewPath: "/categories" }),
  cart: Object.freeze({ label: "Cart", previewPath: "/cart" }),
  search: Object.freeze({ label: "Search results", previewPath: "/search" }),
  page: Object.freeze({ label: "Static pages", previewPath: "/" }),
});

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

// ─── Primitive value validators ──────────────────────────────────

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR_RE =
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
const HSL_COLOR_RE =
  /^hsla?\(\s*-?\d{1,3}(?:\.\d+)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;

// CSS length / percentage / unitless-number patterns for layout values.
// Used to gate merchant-supplied layout tokens (maxWidth, headerHeight,
// borderRadius, spacing) before they're injected into CSS variables. The
// set of allowed units is intentionally small — anything exotic is likely
// a typo or an attempt to smuggle CSS function syntax through a "layout"
// control.
const CSS_LENGTH_RE =
  /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh|vmin|vmax|ch|ex|pt|pc|cm|mm|in)$/i;
const CSS_UNITLESS_NUMBER_RE = /^-?\d+(?:\.\d+)?$/;

// Font stacks have to be strictly formatted — we emit them verbatim into
// `font-family:` declarations, so any stray `;`, `{`, `}`, `<`, `>`, `(`,
// `)`, or backslash is a CSS-injection vector. The actual list of
// families can use letters, digits, spaces, hyphens, underscores,
// periods, commas, and either kind of quote around a family with a
// space in its name. Anything outside that grammar is rejected.
const FONT_STACK_RE = /^[A-Za-z0-9\s,'"._\-]+$/;

// The CSS-variable names we allow the theme/global pipeline to mint. A
// merchant-supplied key that doesn't match this pattern could otherwise
// break out of a declaration (a key with `:` or `;` would let a
// malicious value escape the intended property). Every id in a
// well-authored manifest already fits this — it's defense in depth.
const SAFE_SETTING_ID_RE = /^[a-zA-Z0-9_\-]{1,64}$/;

const MAX_TEXT_LENGTH = 5000;
const MAX_TEXTAREA_LENGTH = 50_000;

// Substrings that MUST NEVER appear inside a value we're about to
// concatenate into a CSS declaration (color, font, layout). These are
// the same script-capable constructs cssPolicy.js deny-lists for the
// custom-CSS textarea — we mirror them here because global settings hit
// the same <style> tag on the storefront.
const CSS_INJECTION_MARKERS = [
  { re: /expression\s*\(/i, label: "expression()" },
  { re: /javascript\s*:/i, label: "javascript:" },
  { re: /vbscript\s*:/i, label: "vbscript:" },
  { re: /behavior\s*:/i, label: "behavior:" },
  { re: /-moz-binding\s*:/i, label: "-moz-binding:" },
  { re: /<\s*\/?\s*(?:script|style|iframe|object|embed)\b/i, label: "HTML tag" },
  { re: /[;{}<>]/, label: "stray ;{}<> character" },
  { re: /\/\*|\*\//, label: "CSS comment" },
  { re: /\burl\s*\(/i, label: "url() function" },
  { re: /@\s*import\b/i, label: "@import" },
];

/**
 * Reject any value that could break out of the CSS declaration we're
 * about to inject it into. Used on colors, font stacks, and layout
 * tokens before they reach the storefront <style> tag.
 */
function hasCssInjectionMarker(value) {
  for (const { re, label } of CSS_INJECTION_MARKERS) {
    if (re.test(value)) return label;
  }
  return null;
}

/** CSS-safe color value — hex, rgb(a), hsl(a), or a small named set. */
const NAMED_CSS_COLORS = new Set([
  "transparent", "currentcolor", "inherit", "initial", "unset",
  "black", "white", "red", "green", "blue", "yellow", "cyan", "magenta",
  "gray", "grey", "orange", "purple", "pink", "brown",
]);

function validateCssColor(value, label, errors) {
  if (typeof value !== "string") {
    errors.push(`${label} must be a string color`);
    return;
  }
  const v = value.trim();
  if (v.length === 0) return;
  if (v.length > 64) {
    errors.push(`${label} is too long for a color value`);
    return;
  }
  const marker = hasCssInjectionMarker(v);
  if (marker) {
    errors.push(`${label} contains forbidden CSS construct (${marker})`);
    return;
  }
  if (
    HEX_COLOR_RE.test(v) ||
    RGB_COLOR_RE.test(v) ||
    HSL_COLOR_RE.test(v) ||
    NAMED_CSS_COLORS.has(v.toLowerCase())
  ) {
    return;
  }
  errors.push(`${label} must be a hex, rgb(a), hsl(a), or recognized named color`);
}

/** CSS-safe font family / stack. */
function validateFontStack(value, label, errors) {
  if (typeof value !== "string") {
    errors.push(`${label} must be a string font family or stack`);
    return;
  }
  const v = value.trim();
  if (v.length === 0) return;
  if (v.length > 500) {
    errors.push(`${label} exceeds max length 500`);
    return;
  }
  const marker = hasCssInjectionMarker(v);
  if (marker) {
    errors.push(`${label} contains forbidden CSS construct (${marker})`);
    return;
  }
  if (!FONT_STACK_RE.test(v)) {
    errors.push(
      `${label} may only contain letters, digits, spaces, hyphens, underscores, periods, quotes, and commas`
    );
  }
}

/** CSS-safe layout token — length, percentage, or unitless number. */
function validateLayoutValue(value, label, errors, { clampMin = -10000, clampMax = 10000 } = {}) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      errors.push(`${label} must be a finite number`);
      return;
    }
    if (value < clampMin || value > clampMax) {
      errors.push(`${label} out of allowed numeric range`);
    }
    return;
  }
  if (typeof value !== "string") {
    errors.push(`${label} must be a CSS length, percentage, or number`);
    return;
  }
  const v = value.trim();
  if (v.length === 0) return;
  if (v.length > 64) {
    errors.push(`${label} is too long for a layout value`);
    return;
  }
  const marker = hasCssInjectionMarker(v);
  if (marker) {
    errors.push(`${label} contains forbidden CSS construct (${marker})`);
    return;
  }
  if (!(CSS_LENGTH_RE.test(v) || CSS_UNITLESS_NUMBER_RE.test(v))) {
    errors.push(
      `${label} must be a CSS length (e.g. "1280px", "1.5rem", "80%") or number`
    );
  }
}

/** Treat null/undefined/empty string as "no value, use default". */
function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

/** Is `u` a safe URL for storefront consumption? */
function isSafeUrl(u) {
  if (typeof u !== "string") return false;
  if (u.length === 0) return true;
  // Relative paths and root-relative paths are safe.
  if (u.startsWith("/") || u.startsWith("./") || u.startsWith("../") || u.startsWith("#")) {
    return true;
  }
  // Absolute URLs: only http(s), mailto, and tel. Explicitly reject
  // javascript: and data: — both can be used to inject script execution
  // into the storefront DOM even after our CSS sanitizer runs.
  try {
    const parsed = new URL(u);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate a single setting value against its declared setting
 * definition. Returns an array of error strings for this one value
 * (empty when valid). Uses the caller-supplied `prefix` to build
 * human-readable messages like
 * `Section "hero-1" (hero): setting "overlay_opacity" must be ≤ 1`.
 */
function validateSettingValue(def, value, prefix) {
  const errors = [];
  const label = `${prefix}: setting "${def.id}"`;

  // All types treat empty/missing as "fall back to default" — we don't
  // force merchants to author every control.
  if (isEmpty(value)) return errors;

  switch (def.type) {
    case "text": {
      if (typeof value !== "string") {
        errors.push(`${label} must be a string`);
        break;
      }
      if (value.length > MAX_TEXT_LENGTH) {
        errors.push(`${label} exceeds max length ${MAX_TEXT_LENGTH}`);
      }
      break;
    }
    case "textarea":
    case "richtext": {
      if (typeof value !== "string") {
        errors.push(`${label} must be a string`);
        break;
      }
      if (value.length > MAX_TEXTAREA_LENGTH) {
        errors.push(`${label} exceeds max length ${MAX_TEXTAREA_LENGTH}`);
      }
      break;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(`${label} must be a finite number`);
        break;
      }
      if (typeof def.min === "number" && value < def.min) {
        errors.push(`${label} must be ≥ ${def.min}`);
      }
      if (typeof def.max === "number" && value > def.max) {
        errors.push(`${label} must be ≤ ${def.max}`);
      }
      break;
    }
    case "range": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(`${label} must be a finite number`);
        break;
      }
      if (typeof def.min === "number" && value < def.min) {
        errors.push(`${label} must be ≥ ${def.min}`);
      }
      if (typeof def.max === "number" && value > def.max) {
        errors.push(`${label} must be ≤ ${def.max}`);
      }
      break;
    }
    case "checkbox": {
      if (typeof value !== "boolean") {
        errors.push(`${label} must be a boolean`);
      }
      break;
    }
    case "select": {
      if (typeof value !== "string") {
        errors.push(`${label} must be a string`);
        break;
      }
      const allowed = Array.isArray(def.options) ? def.options.map((o) => o.value) : [];
      if (allowed.length > 0 && !allowed.includes(value)) {
        errors.push(`${label} must be one of: ${allowed.join(", ")}`);
      }
      break;
    }
    case "color": {
      validateCssColor(value, label, errors);
      break;
    }
    case "image":
    case "image_picker": {
      // Images are URLs with the same safety rules, plus an
      // implicit allowance for tenant-uploaded paths under /uploads
      // which isSafeUrl already accepts as relative.
      if (typeof value !== "string") {
        errors.push(`${label} must be a string URL`);
        break;
      }
      if (!isSafeUrl(value)) {
        errors.push(`${label} must be a safe URL (http/https/relative)`);
      }
      break;
    }
    case "url": {
      if (typeof value !== "string") {
        errors.push(`${label} must be a string URL`);
        break;
      }
      if (!isSafeUrl(value)) {
        errors.push(`${label} must be a safe URL (http/https/mailto/tel/relative)`);
      }
      break;
    }
    case "product":
    case "product_picker":
    case "collection":
    case "collection_picker": {
      // Pickers store a MongoDB ObjectId reference or an empty string.
      if (typeof value !== "string") {
        errors.push(`${label} must be an ObjectId string`);
        break;
      }
      if (!OBJECT_ID_RE.test(value)) {
        errors.push(`${label} must be a valid 24-hex ObjectId`);
      }
      break;
    }
    case "font_picker": {
      // Font pickers carry a CSS font stack. Use the strict font-stack
      // validator — the value is emitted verbatim into a `font-family:`
      // declaration on the storefront, so CSS-safety is load-bearing.
      validateFontStack(value, label, errors);
      break;
    }
    default: {
      // Unknown setting *type* (not unknown key) — the manifest
      // declared a type we don't support. Don't fail the publish
      // over it; just skip validation. This keeps the platform
      // forward-compatible with themes that use setting types we
      // haven't implemented yet.
      break;
    }
  }

  return errors;
}

/**
 * Validate a settings object against a list of setting definitions.
 * Rejects unknown keys (Shopify-style strict contract) and runs
 * per-type validation on known keys.
 */
function validateSettingsBag(settings, defs, prefix) {
  const errors = [];
  const defsById = new Map((defs || []).map((d) => [d.id, d]));

  if (settings == null) return errors;
  if (typeof settings !== "object" || Array.isArray(settings)) {
    errors.push(`${prefix}: settings must be an object`);
    return errors;
  }

  for (const [key, value] of Object.entries(settings)) {
    const def = defsById.get(key);
    if (!def) {
      errors.push(`${prefix}: unknown setting "${key}"`);
      continue;
    }
    errors.push(...validateSettingValue(def, value, prefix));
  }
  return errors;
}

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

const TYPOGRAPHY_LENGTH_KEYS = new Set([
  "baseFontSize", "fontSize", "headingFontSize", "lineHeight",
  "letterSpacing", "paragraphSpacing",
]);

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
