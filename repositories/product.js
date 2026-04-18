const getProductsRepo = async (models, selectQuery = {}, findQuery = {}) => {
  return await models.Product.find(findQuery)
    .select(selectQuery)
    .lean()
    .populate("category");
};

const getAProductRepo = async (models, selectQuery = {}, findQuery = {}, session = null) => {
  // Read in-session when called from inside a transaction so the snapshot
  // matches what other writes in the same txn observe. Outside a txn the
  // session is just null and Mongoose ignores the option.
  const query = models.Product.findOne(findQuery)
    .select(selectQuery)
    .lean()
    .populate("category");
  if (session) query.session(session);
  return await query;
};

const addAProductRepo = async (models, productData, session = null) => {
  const options = session ? { session } : {};
  const data = await models.Product.create(productData, options);
  return Array.isArray(data) ? data[0] : data;
};

const updateAProductRepo = async (models, findQuery = {}, updateQuery = {}, session = null) => {
  const options = session ? { session } : {};
  return await models.Product.updateOne(findQuery, updateQuery, options);
};

const decrementStockRepo = async (models, productId, quantity, session = null) => {
  const options = session ? { session, new: true } : { new: true };
  const result = await models.Product.findOneAndUpdate(
    { _id: productId, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    options
  );
  return result; // null if insufficient stock
};

const incrementStockRepo = async (models, productId, quantity, session = null) => {
  const options = session ? { session, new: true } : { new: true };
  return await models.Product.findOneAndUpdate(
    { _id: productId },
    { $inc: { stock: quantity } },
    options
  );
};

/**
 * Atomically decrement a *variant*'s stock. Uses the positional `$` operator
 * scoped to a query that asserts the variant exists and has enough stock —
 * the entire operation is one atomic write, so two concurrent orders for the
 * same last-in-stock variant cannot both succeed.
 *
 * Returns the updated product on success, `null` if the variant doesn't
 * exist or the stock guard failed.
 */
const decrementVariantStockRepo = async (models, productId, variantId, quantity, session = null) => {
  const options = session ? { session, new: true } : { new: true };
  return await models.Product.findOneAndUpdate(
    {
      _id: productId,
      variants: { $elemMatch: { _id: variantId, stock: { $gte: quantity } } },
    },
    { $inc: { "variants.$.stock": -quantity } },
    options
  );
};

/**
 * Mirror of `decrementVariantStockRepo` used to roll stock back when an
 * order is cancelled. No stock guard — we always allow returning units.
 */
const incrementVariantStockRepo = async (models, productId, variantId, quantity, session = null) => {
  const options = session ? { session, new: true } : { new: true };
  return await models.Product.findOneAndUpdate(
    { _id: productId, "variants._id": variantId },
    { $inc: { "variants.$.stock": quantity } },
    options
  );
};

/**
 * Reserve pre-order capacity at the *product* level. Two-phase atomic:
 *
 *   1. Atomically `$inc` `preorder.unitsReserved` by `quantity` — but only
 *      if `preorder.enabled` is true.
 *   2. Re-read the new value. If a `maxUnits` cap is set and the increment
 *      pushed us over it, atomically `$inc` it back down and report
 *      failure (`null`).
 *
 * The increment + rollback pair is race-safe: every concurrent attempt
 * sees a real reservation count, and at most one will end up under the
 * cap. Returns the updated product on success, `null` on cap hit or
 * disabled preorder.
 */
const reservePreorderRepo = async (models, productId, quantity, session = null) => {
  const options = session ? { session, new: true } : { new: true };
  const after = await models.Product.findOneAndUpdate(
    { _id: productId, "preorder.enabled": true },
    { $inc: { "preorder.unitsReserved": quantity } },
    options
  );
  if (!after) return null;
  const max = after.preorder?.maxUnits;
  if (max != null && (after.preorder?.unitsReserved ?? 0) > max) {
    await models.Product.findOneAndUpdate(
      { _id: productId },
      { $inc: { "preorder.unitsReserved": -quantity } },
      session ? { session } : {}
    );
    return null;
  }
  return after;
};

/**
 * Roll back a product-level pre-order reservation when an order is
 * cancelled. No cap guard — releasing capacity always succeeds.
 */
const releasePreorderRepo = async (models, productId, quantity, session = null) => {
  const options = session ? { session, new: true } : { new: true };
  return await models.Product.findOneAndUpdate(
    { _id: productId },
    { $inc: { "preorder.unitsReserved": quantity * -1 } },
    options
  );
};

/**
 * Variant-scoped twin of `reservePreorderRepo`. Same two-phase pattern:
 * inc the variant's reservation counter, then roll back if it pushed
 * past the variant's `preorder.maxUnits` cap. Race-safe.
 */
const reserveVariantPreorderRepo = async (models, productId, variantId, quantity, session = null) => {
  const options = session ? { session, new: true } : { new: true };
  const after = await models.Product.findOneAndUpdate(
    {
      _id: productId,
      variants: { $elemMatch: { _id: variantId, "preorder.enabled": true } },
    },
    { $inc: { "variants.$.preorder.unitsReserved": quantity } },
    options
  );
  if (!after) return null;
  const v = (after.variants || []).find((x) => String(x._id) === String(variantId));
  const max = v?.preorder?.maxUnits;
  if (max != null && (v?.preorder?.unitsReserved ?? 0) > max) {
    await models.Product.findOneAndUpdate(
      { _id: productId, "variants._id": variantId },
      { $inc: { "variants.$.preorder.unitsReserved": -quantity } },
      session ? { session } : {}
    );
    return null;
  }
  return after;
};

const releaseVariantPreorderRepo = async (models, productId, variantId, quantity, session = null) => {
  const options = session ? { session, new: true } : { new: true };
  return await models.Product.findOneAndUpdate(
    { _id: productId, "variants._id": variantId },
    { $inc: { "variants.$.preorder.unitsReserved": -quantity } },
    options
  );
};

const deleteAProductRepo = async (models, findQuery = {}) => {
  return await models.Product.deleteOne(findQuery);
};

export {
  getProductsRepo,
  getAProductRepo,
  addAProductRepo,
  updateAProductRepo,
  decrementStockRepo,
  incrementStockRepo,
  decrementVariantStockRepo,
  incrementVariantStockRepo,
  reservePreorderRepo,
  releasePreorderRepo,
  reserveVariantPreorderRepo,
  releaseVariantPreorderRepo,
  deleteAProductRepo,
};
