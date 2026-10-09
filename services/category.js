import {
  addCategoryRepo,
  getCategoryRepo,
  getCategoriesRepo,
  updateCategoryRepo,
  deleteCategoryRepo,
} from "../repositories/category.js";
import { redirectRenamedPath } from "./redirect.js";
import { slugify, ensureUniqueSlug } from "../utils/slugify.js";
import logger from "../utils/logger.js";

// Fallback prefix when a name yields no slug at all ("category-3f9a1c").
const CATEGORY_SLUG_FALLBACK = "category";
// Only a live category has shared links worth preserving with a redirect.
const PUBLISHED_STATUS = "active";
// Storefront category URL (storefront-themes/_shared/app/createThemeApp.tsx).
const categoryPath = (slug) => `/categories/${slug}`;

/** English name when filled in, else the primary (often Arabic) name. */
const slugSourceName = (body) =>
  body.translations?.en?.name || body.name || body.translations?.ar?.name || "";

const categorySlugTaken = (models, excludeId = null) => async (candidate) => {
  const filter = { slug: candidate };
  if (excludeId) filter._id = { $ne: excludeId };
  return Boolean(await getCategoryRepo(models, "_id", filter));
};

/** systemKey of the category that holds quick-add products. */
export const QUICK_ADD_CATEGORY_KEY = "quick-add";
/** Its name in each store language; the store language picks the primary one. */
const QUICK_ADD_CATEGORY_NAMES = Object.freeze({ ar: "منتجاتنا", en: "Our products" });
const DUPLICATE_KEY_ERROR = 11000;

/**
 * The category quick-add products go into, created on first use. Found by
 * `systemKey`, so renaming it or changing its link doesn't create another.
 * Two first products saved at once race on the unique (tenantId, systemKey)
 * index; the loser reads the winner's category.
 */
export async function ensureQuickAddCategory(models, language = "ar") {
  const filter = { systemKey: QUICK_ADD_CATEGORY_KEY };
  const existing = await getCategoryRepo(models, "_id", filter);
  if (existing) return existing._id;

  const primary = QUICK_ADD_CATEGORY_NAMES[language] || QUICK_ADD_CATEGORY_NAMES.ar;
  const slug = await ensureUniqueSlug(
    categorySlugTaken(models),
    slugify(QUICK_ADD_CATEGORY_NAMES.en),
    { fallback: CATEGORY_SLUG_FALLBACK }
  );
  try {
    const created = await addCategoryRepo(models, {
      name: primary,
      translations: { ar: { name: QUICK_ADD_CATEGORY_NAMES.ar }, en: { name: QUICK_ADD_CATEGORY_NAMES.en } },
      slug,
      systemKey: QUICK_ADD_CATEGORY_KEY,
    });
    return created._id;
  } catch (error) {
    if (error?.code !== DUPLICATE_KEY_ERROR) throw error;
    const winner = await getCategoryRepo(models, "_id", filter);
    if (!winner) throw error; // the clash was on the slug, not the key
    return winner._id;
  }
}

export const addCategory = async (req, res) => {
  try {
    // The merchant never has to invent a slug: derive it from the name
    // (Arabic transliterated), or normalise the one they typed; dedupe
    // within the tenant (`-2`, `-3`, …).
    // systemKey marks platform-created categories; clients never set it.
    const { systemKey: _systemKey, ...body } = req.body || {};
    const typedSlug = typeof body.slug === "string" ? slugify(body.slug) : "";
    body.slug = await ensureUniqueSlug(
      categorySlugTaken(req.models),
      typedSlug || slugify(slugSourceName(body)),
      { fallback: CATEGORY_SLUG_FALLBACK }
    );
    const data = await addCategoryRepo(req.models, body);
    return {
      success: true,
      statusCode: 201,
      message: "Category added successfully",
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const getCategory = async (req, res) => {
  try {
    const data = await getCategoryRepo(req.models, req.query);
    return {
      success: true,
      statusCode: 200,
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const getCategories = async (req, res) => {
  try {
    const data = await getCategoriesRepo(req.models, req.query);
    return {
      success: true,
      statusCode: 200,
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { _id, tenantId, createdAt, systemKey: _systemKey, ...body } = req.body || {};
    const current = await getCategoryRepo(req.models, "slug status", { _id: req.params.id });
    if (!current) {
      return { success: false, statusCode: 404, message: "Category not found", responseObject: null };
    }

    // Renaming never changes the slug (shared links keep working). An
    // explicit slug edit is normalised, must be free, and — for a live
    // category — leaves a 301 from the old URL.
    let redirectFromSlug = null;
    if (typeof body.slug === "string") {
      const normalized = slugify(body.slug);
      if (!normalized || normalized === current.slug) {
        delete body.slug;
      } else {
        if (await categorySlugTaken(req.models, req.params.id)(normalized)) {
          return {
            success: false,
            statusCode: 409,
            message: `Another category already uses the slug "${normalized}". Pick a different one.`,
            responseObject: null,
          };
        }
        body.slug = normalized;
        if (current.status === PUBLISHED_STATUS) redirectFromSlug = current.slug;
      }
    }

    // Filter by the URL id — previously `req.path.id` (always undefined)
    // made this update the tenant's FIRST category instead.
    const data = await updateCategoryRepo(
      req.models,
      { _id: req.params.id },
      { $set: { ...body, updatedAt: new Date() } }
    );

    if (redirectFromSlug) {
      try {
        await redirectRenamedPath(req.models, categoryPath(redirectFromSlug), categoryPath(body.slug));
      } catch (err) {
        logger.warn("Category slug redirect failed", {
          from: redirectFromSlug,
          to: body.slug,
          error: err.message,
        });
      }
    }
    return {
      success: true,
      statusCode: 201,
      message: "Category updated successfully",
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const deleteCategory = async (req, res) => {
  try {
    // Filter by the URL id — `req.path.id` (always undefined) deleted the
    // tenant's FIRST category instead of the chosen one.
    const data = await deleteCategoryRepo(req.models, { _id: req.params.id });
    return {
      success: true,
      statusCode: 201,
      message: "Category deleted successfully",
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};
