export const createOrderRepo = async (models, orderData, session = null) => {
  const options = session ? { session } : {};
  const data = await models.Order.create(orderData, options);
  return Array.isArray(data) ? data[0] : data;
};

export const getOrderRepo = async (models, filters, projection = {}, session = null) => {
  // Bind the read to the active session when called inside a transaction
  // (e.g. cancelOrderService) so the order snapshot is consistent with the
  // stock-rollback writes that follow.
  const query = models.Order.findOne(filters, projection)
    .populate("user", "name email")
    .populate("products.product", "name price images");
  if (session) query.session(session);
  return await query;
};

export const getOrdersRepo = async (models, filters = {}, options = {}) => {
  const { page = 1, limit = 10, sort = "-createdAt" } = options;
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    models.Order.find(filters)
      .populate("user", "name email")
      .populate("products.product", "name price images")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    models.Order.countDocuments(filters),
  ]);

  return {
    orders,
    pagination: { total, page, pages: Math.ceil(total / limit), limit },
  };
};

export const updateOrderRepo = async (models, orderId, updateData) => {
  return await models.Order.findByIdAndUpdate(orderId, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("user", "name email")
    .populate("products.product", "name price images");
};

export const deleteOrderRepo = async (models, orderId) => {
  return await models.Order.findByIdAndDelete(orderId);
};

export const getOrdersByUserRepo = async (models, userId, options = {}) => {
  return await getOrdersRepo(models, { user: userId }, options);
};

export const getOrdersByStatusRepo = async (models, status, options = {}) => {
  return await getOrdersRepo(models, { status }, options);
};

export const updateOrderStatusRepo = async (models, orderId, status, session = null) => {
  const updateData = { status, updatedAt: new Date() };
  if (session) {
    return await models.Order.findOneAndUpdate({ _id: orderId }, updateData, {
      new: true,
      runValidators: true,
      session,
    })
      .populate("user", "name email")
      .populate("products.product", "name price images");
  }
  return await updateOrderRepo(models, orderId, updateData);
};
