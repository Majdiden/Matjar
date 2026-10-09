import {
  addAProductRepo,
  getAProductRepo,
  getProductsRepo,
  updateAProductRepo,
  deleteAProductRepo,
} from "../repositories/product.js";
import { redirectRenamedPath } from "./redirect.js";
import { slugify, ensureUniqueSlug } from "../utils/slugify.js";
import { ensureQuickAddCategory } from "./category.js";
import crypto from "node:crypto";
import logger from "../utils/logger.js";

// Fallback prefix when a name yields no slug at all ("product-3f9a1c").
const PRODUCT_SLUG_FALLBACK = "product";
// Only a live product has shared links worth preserving with a redirect.
const PUBLISHED_STATUS = "active";
// Storefront product URL (storefront-themes/_shared/app/createThemeApp.tsx).
const productPath = (slug) => `/products/${slug}`;

/**
 * Name a product's link is derived from: the English name when the merchant
 * filled it in, else the primary name (often Arabic — transliterated), else
 * the Arabic translation.
 */
const slugSourceName = (body) =>
  body.translations?.en?.name || body.name || body.translations?.ar?.name || "";

/**
 * `exists` predicate for ensureUniqueSlug. The compound `(tenantId, slug)`
 * unique index is the final authority — this just avoids returning a 409.
 */
const productSlugTaken = (models) => async (candidate) =>
  Boolean(await models.Product.findOne({ slug: candidate }).select("_id"));

/**
 * Create a product from an already-validated body. The schema requires
 * `slug` but the client doesn't have to provide one: it is derived from the
 * product name (Arabic transliterated) and deduped within the tenant. A
 * merchant-typed slug goes through the same rule.
 */
async function createProduct(models, input) {
  const body = { ...input };
  const typedSlug = typeof body.slug === "string" ? slugify(body.slug) : "";
  body.slug = await ensureUniqueSlug(
    productSlugTaken(models),
    typedSlug || slugify(slugSourceName(body)),
    { fallback: PRODUCT_SLUG_FALLBACK }
  );
  return addAProductRepo(models, body);
}

export const addProduct = async (req, res) => {
  const data = await createProduct(req.models, req.body);
  return {
    success: true,
    statusCode: 201,
    message: "Product added successfully",
    responseObject: { data },
  };
};

/**
 * Quick add (PBI 10): photo, name, price and quantity are all a first-time
 * seller gives us. The rest is filled in so the product can be sold at once:
 * published, in the store's "Our products" category, and described by its
 * name until the merchant writes a description in the full form, with a
 * generated SKU. Only the
 * listed fields are read; the validator has already checked them.
 */
// Quick-add SKUs: "QA-" + 10 hex digits. The (tenantId, sku) index treats a
// missing SKU as a value, so every product needs its own; the merchant can
// replace it in the full form.
const QUICK_SKU_PREFIX = "QA-";
const QUICK_SKU_RANDOM_BYTES = 5;
const quickSku = () => `${QUICK_SKU_PREFIX}${crypto.randomBytes(QUICK_SKU_RANDOM_BYTES).toString("hex").toUpperCase()}`;

export const addQuickProduct = async (req) => {
  const { name, price, stock, images = [], description } = req.body;
  const language = req.tenant?.settings?.language === "en" ? "en" : "ar";
  const category = await ensureQuickAddCategory(req.models, language);
  const data = await createProduct(req.models, {
    name,
    price,
    stock,
    images,
    description: description || name,
    category,
    sku: quickSku(),
    status: PUBLISHED_STATUS,
  });
  return {
    success: true,
    statusCode: 201,
    message: "Product added successfully",
    responseObject: { data },
  };
};

export const getProduct = async (req, res) => {
  try {
    // `getAProductRepo(models, selectQuery, findQuery)` — the id from the
    // URL is the filter, not the select. Passing `req.query` here (as was
    // done previously) left findQuery empty, so `findOne({})` always
    // returned the tenant's first product regardless of the :id in the
    // URL — every dashboard PDP rendered the same product.
    const data = await getAProductRepo(req.models, {}, { _id: req.params.id });
    if (!data) {
      return {
        success: false,
        statusCode: 404,
        message: "Product not found",
      };
    }
    return {
      success: true,
      statusCode: 200,
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, minPrice, maxPrice, sort } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const findQuery = {};
    if (search) {
      findQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (category) findQuery.category = category;
    if (minPrice || maxPrice) {
      findQuery.price = {};
      if (minPrice) findQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice) findQuery.price.$lte = parseFloat(maxPrice);
    }

    let sortQuery = {};
    if (sort) {
      if (sort.startsWith("-")) {
        sortQuery[sort.substring(1)] = -1;
      } else {
        sortQuery[sort] = 1;
      }
    } else {
      sortQuery = { createdAt: -1 };
    }

    const [products, total] = await Promise.all([
      req.models.Product.find(findQuery)
        .populate("category", "name slug")
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      req.models.Product.countDocuments(findQuery),
    ]);

    return {
      success: true,
      statusCode: 200,
      responseObject: {
        data: products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    };
  } catch (error) {
    throw error;
  }
};

export const updateProduct = async (req, res) => {
  try {
    // Strip fields that should never be overwritten by a client request.
    const { _id, tenantId, createdAt, ...body } = req.body || {};

    // Slug is uniquely indexed per (tenantId, slug). Touching it on every
    // edit causes two problems:
    //   1. If the merchant didn't change the slug, re-setting it to its
    //      current value still makes Mongo re-validate the index — and if
    //      duplicate slugs exist in legacy data, that validation fails.
    //   2. If they DID change it, we want a friendly 409 instead of a raw
    //      E11000 leaking out of the driver.
    // Renaming a product never touches the slug, so shared links keep
    // working. Only an explicit slug edit changes it — and for a live
    // product the old URL then 301-redirects to the new one.
    let redirectFromSlug = null;
    if (typeof body.slug === "string") {
      const current = await req.models.Product.findById(req.params.id).select("slug status");
      if (!current) {
        return {
          success: false,
          statusCode: 404,
          message: "Product not found",
          responseObject: null,
        };
      }
      const normalized = slugify(body.slug);
      if (!normalized || normalized === current.slug) {
        // No-op — strip from the update so the unique index isn't re-checked.
        // A blank / unusable slug also keeps the current link.
        delete body.slug;
      } else {
        body.slug = normalized;
        const conflict = await req.models.Product.findOne({
          slug: normalized,
          _id: { $ne: req.params.id },
        }).select("_id");
        if (conflict) {
          return {
            success: false,
            statusCode: 409,
            message: `Another product already uses the slug "${normalized}". Pick a different one.`,
            responseObject: null,
          };
        }
        if (current.status === PUBLISHED_STATUS) redirectFromSlug = current.slug;
      }
    }

    let data;
    try {
      data = await updateAProductRepo(
        req.models,
        { _id: req.params.id },
        { $set: body }
      );
    } catch (err) {
      // Defensive: if the user has legacy duplicate slugs in the collection,
      // any write that touches the indexed fields can still trip E11000.
      // Surface a readable message instead of crashing the request.
      if (err?.code === 11000) {
        const dupField = Object.keys(err.keyPattern || {}).join(", ") || "field";
        return {
          success: false,
          statusCode: 409,
          message: `Duplicate ${dupField} — another product in your store already uses this value.`,
          responseObject: null,
        };
      }
      throw err;
    }

    // updateOne returns { matchedCount, modifiedCount, ... }. If no doc
    // matched, the product either doesn't exist or belongs to another
    // tenant — return 404 either way to prevent cross-tenant probing.
    if (!data || data.matchedCount === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Product not found",
        responseObject: null,
      };
    }

    if (redirectFromSlug) {
      // Best-effort: the slug change already succeeded, so a redirect
      // failure is logged rather than failing the save.
      try {
        await redirectRenamedPath(req.models, productPath(redirectFromSlug), productPath(body.slug));
      } catch (err) {
        logger.warn("Product slug redirect failed", {
          from: redirectFromSlug,
          to: body.slug,
          error: err.message,
        });
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: "Product updated successfully",
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const deleteProduct = async (req, res) => {
  try {
    // Repo expects a Mongoose filter object, not a raw id. Wrap explicitly
    // so we never accidentally pass a string and end up matching nothing
    // (or worse, with a different schema, matching everything).
    const data = await deleteAProductRepo(req.models, { _id: req.params.id });
    if (!data || data.deletedCount === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Product not found",
        responseObject: null,
      };
    }
    return {
      success: true,
      statusCode: 200,
      message: "Product deleted successfully",
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};
