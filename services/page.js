import {
  listPagesRepo,
  getPageRepo,
  getPageBySlugRepo,
  createPageRepo,
  updatePageRepo,
  deletePageRepo,
} from "../repositories/page.js";
import { APIError } from "../middlewares/errorHandler.js";
import { sanitizePageHtml } from "../utils/sanitizePageHtml.js";

// Hard cap on stored HTML body. Matches the schema `maxlength` so the
// service layer surfaces a clean 400 before Mongoose throws a cryptic
// validation error deep in the driver.
const CONTENT_MAX_BYTES = 100 * 1024; // 100KB
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Normalise and validate a slug. Returns the normalised form or throws
 * an APIError(400) with a merchant-readable message.
 *
 * Rules:
 *   - lowercase
 *   - ASCII alphanumerics + single hyphens between segments
 *   - 1..100 chars, no leading/trailing hyphen, no double hyphens
 */
export function normaliseSlug(input) {
  if (typeof input !== "string") {
    throw new APIError("slug must be a string", 400);
  }
  const slug = input.trim().toLowerCase();
  if (!slug) throw new APIError("slug is required", 400);
  if (slug.length > 100) throw new APIError("slug must be 100 characters or fewer", 400);
  if (!SLUG_RE.test(slug)) {
    throw new APIError(
      "slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing or double hyphens)",
      400
    );
  }
  return slug;
}

/**
 * Derive a URL-safe slug from free-form text. Used only as the default
 * when a merchant creates a page without supplying a slug — the explicit
 * `slug` field still goes through `normaliseSlug` (strict) so the validator
 * layer's regex stays the source of truth for user input.
 *
 * Must match the dashboard's PageForm.tsx `slugify()` so the client-side
 * preview equals what the server stores. Keep these two in lockstep.
 */
function slugifyFromText(input) {
  if (typeof input !== "string") return "";
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function assertContentSize(content) {
  if (content == null) return;
  if (typeof content !== "string") {
    throw new APIError("content must be a string", 400);
  }
  // Byte length, not char length — HTML with Unicode can be deceptively
  // short on character count but blow the schema maxlength in bytes.
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > CONTENT_MAX_BYTES) {
    throw new APIError(
      `content exceeds the ${CONTENT_MAX_BYTES}-byte limit (got ${bytes} bytes)`,
      400
    );
  }
}

function normaliseLocale(input) {
  if (input == null || input === "") return "en";
  if (typeof input !== "string") {
    throw new APIError("locale must be a string", 400);
  }
  const locale = input.trim().toLowerCase();
  if (locale.length > 10) {
    throw new APIError("locale must be 10 characters or fewer", 400);
  }
  return locale;
}

/**
 * Throw APIError(409) when a (slug, locale) is already taken by another
 * page in this tenant. `excludeId` lets callers skip their own document
 * when updating.
 */
async function assertSlugUnique(models, slug, locale, excludeId = null) {
  const existing = await models.Page.findOne({ slug, locale }).lean();
  if (existing && (!excludeId || String(existing._id) !== String(excludeId))) {
    throw new APIError(
      `A page with slug "${slug}" already exists for locale "${locale}"`,
      409
    );
  }
}

export const listPages = async (models, { page, limit, search, published, locale } = {}) => {
  // Accept both boolean and "true"/"false" strings from query params.
  const parsedPublished =
    published === true || published === "true"
      ? true
      : published === false || published === "false"
      ? false
      : undefined;
  return listPagesRepo(models, { page, limit, search, published: parsedPublished, locale });
};

export const getPage = async (models, id) => {
  const page = await getPageRepo(models, id);
  if (!page) throw new APIError("Page not found", 404);
  return page;
};

export const getPageBySlug = async (models, slug, locale) => {
  const page = await getPageBySlugRepo(models, slug, locale);
  if (!page) throw new APIError("Page not found", 404);
  return page;
};

// Parse an optional scheduled-publish timestamp. Accepts Date/ISO string;
// empty/null clears the schedule. Invalid dates 400 rather than persisting NaN.
const parsePublishAt = (value) => {
  if (value === undefined) return undefined; // not in patch — leave as-is
  if (value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new APIError("publishAt must be a valid date", 400);
  }
  return d;
};

export const createPage = async (models, data = {}) => {
  const { title, content, metaTitle, metaDescription, isPublished } = data;
  if (!title || typeof title !== "string" || !title.trim()) {
    throw new APIError("title is required", 400);
  }

  // If the merchant supplied a slug, validate it strictly. Otherwise
  // derive one from the title — free-form text needs slugification, not
  // just validation (otherwise "About Us" would 400 on the space).
  const slug = data.slug
    ? normaliseSlug(data.slug)
    : (() => {
        const derived = slugifyFromText(title);
        if (!derived) {
          throw new APIError(
            "Could not derive a slug from the title — provide one explicitly",
            400
          );
        }
        return derived;
      })();
  const locale = normaliseLocale(data.locale);
  // Type/size-check the raw input (clean 400s), then sanitize — the stored
  // value must be safe to render via dangerouslySetInnerHTML on storefronts.
  // Re-check size afterwards: entity-escaping can grow the string slightly.
  assertContentSize(content);
  const cleanContent = sanitizePageHtml(content);
  assertContentSize(cleanContent);

  await assertSlugUnique(models, slug, locale);

  const now = new Date();
  const willPublish = isPublished === true;
  const doc = await createPageRepo(models, {
    slug,
    title: title.trim(),
    content: cleanContent,
    metaTitle: metaTitle ? String(metaTitle).trim() : "",
    metaDescription: metaDescription ? String(metaDescription).trim() : "",
    locale,
    isPublished: willPublish,
    publishedAt: willPublish ? now : null,
    publishAt: parsePublishAt(data.publishAt) ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return doc.toObject ? doc.toObject() : doc;
};

export const updatePage = async (models, id, patch = {}) => {
  const existing = await getPageRepo(models, id);
  if (!existing) throw new APIError("Page not found", 404);

  const allowed = {};

  if (patch.title !== undefined) {
    if (!patch.title || !String(patch.title).trim()) {
      throw new APIError("title cannot be empty", 400);
    }
    allowed.title = String(patch.title).trim();
  }

  // Slug/locale changes must still be unique within the tenant. We
  // compute the effective values (patched OR current) so a locale-only
  // change still checks against the existing slug.
  const nextSlug =
    patch.slug !== undefined ? normaliseSlug(patch.slug) : existing.slug;
  const nextLocale =
    patch.locale !== undefined ? normaliseLocale(patch.locale) : existing.locale;

  if (nextSlug !== existing.slug || nextLocale !== existing.locale) {
    await assertSlugUnique(models, nextSlug, nextLocale, id);
    if (nextSlug !== existing.slug) allowed.slug = nextSlug;
    if (nextLocale !== existing.locale) allowed.locale = nextLocale;
  }

  if (patch.content !== undefined) {
    // Same pipeline as createPage: raw type/size check → sanitize → re-check.
    assertContentSize(patch.content);
    const cleanContent = sanitizePageHtml(patch.content);
    assertContentSize(cleanContent);
    allowed.content = cleanContent;
  }

  if (patch.metaTitle !== undefined) {
    allowed.metaTitle = patch.metaTitle ? String(patch.metaTitle).trim() : "";
  }
  if (patch.metaDescription !== undefined) {
    allowed.metaDescription = patch.metaDescription
      ? String(patch.metaDescription).trim()
      : "";
  }

  // Publish state transitions:
  //   - First flip to published stamps publishedAt.
  //   - Later republishes keep the original publishedAt (so merchants
  //     can distinguish "first made public" from "last edited"). If a
  //     merchant needs a fresh stamp they can set publishedAt explicitly
  //     through the schema next time we expose it.
  //   - Unpublish clears isPublished but preserves publishedAt for audit.
  if (patch.isPublished !== undefined) {
    const willPublish = Boolean(patch.isPublished);
    allowed.isPublished = willPublish;
    if (willPublish && !existing.publishedAt) {
      allowed.publishedAt = new Date();
    }
  }

  // Scheduled publishing (audit 6.5): optional future timestamp; the
  // storefront read gate enforces it at request time (no cron).
  const publishAt = parsePublishAt(patch.publishAt);
  if (publishAt !== undefined) allowed.publishAt = publishAt;

  const updated = await updatePageRepo(models, id, allowed);
  if (!updated) throw new APIError("Page not found", 404);
  return updated;
};

export const deletePage = async (models, id) => {
  const row = await deletePageRepo(models, id);
  if (!row) throw new APIError("Page not found", 404);
  return { id };
};
