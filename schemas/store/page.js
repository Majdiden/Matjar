import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

/**
 * Page — merchant-authored static content (About, Contact, Privacy, etc.).
 * Pages are addressed by `slug` on the storefront (e.g. /pages/about) and
 * can be linked from navigation menus via the menu item `page` type.
 *
 * i18n: locale is stored per-document rather than in a separate i18n
 * collection (like productI18n). Pages are typically authored long-form
 * and rarely share structure across locales, so the ergonomic win of
 * "one document = one locale" beats normalization for this resource.
 * The unique index is (tenantId, slug, locale), so the same slug can
 * exist in multiple locales (e.g. "about" in "en" and "ar").
 */
const pageSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  slug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 100,
  },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  // HTML body. Size-capped at the service layer (see services/page.js) but
  // Mongoose also guards with a generous 100KB maxlength so a direct write
  // can't bloat the document. Sanitized SERVER-SIDE on every create/update
  // (services/page.js → utils/sanitizePageHtml.js): scripts/styles/iframes,
  // event-handler attributes and javascript: URLs are stripped before
  // persist, since storefronts render this via dangerouslySetInnerHTML.
  content: { type: String, default: "", maxlength: 102400 },
  metaTitle: { type: String, trim: true, maxlength: 200, default: "" },
  metaDescription: { type: String, trim: true, maxlength: 500, default: "" },
  locale: {
    type: String,
    lowercase: true,
    trim: true,
    default: "en",
    maxlength: 10,
  },
  isPublished: { type: Boolean, default: false, index: true },
  // Flags starter/demo content seeded on signup. Lets the "publish starter
  // content" action find these pages (and only these) to flip live, and is
  // distinguishable from real merchant-authored pages.
  isDemo: { type: Boolean, default: false },
  // Populated the first time the page is flipped to published. Kept on
  // subsequent unpublish/republish flips so the original publish date
  // survives round trips — if the merchant needs a fresh timestamp they
  // can set it explicitly.
  publishedAt: { type: Date, default: null },
  // Scheduled publishing (audit 6.5): when set, the storefront read gate is
  // `isPublished && (publishAt == null || publishAt <= now)` — no cron; the
  // read-time check suffices. Null = publish immediately when isPublished.
  publishAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// One page per (tenant, slug, locale). Without locale in the key we'd
// block merchants from translating the same slug (e.g. "about") across
// multiple storefront languages.
pageSchema.index({ tenantId: 1, slug: 1, locale: 1 }, { unique: true });
pageSchema.index({ tenantId: 1, isPublished: 1, updatedAt: -1 });

pageSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(pageSchema);

export default pageSchema;
