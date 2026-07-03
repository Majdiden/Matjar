import * as PageService from "../services/page.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { isValidEditorPreviewToken } from "../services/themeCustomization.js";

// ─── Admin controllers ───────────────────────────────────────────────────────

export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, published, locale } = req.query;
  const { pages, total } = await PageService.listPages(req.models, {
    page,
    limit,
    search,
    published,
    locale,
  });
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  res.json({
    success: true,
    data: {
      pages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

export const get = asyncHandler(async (req, res) => {
  const page = await PageService.getPage(req.models, req.params.id);
  res.json({ success: true, data: page });
});

export const create = asyncHandler(async (req, res) => {
  const page = await PageService.createPage(req.models, req.body || {});
  res.status(201).json({ success: true, data: page });
});

export const update = asyncHandler(async (req, res) => {
  const page = await PageService.updatePage(
    req.models,
    req.params.id,
    req.body || {}
  );
  res.json({ success: true, data: page });
});

export const remove = asyncHandler(async (req, res) => {
  await PageService.deletePage(req.models, req.params.id);
  res.json({ success: true });
});

// ─── Storefront controllers (public) ─────────────────────────────────────────

/**
 * Sanitize a page for public storefront consumption. We intentionally
 * never expose internal timestamps like updatedAt here — the storefront
 * doesn't need them, and publishing is already gated by isPublished so
 * a published page is the source of truth.
 */
function publicPage(page) {
  if (!page) return null;
  return {
    _id: page._id,
    slug: page.slug,
    title: page.title,
    content: page.content,
    metaTitle: page.metaTitle || page.title,
    metaDescription: page.metaDescription || "",
    locale: page.locale,
    publishedAt: page.publishedAt,
  };
}

export const storefrontListPages = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, locale } = req.query;
  const { pages, total } = await PageService.listPages(req.models, {
    page,
    limit,
    locale,
    published: "true",
  });
  // Storefront list returns minimal fields — no `content`, no meta desc —
  // so theme footer/sitemap renders don't have to pull down every page's
  // full HTML body just to show titles + slugs.
  const minimal = (pages || []).map((p) => ({
    _id: p._id,
    slug: p.slug,
    title: p.title,
    locale: p.locale,
  }));
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  res.json({
    success: true,
    data: {
      pages: minimal,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

export const storefrontGetPageBySlug = asyncHandler(async (req, res) => {
  const page = await PageService.getPageBySlug(
    req.models,
    req.params.slug,
    req.query.locale
  );
  // Published-gate on the public surface. We surface 404 rather than 403
  // so an unpublished page is indistinguishable from a never-existed one.
  // Scheduled publishing (audit 6.5): a future publishAt keeps the page
  // hidden until its time arrives — checked at read time, no cron.
  const scheduledForFuture =
    page && page.publishAt && new Date(page.publishAt) > new Date();
  const hidden = !page || !page.isPublished || scheduledForFuture;

  if (hidden) {
    // Editor preview bypass (audit 6.4). A request carrying the tenant's
    // valid, unexpired EDITOR preview token (themeCustomization.previewToken
    // — the exact token /store-info validates) may view an unpublished or
    // scheduled page. Everyone else gets the same 404 as a missing page.
    const previewToken =
      typeof req.query.preview === "string" ? req.query.preview : null;
    const previewAllowed =
      !!page && !!previewToken && isValidEditorPreviewToken(req.tenant, previewToken);
    if (!previewAllowed) {
      return res.status(404).json({ success: false, message: "Page not found" });
    }
  }
  res.json({ success: true, data: publicPage(page) });
});
