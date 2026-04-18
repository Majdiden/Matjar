const getCartRepo = async (models, selectQuery = {}, findQuery = {}, session = null) => {
  // Allow callers in a transaction to bind the read so the cart snapshot
  // is consistent with the rest of the txn (e.g. order placement).
  const query = models.Cart.findOne(findQuery)
    .select(selectQuery)
    .lean()
    .populate("items.product");
  if (session) query.session(session);
  return await query;
};

const addCartRepo = async (models, cartData, session = null) => {
  const options = session ? { session } : {};
  const data = await models.Cart.create(cartData, options);
  return Array.isArray(data) ? data[0] : data;
};

const updateCartRepo = async (models, findQuery = {}, updateQuery = {}) => {
  return await models.Cart.updateOne(findQuery, updateQuery);
};

const deleteCartRepo = async (models, findQuery = {}, session = null) => {
  const options = session ? { session } : {};
  return await models.Cart.deleteOne(findQuery, options);
};

export { getCartRepo, addCartRepo, updateCartRepo, deleteCartRepo };
