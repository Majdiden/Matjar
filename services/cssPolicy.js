/**
 * Custom CSS Policy
 * ─────────────────
 *
 * Tenant-authored custom CSS is an escape hatch for design tweaks the
 * theme editor can't express. It's appended directly to the storefront
 * <head>, so every byte of it runs in the shopper's browser under the
 * storefront origin. That makes it a high-trust surface: a mistake here
 * becomes a stored XSS or a data-exfiltration channel that affects
 * every shopper on the tenant's store.
 *
 * Defense model:
 *
 *   1. Hard size cap. Custom CSS is a "tweaks" feature, not a stylesheet
 *      replacement. 50 KB is already 5× what most themes need and
 *      prevents payload-stuffing attacks.
 *   2. Deny-list of script-capable CSS constructs. `expression()` (IE
 *      legacy, but still parsed in some engines), `behavior:`,
 *      `-moz-binding:`, and HTML-ish fragments (`<script`, `<iframe`,
 *      closing tags) are rejected outright — none of them have a
 *      legitimate use in tenant CSS, and they're the vehicles used
 *      for CSS-based script injection.
 *   3. `@import` is rejected. Remote CSS loads are a side channel
 *      (the fetch happens regardless of CSP on the main doc) and
 *      invite supply-chain risk on the linked origin.
 *   4. URLs inside `url(...)` must use safe schemes only. Relative,
 *      https://, and data:image/... are allowed; javascript:, vbscript:,
 *      data:text/*, and data:application/* are rejected.
 *   5. Bare-string URL filters aren't relied on — the regex is
 *      intentionally paranoid about quoting (`url('...')`,
 *      `url("...")`, `url(...)`) and whitespace.
 *
 * The policy returns a list of human-readable error strings so the
 * dashboard can surface each violation exactly. Nothing is silently
 * stripped — the merchant sees what they wrote and fixes it.
 */

const MAX_CSS_BYTES = 50 * 1024; // 50 KB

// Script-capable CSS constructs that have no legitimate use in tenant
// stylesheets. Each pattern is matched case-insensitively against the
// raw input. Some of these (like `expression(`) are IE legacy, but
// leaving them in means older browsers or embedded webviews can still
// trigger code execution — cheap to block, expensive to regret.
const FORBIDDEN_CONSTRUCTS = [
  { re: /<\s*script\b/i, label: "<script> tag" },
  { re: /<\s*iframe\b/i, label: "<iframe> tag" },
  { re: /<\s*object\b/i, label: "<object> tag" },
  { re: /<\s*embed\b/i, label: "<embed> tag" },
  { re: /<\/\s*style\s*>/i, label: "</style> closing tag" },
  { re: /\bexpression\s*\(/i, label: "expression() CSS function" },
  { re: /\bbehavior\s*:/i, label: "behavior: property" },
  { re: /-moz-binding\s*:/i, label: "-moz-binding: property" },
  { re: /\bjavascript\s*:/i, label: "javascript: URL" },
  { re: /\bvbscript\s*:/i, label: "vbscript: URL" },
  { re: /@\s*import\b/i, label: "@import rule" },
  { re: /@\s*charset\b/i, label: "@charset rule" },
];

// Match all url(...) occurrences so we can validate their argument.
// Captures the inside of the parens, stripping surrounding quotes.
const URL_FUNCTION_RE = /url\s*\(\s*(?:'([^']*)'|"([^"]*)"|([^)]*))\s*\)/gi;

/**
 * Is a URL string inside `url()` safe to include in tenant CSS?
 *
 *   - Empty → safe (author intentionally blanked).
 *   - Relative (`/..`, `./..`, `../..`, no scheme) → safe.
 *   - https:// and http:// → safe. (Mixed-content for http:// is the
 *     shopper's browser's problem; we're not an origin validator.)
 *   - data:image/{png,jpeg,jpg,gif,webp,svg+xml} → safe. Inline
 *     images only; `data:text/*` and `data:application/*` are blocked
 *     because they can ship executable payloads (HTML, SVG with
 *     scripts, WASM).
 *   - Everything else (javascript:, vbscript:, file:, ftp:, blob:) →
 *     unsafe.
 */
function isSafeCssUrl(raw) {
  if (typeof raw !== "string") return false;
  const url = raw.trim();
  if (url.length === 0) return true;

  // Fragment-only references (e.g., `url(#clip-path)`) are safe.
  if (url.startsWith("#")) return true;

  // Relative paths — no scheme separator before the first `/` or `?`.
  // Matching `scheme:` cheaply without a full URL parse: does the
  // string contain a `:` before any `/`, `?`, or `#`?
  const schemeMatch = /^([a-z][a-z0-9+.\-]*):/i.exec(url);
  if (!schemeMatch) {
    // Purely relative. Reject anything with a null byte (CRLF
    // injection / header smuggling on the CDN side).
    if (/[\r\n\0]/.test(url)) return false;
    return true;
  }

  const scheme = schemeMatch[1].toLowerCase();
  if (scheme === "http" || scheme === "https") return true;

  if (scheme === "data") {
    // Allow only image data URLs with a well-known mime. The SVG
    // mime type is double-edged (SVG can host scripts) but stripping
    // it would break legitimate inline icons — instead, the CSP on
    // the storefront handles SVG execution restrictions. We accept
    // the mime marker here and rely on the renderer.
    return /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);/i.test(url);
  }

  return false;
}

/**
 * Validate a tenant custom-CSS string against the full policy.
 *
 * @param {string} css
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCustomCSS(css) {
  const errors = [];

  if (typeof css !== "string") {
    errors.push("Custom CSS must be a string");
    return { valid: false, errors };
  }

  // Byte-length check (Buffer.byteLength = actual UTF-8 bytes, not JS
  // char count). Using bytes is what the storefront actually sends
  // over the wire, so limit-by-bytes lines up with the operational
  // impact.
  const byteLength = Buffer.byteLength(css, "utf8");
  if (byteLength > MAX_CSS_BYTES) {
    errors.push(
      `Custom CSS exceeds max size of ${MAX_CSS_BYTES} bytes (got ${byteLength})`
    );
    // Don't short-circuit — let the merchant see all violations.
  }

  // Construct deny-list. These scan the *raw* source (not a CSS
  // parser's normalized output), which is what the browser will
  // actually execute, so any obfuscation that survives serialization
  // still has to include the forbidden substring verbatim.
  for (const { re, label } of FORBIDDEN_CONSTRUCTS) {
    if (re.test(css)) {
      errors.push(`Custom CSS contains forbidden construct: ${label}`);
    }
  }

  // url() safety. Walk every occurrence and validate the argument.
  URL_FUNCTION_RE.lastIndex = 0;
  let m;
  while ((m = URL_FUNCTION_RE.exec(css)) !== null) {
    const urlArg = m[1] ?? m[2] ?? m[3] ?? "";
    if (!isSafeCssUrl(urlArg)) {
      errors.push(
        `Custom CSS contains unsafe url() target: "${urlArg.slice(0, 80)}"`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export const CUSTOM_CSS_MAX_BYTES = MAX_CSS_BYTES;
