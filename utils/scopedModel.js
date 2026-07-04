import mongoose from "mongoose";

/**
 * Scoped Model Factory
 * Creates model proxies that automatically inject tenantId into all operations.
 * This makes cross-tenant data leaks structurally impossible.
 *
 * Usage:
 *   const models = createScopedModels(connection, tenantId);
 *   const products = await models.Product.find({ status: 'active' });
 *   // Automatically becomes: Product.find({ tenantId, status: 'active' })
 */

/**
 * Wrap a Mongoose model to auto-inject tenantId into every operation.
 * Returns an object with the same query API as a Mongoose model.
 */
/**
 * Normalize any of mongoose's populate() arg shapes into an array of
 * plain option objects we can mutate. Handles:
 *   .populate("path")
 *   .populate("path", "select")
 *   .populate({ path, select, match, populate: ... })
 *   .populate([ ...any of the above ])
 *   .populate("path", "select", "Model", match, options)
 */
function normalizePopulateArgs(args) {
  if (args.length === 0) return [];
  const [first, second, third, fourth, fifth] = args;
  if (Array.isArray(first)) {
    return first.map((x) => (typeof x === "string" ? { path: x } : { ...x }));
  }
  if (typeof first === "object" && first !== null) {
    return [{ ...first }];
  }
  const opt = { path: first };
  if (second !== undefined) opt.select = second;
  if (third !== undefined) opt.model = third;
  if (fourth !== undefined) opt.match = fourth;
  if (fifth !== undefined) opt.options = fifth;
  return [opt];
}

/**
 * Resolve the target model name for a populate path on a given schema.
 * Handles dotted paths (e.g. "products.product") and arrays-of-refs.
 */
function resolveRef(schema, path) {
  if (!schema || !path) return null;
  try {
    const schemaType = schema.path(path);
    if (!schemaType) return null;
    // Array of refs
    if (schemaType.caster && schemaType.caster.options && schemaType.caster.options.ref) {
      return schemaType.caster.options.ref;
    }
    if (schemaType.options && schemaType.options.ref) {
      return schemaType.options.ref;
    }
  } catch (_) {
    /* no-op */
  }
  return null;
}

/**
 * Wrap a Mongoose Query so that .populate(...) auto-injects
 * `match: { tenantId }` when the populated model is itself
 * tenant-scoped. This closes the populate tenant-leak hole: a naive
 * `.populate("category")` on Tenant A's query would otherwise run an
 * unscoped Category.findById that could surface Tenant B's data if
 * the referenced ObjectId happened to match.
 *
 * Unscoped refs (Tenant, Theme, etc.) are left alone — they don't
 * carry a tenantId, so injecting the match would return nothing.
 */
function scopeQueryPopulate(query, tid) {
  if (!query || typeof query.populate !== "function") return query;
  const originalPopulate = query.populate.bind(query);
  query.populate = function (...args) {
    const opts = normalizePopulateArgs(args);
    const scoped = opts.map((opt) => {
      const ref = opt.model || resolveRef(query.model && query.model.schema, opt.path);
      if (ref && TENANT_SCOPED_SET.has(ref)) {
        return { ...opt, match: { ...(opt.match || {}), tenantId: tid } };
      }
      return opt;
    });
    return originalPopulate(scoped);
  };
  return query;
}

export function createScopedModel(connection, modelName, tenantId) {
  const Model = connection.model(modelName);
  const tid = new mongoose.Types.ObjectId(tenantId);

  return {
    modelName,

    // Queries - auto-inject tenantId into filter
    find(filter = {}, ...args) {
      return scopeQueryPopulate(Model.find({ ...filter, tenantId: tid }, ...args), tid);
    },

    findOne(filter = {}, ...args) {
      return scopeQueryPopulate(Model.findOne({ ...filter, tenantId: tid }, ...args), tid);
    },

    findById(id, ...args) {
      return scopeQueryPopulate(Model.findOne({ _id: id, tenantId: tid }, ...args), tid);
    },

    countDocuments(filter = {}, ...args) {
      return Model.countDocuments({ ...filter, tenantId: tid }, ...args);
    },

    exists(filter = {}) {
      return Model.exists({ ...filter, tenantId: tid });
    },

    // Create - auto-inject tenantId into documents.
    //
    // Match native Mongoose semantics: Model.create(doc) returns a doc,
    // Model.create([doc]) returns an array. The previous implementation
    // always wrapped input in an array, which broke any caller that did
    // `const cart = await models.Cart.create({...})` followed by
    // `cart.save()` — they got an array back, not a document, and
    // `[doc].save()` blew up with "save is not a function".
    create(docs, options = {}) {
      const isBatch = Array.isArray(docs);
      const docsArray = isBatch ? docs : [docs];
      const scopedDocs = docsArray.map((doc) => ({ ...doc, tenantId: tid }));
      const result = Model.create(scopedDocs, options);
      return isBatch ? result : result.then((arr) => arr[0]);
    },

    // Update - auto-inject tenantId into filter
    updateOne(filter, update, options = {}) {
      return Model.updateOne({ ...filter, tenantId: tid }, update, options);
    },

    updateMany(filter, update, options = {}) {
      return Model.updateMany({ ...filter, tenantId: tid }, update, options);
    },

    findOneAndUpdate(filter, update, options = {}) {
      return scopeQueryPopulate(
        Model.findOneAndUpdate({ ...filter, tenantId: tid }, update, options),
        tid
      );
    },

    findByIdAndUpdate(id, update, options = {}) {
      return scopeQueryPopulate(
        Model.findOneAndUpdate({ _id: id, tenantId: tid }, update, options),
        tid
      );
    },

    // Delete - auto-inject tenantId into filter
    deleteOne(filter, options = {}) {
      return Model.deleteOne({ ...filter, tenantId: tid }, options);
    },

    deleteMany(filter, options = {}) {
      return Model.deleteMany({ ...filter, tenantId: tid }, options);
    },

    findOneAndDelete(filter, options = {}) {
      return scopeQueryPopulate(
        Model.findOneAndDelete({ ...filter, tenantId: tid }, options),
        tid
      );
    },

    findByIdAndDelete(id, options = {}) {
      return scopeQueryPopulate(
        Model.findOneAndDelete({ _id: id, tenantId: tid }, options),
        tid
      );
    },

    // Aggregate - prepend $match with tenantId
    aggregate(pipeline = [], options = {}) {
      return Model.aggregate(
        [{ $match: { tenantId: tid } }, ...pipeline],
        options
      );
    },

    // Direct document instantiation (for new + save pattern)
    new(data = {}) {
      return new Model({ ...data, tenantId: tid });
    },

    // Escape hatch for admin/migration operations
    get __raw() {
      return Model;
    },

    // Access the underlying schema
    get schema() {
      return Model.schema;
    },
  };
}

/**
 * List of all tenant-scoped models (models that have tenantId).
 * Admin models (Tenant, TenantUser, Subscription) are NOT scoped.
 */
const TENANT_SCOPED_MODELS = [
  "User",
  "Product",
  "Category",
  "Order",
  "Cart",
  "Promotion",
  "Tax",
  "Shipping",
  "Discount",
  "Payment",
  "Review",
  "Wishlist",
  "SupportTicket",
  "Currency",
  "ProductI18n",
  "Analytics",
  "Webhook",
  "RefreshToken",
  "AuditLog",
  "Market",
  "Company",
  "CustomField",
  "Asset",
  "CustomerSegment",
  "ThemeCustomizationVersion",
  "Collection",
  "Menu",
  "GiftCard",
  "StaffInvite",
  "PaymentMethod",
  "Role",
  "IdempotencyRecord",
  "Notification",
  "Page",
  "Redirect",
  "WebauthnCredential",
];

/**
 * Admin (unscoped) models - these don't have tenantId
 */
const ADMIN_MODELS = ["Tenant", "TenantUser", "Subscription", "Theme"];

const TENANT_SCOPED_SET = new Set(TENANT_SCOPED_MODELS);

/**
 * Create all scoped models for a tenant request.
 * Returns an object with both scoped (tenant) and unscoped (admin) models.
 */
export function createScopedModels(connection, tenantId) {
  const models = {};

  // Create scoped models for tenant data
  for (const name of TENANT_SCOPED_MODELS) {
    models[name] = createScopedModel(connection, name, tenantId);
  }

  // Add unscoped admin models (no tenantId injection)
  for (const name of ADMIN_MODELS) {
    models[name] = connection.model(name);
  }

  return models;
}

export { TENANT_SCOPED_MODELS, ADMIN_MODELS };

/**
 * Build a populate options object that is pinned to a given tenant.
 *
 * The scoped-query wrapper in this file covers the common case of
 * `req.models.Foo.find(...).populate("bar")`, but Mongoose also lets
 * you populate a document that's already been loaded
 * (`await doc.populate("bar")`). That path bypasses the wrapper —
 * Mongoose issues a raw query against the referenced model with no
 * tenant filter. If the document somehow holds a cross-tenant
 * ObjectId (import bug, migration, manual DB edit), a naive
 * `doc.populate("bar")` would happily load Tenant B's record into
 * Tenant A's response.
 *
 * Use this helper everywhere a document-level populate runs:
 *
 *   await cart.populate(tenantPopulate("items.product", req.tenantId));
 *
 * For refs pointing at unscoped admin models (Tenant, Theme), just
 * call populate directly — injecting a tenantId match there would
 * always return nothing.
 */
export function tenantPopulate(path, tenantId, select, extra = {}) {
  const opt = { path, ...extra };
  if (select !== undefined) opt.select = select;
  opt.match = { ...(extra.match || {}), tenantId };
  return opt;
}
