/**
 * Theme manifest rule tables + primitive setting validators
 * ─────────────────────────────────────────────────────────
 *
 * Single source of truth for the rules that govern theme manifests and
 * the setting values written against them. Extracted from
 * `services/themeValidator.js` (audit 2.5) so BOTH consumers share the
 * exact same tables instead of drifting copies:
 *
 *   - services/themeValidator.js — validates a *tenant customization
 *     payload* against the active theme's manifest at publish time.
 *   - scripts/validate-theme.js  — lints a *theme package* itself
 *     (dist/manifest.json) after `vite build`, in build-themes.sh & CI.
 *
 * This module is intentionally dependency-free (no logger, no config,
 * no registry) so the CLI script can import it without booting any
 * backend machinery.
 */

// ─── Template allow-list ─────────────────────────────────────────
//
// The set of template ids merchants can compose section layouts for.
// Declared once here so every surface (validator, routes, controllers,
// services, package linter) shares a single source of truth. Free-form
// template keys are rejected to keep the storage schema predictable and
// to prevent merchants from silently writing sections into non-existent
// template buckets that the storefront would never render.
export const ALLOWED_TEMPLATE_IDS = Object.freeze([
  "index",
  "product",
  "collection",
  "cart",
  "search",
  "page",
]);

export const ALLOWED_TEMPLATE_SET = new Set(ALLOWED_TEMPLATE_IDS);

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

// ─── Known setting types ─────────────────────────────────────────
//
// Every SectionSetting `type` the platform can render an editor control
// for AND validate a value against (the switch in validateSettingValue
// below). The `*_picker` aliases are legacy manifest spellings that map
// to the same rules. A manifest declaring a type outside this set is a
// packaging error — the dashboard would render nothing for it.
export const KNOWN_SETTING_TYPES = new Set([
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
]);

// ─── Primitive value patterns ────────────────────────────────────

export const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
export const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
export const RGB_COLOR_RE =
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
export const HSL_COLOR_RE =
  /^hsla?\(\s*-?\d{1,3}(?:\.\d+)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;

// CSS length / percentage / unitless-number patterns for layout values.
// Used to gate merchant-supplied layout tokens (maxWidth, headerHeight,
// borderRadius, spacing) before they're injected into CSS variables. The
// set of allowed units is intentionally small — anything exotic is likely
// a typo or an attempt to smuggle CSS function syntax through a "layout"
// control.
export const CSS_LENGTH_RE =
  /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh|vmin|vmax|ch|ex|pt|pc|cm|mm|in)$/i;
export const CSS_UNITLESS_NUMBER_RE = /^-?\d+(?:\.\d+)?$/;

// Font stacks have to be strictly formatted — we emit them verbatim into
// `font-family:` declarations, so any stray `;`, `{`, `}`, `<`, `>`, `(`,
// `)`, or backslash is a CSS-injection vector. The actual list of
// families can use letters, digits, spaces, hyphens, underscores,
// periods, commas, and either kind of quote around a family with a
// space in its name. Anything outside that grammar is rejected.
export const FONT_STACK_RE = /^[A-Za-z0-9\s,'"._\-]+$/;

// The CSS-variable names we allow the theme/global pipeline to mint. A
// merchant-supplied key that doesn't match this pattern could otherwise
// break out of a declaration (a key with `:` or `;` would let a
// malicious value escape the intended property). Every id in a
// well-authored manifest already fits this — it's defense in depth.
export const SAFE_SETTING_ID_RE = /^[a-zA-Z0-9_\-]{1,64}$/;

export const MAX_TEXT_LENGTH = 5000;
export const MAX_TEXTAREA_LENGTH = 50_000;

// Substrings that MUST NEVER appear inside a value we're about to
// concatenate into a CSS declaration (color, font, layout). These are
// the same script-capable constructs cssPolicy.js deny-lists for the
// custom-CSS textarea — we mirror them here because global settings hit
// the same <style> tag on the storefront.
export const CSS_INJECTION_MARKERS = [
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

/** CSS-safe color value — hex, rgb(a), hsl(a), or a small named set. */
export const NAMED_CSS_COLORS = new Set([
  "transparent", "currentcolor", "inherit", "initial", "unset",
  "black", "white", "red", "green", "blue", "yellow", "cyan", "magenta",
  "gray", "grey", "orange", "purple", "pink", "brown",
]);

// The three "standard" global buckets are typed structurally; within
// `typography`, these keys carry lengths/numbers rather than font stacks.
export const TYPOGRAPHY_LENGTH_KEYS = new Set([
  "baseFontSize", "fontSize", "headingFontSize", "lineHeight",
  "letterSpacing", "paragraphSpacing",
]);

// ─── Primitive validators ────────────────────────────────────────

/**
 * Reject any value that could break out of the CSS declaration we're
 * about to inject it into. Used on colors, font stacks, and layout
 * tokens before they reach the storefront <style> tag.
 */
export function hasCssInjectionMarker(value) {
  for (const { re, label } of CSS_INJECTION_MARKERS) {
    if (re.test(value)) return label;
  }
  return null;
}

export function validateCssColor(value, label, errors) {
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
export function validateFontStack(value, label, errors) {
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
export function validateLayoutValue(value, label, errors, { clampMin = -10000, clampMax = 10000 } = {}) {
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
export function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

/** Is `u` a safe URL for storefront consumption? */
export function isSafeUrl(u) {
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
export function validateSettingValue(def, value, prefix) {
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
      // haven't implemented yet. (The PACKAGE linter, by contrast,
      // rejects unknown types via KNOWN_SETTING_TYPES — a first-party
      // theme declaring one is a bug, not forward-compat.)
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
export function validateSettingsBag(settings, defs, prefix) {
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
