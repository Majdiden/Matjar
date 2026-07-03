/**
 * 005_sanitize_page_content
 *
 * One-time sanitization of existing `pages.content` HTML. Introduced with
 * the server-side sanitize-html gate in services/page.js (audit item 6.2):
 * from now on every create/update strips scripts, event-handler attributes,
 * javascript: URLs, styles and iframes before persist — this migration
 * brings documents written BEFORE that gate up to the same guarantee.
 *
 * The sanitize config is intentionally duplicated from
 * utils/sanitizePageHtml.js (as of 2026-07-03) — a migration should not
 * follow the live util through future policy changes; it must keep
 * producing the same output it produced the day it was applied.
 *
 * Idempotent:
 *   - sanitize-html is a fixpoint on its own output, and we only write
 *     when the sanitized value differs from the stored one. Re-running
 *     in steady state writes nothing.
 *
 * Reversibility:
 *   `down()` is a no-op. Stripping unsafe markup is deliberately
 *   destructive — the removed content is exactly what must not exist.
 */

import sanitizeHtml from "sanitize-html";

export const description =
  "Sanitize existing pages.content HTML with the services/page.js allowlist";

// --------------------------------------------------------------------------
// Inlined copy of utils/sanitizePageHtml.js SANITIZE_OPTIONS (2026-07-03).
// --------------------------------------------------------------------------
const SANITIZE_OPTIONS = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "div", "span", "blockquote", "pre", "code",
    "br", "hr",
    "strong", "b", "em", "i", "u", "s", "del", "ins",
    "sub", "sup", "mark", "small", "abbr", "cite", "q", "time", "address",
    "ul", "ol", "li", "dl", "dt", "dd",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "caption", "colgroup", "col",
  ],
  allowedAttributes: {
    "*": ["dir"],
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "width", "height"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    ol: ["start", "type"],
    time: ["datetime"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  transformTags: {
    a: (tagName, attribs) => {
      const out = { ...attribs };
      if (out.target === "_blank") {
        out.rel = "noopener";
      } else {
        delete out.target;
      }
      return { tagName, attribs: out };
    },
  },
};

function sanitizePageContent(html) {
  if (html == null || html === "") return "";
  return sanitizeHtml(String(html), SANITIZE_OPTIONS);
}

export async function up(db, { logger, session } = {}) {
  const sessionOpt = session ? { session } : undefined;

  const cursor = db
    .collection("pages")
    .find({ content: { $exists: true, $nin: [null, ""] } }, sessionOpt);

  let scanned = 0;
  let updated = 0;

  while (await cursor.hasNext()) {
    const page = await cursor.next();
    scanned += 1;

    const clean = sanitizePageContent(page.content);

    // Idempotent: only write when sanitization actually changed the HTML.
    if (clean !== page.content) {
      await db.collection("pages").updateOne(
        { _id: page._id },
        { $set: { content: clean, updatedAt: new Date() } },
        sessionOpt
      );
      updated += 1;
    }

    if (scanned % 500 === 0) {
      logger?.info?.(`migrate 005: scanned=${scanned} updated=${updated}`);
    }
  }

  logger?.info?.(`migrate 005: done — scanned=${scanned} updated=${updated}`);
}

export async function down(db, { logger } = {}) {
  // Intentional no-op: the stripped markup (scripts, event handlers,
  // javascript: URLs) is precisely what must never be restored.
  logger?.info?.(
    "migrate 005 down: no-op — sanitization is deliberately irreversible"
  );
}
