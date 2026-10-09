import * as PageService from "../services/page.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { isValidEditorPreviewToken } from "../services/themeCustomization.js";
import { GENERATOR_KIND } from "../services/generatedPages.js";

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
  const generated = publicAboutFacts(page);
  return {
    _id: page._id,
    slug: page.slug,
    title: page.title,
    content: page.content,
    metaTitle: page.metaTitle || page.title,
    metaDescription: page.metaDescription || "",
    locale: page.locale,
    publishedAt: page.publishedAt,
    ...(generated && { generated }),
  };
}

const pickText = (text) => {
  if (!text || typeof text !== "object") return null;
  const out = {};
  for (const lang of ["ar", "en"]) {
    if (typeof text[lang] === "string" && text[lang].trim()) out[lang] = text[lang].trim();
  }
  return Object.keys(out).length ? out : null;
};

/**
 * Structured facts of an About page written from the merchant's answers
 * (PBI 10-9), so the storefront can show them as cards next to the text:
 * `{ kind: "about", since?, city?: {ar,en}, photo? }`. Only while the page
 * is still the generated text — once the merchant edits it by hand the
 * answers may no longer match what the page says, so nothing is exposed.
 * Never exposes any other generator field.
 */
function publicAboutFacts(page) {
  const gen = page.generator;
  if (!gen || gen.kind !== GENERATOR_KIND.about || gen.edited === true) return null;
  const answers = gen.answers || {};
  const out = { kind: GENERATOR_KIND.about };
  if (Number.isInteger(answers.since)) out.since = answers.since;
  const city = pickText(answers.city);
  if (city) out.city = city;
  if (typeof answers.photo === "string" && answers.photo) out.photo = answers.photo;
  return out;
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

/** Published and not scheduled for later — what a shopper may see. */
const isVisiblePage = (page) =>
  !!page && page.isPublished && !(page.publishAt && new Date(page.publishAt) > new Date());

export const storefrontGetPageBySlug = asyncHandler(async (req, res) => {
  // `?lang=` (sent by the storefront's usePage) PREFERS the visitor's
  // language among a slug's locales — e.g. the Arabic and English About
  // pages written by PBI 10-9 — and falls through to the original lookup
  // when that locale has no visible page. `?locale=` stays a strict filter.
  const lang = typeof req.query.lang === "string" ? req.query.lang.trim().toLowerCase() : "";
  if (lang && !req.query.locale) {
    const preferred = await PageService.getPageBySlug(req.models, req.params.slug, lang).catch((err) => {
      if (err?.statusCode === 404) return null;
      throw err;
    });
    if (isVisiblePage(preferred)) return res.json({ success: true, data: publicPage(preferred) });
  }

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
