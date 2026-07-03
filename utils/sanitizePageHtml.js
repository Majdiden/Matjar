import sanitizeHtml from "sanitize-html";

/**
 * Server-side HTML sanitizer for merchant-authored CMS page content.
 *
 * Page `content` is rendered on storefronts via `dangerouslySetInnerHTML`
 * (About/Contact/PageView in storefront-themes/_shared/pages), so this is
 * the security boundary against stored XSS: anything a staff member with
 * `themes.write` saves must be safe to inject into shoppers' DOM.
 *
 * Policy (see docs/assessments/PLATFORM-AUDIT-2026-07.md §6.2):
 *   - Standard formatting/semantic tags, headings, lists, tables.
 *   - `img` limited to src/alt/width/height; http(s) sources only.
 *   - `a` limited to href/target/rel; `rel="noopener"` is forced whenever
 *     `target="_blank"` is present.
 *   - NO `<script>`, `<style>`, `<iframe>` (dropped entirely for v1),
 *     no event-handler attributes, no `javascript:` (or other non-allowlisted
 *     scheme) URLs, no protocol-relative URLs.
 */

const SANITIZE_OPTIONS = {
  allowedTags: [
    // Headings + sectioning-ish text containers
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "div", "span", "blockquote", "pre", "code",
    "br", "hr",
    // Inline formatting / semantics
    "strong", "b", "em", "i", "u", "s", "del", "ins",
    "sub", "sup", "mark", "small", "abbr", "cite", "q", "time", "address",
    // Lists
    "ul", "ol", "li", "dl", "dt", "dd",
    // Media + links
    "a", "img", "figure", "figcaption",
    // Tables
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "caption", "colgroup", "col",
  ],
  allowedAttributes: {
    // `dir` everywhere — Arabic/English mixed content is first-class here.
    "*": ["dir"],
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "width", "height"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    ol: ["start", "type"],
    time: ["datetime"],
  },
  // No `javascript:`, `data:`, `vbscript:`, etc.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  // Drop disallowed tags but keep their text content (default), except the
  // ones whose text is code, not copy — those vanish wholesale.
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  transformTags: {
    a: (tagName, attribs) => {
      const out = { ...attribs };
      if (out.target === "_blank") {
        // Force noopener so a linked page can't reach back via window.opener.
        out.rel = "noopener";
      } else {
        // Only _blank is meaningful/safe for merchant content; drop the rest
        // (_top/_parent/frame names are frame-busting vectors, not features).
        delete out.target;
      }
      return { tagName, attribs: out };
    },
  },
};

/**
 * Sanitize merchant-authored page HTML. Accepts null/undefined (returns "")
 * so callers can pass optional fields straight through.
 */
export function sanitizePageHtml(html) {
  if (html == null || html === "") return "";
  return sanitizeHtml(String(html), SANITIZE_OPTIONS);
}
