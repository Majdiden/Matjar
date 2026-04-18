import {
  addAProductRepo,
  getAProductRepo,
  getProductsRepo,
  updateAProductRepo,
  deleteAProductRepo,
} from "../repositories/product.js";

/**
 * URL-safe slug derived from a free-form string. Lowercase, dashes for
 * spaces, drops anything outside `[a-z0-9-]`, collapses runs, trims.
 * Capped at 100 chars to keep within the schema's slug allowance.
 */
const slugify = (input) =>
  String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

/**
 * Pick a slug that doesn't collide with an existing product in this
 * tenant. We append `-2`, `-3`, … until we find a free one. The
 * compound `(tenantId, slug)` unique index in the schema is the final
 * authority — this is just to avoid the friction of returning a 409.
 */
const ensureUniqueSlug = async (models, base) => {
  const safeBase = base || "product";
  let candidate = safeBase;
  let suffix = 2;
  // Bounded loop — give up after 50 attempts and fall back to a
  // timestamp suffix to guarantee progress under pathological races.
  for (let i = 0; i < 50; i++) {
    const exists = await models.Product.findOne({ slug: candidate }).select("_id");
    if (!exists) return candidate;
    candidate = `${safeBase}-${suffix++}`;
  }
  return `${safeBase}-${Date.now()}`;
};

export const addProduct = async (req, res) => {
  try {
    // Schema requires `slug` but the client doesn't have to provide one —
    // we derive it from the product name and dedupe within the tenant.
    const body = { ...req.body };
    if (!body.slug) {
      const base = slugify(body.name);
      body.slug = await ensureUniqueSlug(req.models, base);
    } else {
      body.slug = slugify(body.slug);
    }

    const data = await addAProductRepo(req.models, body);
    return {
      success: true,
      statusCode: 201,
      message: "Product added successfully",
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
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
    if (typeof body.slug === "string") {
      const current = await req.models.Product.findById(req.params.id).select("slug");
      if (!current) {
        return {
          success: false,
          statusCode: 404,
          message: "Product not found",
          responseObject: null,
        };
      }
      const normalized = body.slug.trim().toLowerCase();
      if (normalized === current.slug) {
        // No-op — strip from the update so the unique index isn't re-checked.
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
