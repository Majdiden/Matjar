import {
  listCollectionsRepo,
  getCollectionRepo,
  getCollectionByHandleRepo,
  createCollectionRepo,
  updateCollectionRepo,
  deleteCollectionRepo,
  addProductsRepo,
  removeProductsRepo,
  reorderProductsRepo,
} from "../repositories/collection.js";
import { APIError } from "../middlewares/errorHandler.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a string to a URL-safe slug.
 * e.g. "My Best Collection!" → "my-best-collection"
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Ensure the desired handle is unique within the tenant.
 * If there is a conflict, append -2, -3, … until a free slot is found.
 * Optionally pass `excludeId` when updating an existing collection (so we
 * don't conflict with ourselves).
 */
async function uniqueHandle(models, base, excludeId = null) {
  let candidate = base;
  let suffix = 1;
  for (;;) {
    const filter = { handle: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    const existing = await models.Collection.findOne(filter).lean();
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

/**
 * Translate a single smart-collection rule to a Mongoose filter fragment.
 * Covers all operators × fields documented in the spec.
 */
function ruleToFilter(rule) {
  const { field, operator, value } = rule;

  // Map collection-rule field names to actual Product schema field names
  const fieldMap = {
    tag: "tags",
    title: "name",
    price: "price",
    inventory: "stock",
    category: "category",
  };

  const schemaField = fieldMap[field];
  if (!schemaField) return {};

  // tag / array fields
  if (field === "tag") {
    switch (operator) {
      case "equals":    return { tags: value };
      case "not_equals": return { tags: { $ne: value } };
      case "contains":  return { tags: { $regex: value, $options: "i" } };
      case "starts_with": return { tags: { $regex: `^${escapeRegex(value)}`, $options: "i" } };
      case "ends_with": return { tags: { $regex: `${escapeRegex(value)}$`, $options: "i" } };
      case "in":        return { tags: { $in: Array.isArray(value) ? value : [value] } };
      default:          return {};
    }
  }

  // numeric fields
  if (field === "price" || field === "inventory") {
    switch (operator) {
      case "equals":        return { [schemaField]: Number(value) };
      case "not_equals":    return { [schemaField]: { $ne: Number(value) } };
      case "greater_than":  return { [schemaField]: { $gt: Number(value) } };
      case "less_than":     return { [schemaField]: { $lt: Number(value) } };
      case "in":            return { [schemaField]: { $in: (Array.isArray(value) ? value : [value]).map(Number) } };
      default:              return {};
    }
  }

  // category (ObjectId reference)
  if (field === "category") {
    switch (operator) {
      case "equals":    return { category: value };
      case "not_equals": return { category: { $ne: value } };
      case "in":        return { category: { $in: Array.isArray(value) ? value : [value] } };
      default:          return {};
    }
  }

  // string fields: title (mapped to `name`), vendor, productType
  switch (operator) {
    case "equals":      return { [schemaField]: { $regex: `^${escapeRegex(value)}$`, $options: "i" } };
    case "not_equals":  return { [schemaField]: { $not: { $regex: `^${escapeRegex(value)}$`, $options: "i" } } };
    case "contains":    return { [schemaField]: { $regex: escapeRegex(value), $options: "i" } };
    case "starts_with": return { [schemaField]: { $regex: `^${escapeRegex(value)}`, $options: "i" } };
    case "ends_with":   return { [schemaField]: { $regex: `${escapeRegex(value)}$`, $options: "i" } };
    case "in":          return { [schemaField]: { $in: Array.isArray(value) ? value : [value] } };
    default:            return {};
  }
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a Mongo filter from an array of rules + rulesMatch ("all" | "any").
 */
function compileRules(rules, rulesMatch) {
  const fragments = rules.map(ruleToFilter).filter((f) => Object.keys(f).length > 0);
  if (fragments.length === 0) return {};
  if (fragments.length === 1) return fragments[0];
  return rulesMatch === "any" ? { $or: fragments } : { $and: fragments };
}

/**
 * Build sort options for the Product query from a collection's sortOrder.
 */
function sortOrderToMongo(sortOrder) {
  switch (sortOrder) {
    case "title-asc":    return { name: 1 };
    case "title-desc":   return { name: -1 };
    case "price-asc":    return { price: 1 };
    case "price-desc":   return { price: -1 };
    case "created-asc":  return { createdAt: 1 };
    case "created-desc": return { createdAt: -1 };
    case "best-selling": return { reviewCount: -1, rating: -1 };
    default:             return { createdAt: -1 }; // "manual" handled separately
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

export const listCollections = async (models, { page = 1, limit = 20, search, published } = {}) => {
  const parsedPublished = published === "true" ? true : published === "false" ? false : undefined;
  return listCollectionsRepo(models, { page, limit, search, published: parsedPublished });
};

export const getCollection = async (models, id) => {
  const collection = await getCollectionRepo(models, id);
  if (!collection) throw new APIError("Collection not found", 404);
  return collection;
};

export const getCollectionByHandle = async (models, handle) => {
  const collection = await getCollectionByHandleRepo(models, handle);
  if (!collection) throw new APIError("Collection not found", 404);
  return collection;
};

export const createCollection = async (models, tenantId, data) => {
  const { title, description, descriptionHtml, image, type, rules, rulesMatch, sortOrder, isPublished, seo } = data;

  if (!title || typeof title !== "string" || !title.trim()) {
    throw new APIError("title is required", 400);
  }

  // Generate handle
  let baseHandle = data.handle ? slugify(data.handle) : slugify(title);
  if (!baseHandle) throw new APIError("Could not generate a valid handle from title", 400);
  const handle = await uniqueHandle(models, baseHandle);

  // Validate rules for smart collections
  if (type === "smart" && rules && rules.length > 0) {
    validateRules(rules);
  }

  const now = new Date();
  const doc = await createCollectionRepo(models, tenantId, {
    title: title.trim(),
    handle,
    description: description || "",
    descriptionHtml: descriptionHtml || "",
    image: image || {},
    type: type || "manual",
    productIds: [],
    rules: rules || [],
    rulesMatch: rulesMatch || "all",
    sortOrder: sortOrder || "manual",
    isPublished: isPublished !== undefined ? isPublished : true,
    publishedAt: (isPublished !== false) ? now : undefined,
    seo: seo || {},
    createdAt: now,
    updatedAt: now,
  });
  return doc.toObject ? doc.toObject() : doc;
};

export const updateCollection = async (models, id, patch) => {
  const existing = await getCollectionRepo(models, id);
  if (!existing) throw new APIError("Collection not found", 404);

  const allowed = {};
  if (patch.title !== undefined) {
    if (!patch.title || !patch.title.trim()) throw new APIError("title cannot be empty", 400);
    allowed.title = patch.title.trim();
  }
  if (patch.handle !== undefined) {
    const baseHandle = slugify(patch.handle);
    if (!baseHandle) throw new APIError("Invalid handle", 400);
    allowed.handle = await uniqueHandle(models, baseHandle, id);
  } else if (patch.title !== undefined && !patch.handle) {
    // Auto-re-slug only if explicitly changing title and no handle provided
    // (keep existing handle by default to avoid breaking URLs)
  }
  if (patch.description !== undefined) allowed.description = patch.description;
  if (patch.descriptionHtml !== undefined) allowed.descriptionHtml = patch.descriptionHtml;
  if (patch.image !== undefined) allowed.image = patch.image;
  if (patch.type !== undefined) allowed.type = patch.type;
  if (patch.rules !== undefined) {
    if (patch.type === "smart" || existing.type === "smart") validateRules(patch.rules);
    allowed.rules = patch.rules;
  }
  if (patch.rulesMatch !== undefined) allowed.rulesMatch = patch.rulesMatch;
  if (patch.sortOrder !== undefined) allowed.sortOrder = patch.sortOrder;
  if (patch.isPublished !== undefined) {
    allowed.isPublished = patch.isPublished;
    if (patch.isPublished && !existing.publishedAt) allowed.publishedAt = new Date();
  }
  if (patch.seo !== undefined) allowed.seo = patch.seo;

  const updated = await updateCollectionRepo(models, id, allowed);
  if (!updated) throw new APIError("Collection not found", 404);
  return updated;
};

export const deleteCollection = async (models, id) => {
  const row = await deleteCollectionRepo(models, id);
  if (!row) throw new APIError("Collection not found", 404);
  return { id };
};

export const addProducts = async (models, id, productIds) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new APIError("productIds must be a non-empty array", 400);
  }
  // Validate that all referenced products exist in this tenant
  const existing = await models.Product.find({ _id: { $in: productIds } }).lean();
  if (existing.length !== productIds.length) {
    throw new APIError("One or more product IDs not found", 404);
  }
  const updated = await addProductsRepo(models, id, productIds);
  if (!updated) throw new APIError("Collection not found", 404);
  return updated;
};

export const removeProducts = async (models, id, productIds) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new APIError("productIds must be a non-empty array", 400);
  }
  const updated = await removeProductsRepo(models, id, productIds);
  if (!updated) throw new APIError("Collection not found", 404);
  return updated;
};

export const reorderProducts = async (models, id, productIds) => {
  if (!Array.isArray(productIds)) throw new APIError("productIds must be an array", 400);
  const updated = await reorderProductsRepo(models, id, productIds);
  if (!updated) throw new APIError("Collection not found", 404);
  return updated;
};

/**
 * Resolve the products belonging to a collection.
 * - Manual: returns products in productIds order, applying sortOrder if not "manual".
 * - Smart: builds a Mongo query from rules and runs it against the Product model.
 * Returns { products, pagination }.
 */
export const resolveProducts = async (models, collection, { page = 1, limit = 24, sortOrder, includeDrafts = false } = {}) => {
  const effectiveSortOrder = sortOrder || collection.sortOrder || "manual";
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Owner-preview of a DRAFT store resolves draft products too, so the
  // collection page isn't empty before the store is published. The public
  // path keeps the strict `status: "active"` gate.
  const statusFilter = includeDrafts ? {} : { status: "active" };

  if (collection.type === "smart") {
    const rulesFilter = compileRules(collection.rules || [], collection.rulesMatch || "all");
    const filter = { ...rulesFilter, ...statusFilter };
    const sortOpts = sortOrderToMongo(effectiveSortOrder);

    const [products, total] = await Promise.all([
      models.Product.find(filter).sort(sortOpts).skip(skip).limit(limitNum).lean(),
      models.Product.countDocuments(filter),
    ]);

    return {
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  // Manual collection
  const productIds = collection.productIds || [];

  if (effectiveSortOrder === "manual") {
    // Preserve explicit ordering
    const allProducts = await models.Product.find({
      _id: { $in: productIds },
      ...statusFilter,
    }).lean();

    // Re-sort to match the productIds order
    const productMap = new Map(allProducts.map((p) => [String(p._id), p]));
    const ordered = productIds
      .map((id) => productMap.get(String(id)))
      .filter(Boolean);

    const total = ordered.length;
    const paginated = ordered.slice(skip, skip + limitNum);
    return {
      products: paginated,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  // Manual collection with a sort applied
  const sortOpts = sortOrderToMongo(effectiveSortOrder);
  const [products, total] = await Promise.all([
    models.Product.find({ _id: { $in: productIds }, ...statusFilter })
      .sort(sortOpts)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    models.Product.countDocuments({ _id: { $in: productIds }, ...statusFilter }),
  ]);

  return {
    products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
};

// ─── Internal validators ──────────────────────────────────────────────────────

// vendor / productType are accepted by the UI for forward compatibility but
// the Product schema does not have these fields yet — reject so that merchants
// don't build rules that silently match everything.
const VALID_FIELDS = ["tag", "title", "price", "inventory", "category"];
const VALID_OPERATORS = ["equals", "not_equals", "greater_than", "less_than", "contains", "starts_with", "ends_with", "in"];
const NUMERIC_FIELDS = new Set(["price", "inventory"]);
const NUMERIC_OPERATORS = new Set(["equals", "not_equals", "greater_than", "less_than", "in"]);

function validateRules(rules) {
  if (!Array.isArray(rules)) throw new APIError("rules must be an array", 400);
  for (const rule of rules) {
    if (!VALID_FIELDS.includes(rule.field)) {
      throw new APIError(`Invalid rule field: ${rule.field}`, 400);
    }
    if (!VALID_OPERATORS.includes(rule.operator)) {
      throw new APIError(`Invalid rule operator: ${rule.operator}`, 400);
    }
    if (rule.value === undefined || rule.value === null || rule.value === "") {
      throw new APIError("Rule value is required", 400);
    }
    if (NUMERIC_FIELDS.has(rule.field) && NUMERIC_OPERATORS.has(rule.operator)) {
      const values = Array.isArray(rule.value) ? rule.value : [rule.value];
      for (const v of values) {
        if (Number.isNaN(Number(v))) {
          throw new APIError(`Rule value for ${rule.field} must be numeric`, 400);
        }
      }
    }
  }
}
