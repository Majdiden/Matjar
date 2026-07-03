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

// Milliseconds in the 30-day comparison window used by the stats endpoint.
const STATS_COMPARISON_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Order-list stats in a single aggregation (audit 5.4.3).
 *
 * - `summary` respects the caller's list filters (date window, payment /
 *   fulfillment status, tag, search) so the stat cards can mirror the
 *   filtered list.
 * - `current30` / `previous30` are FIXED rolling windows relative to `now`
 *   and deliberately ignore the list filters — they feed the
 *   "+12% vs previous 30 days" deltas (audit 3.7) which must stay
 *   comparable regardless of what the list is filtered to.
 * - "Draft" is excluded from every figure defensively: the order status
 *   enum is about to gain a Draft state (concurrent work item) and drafts
 *   must never count as orders or revenue.
 */
export const getOrderStatsRepo = async (models, { filters = {}, now = new Date() } = {}) => {
  const current30Start = new Date(now.getTime() - STATS_COMPARISON_WINDOW_MS);
  const previous30Start = new Date(now.getTime() - 2 * STATS_COMPARISON_WINDOW_MS);

  const revenueExpr = { $sum: { $ifNull: ["$totalAmount", 0] } };
  const windowGroup = { $group: { _id: null, orders: { $sum: 1 }, revenue: revenueExpr } };

  const [result] = await models.Order.aggregate([
    { $match: { status: { $ne: "Draft" } } },
    {
      $facet: {
        summary: [
          ...(Object.keys(filters).length > 0 ? [{ $match: filters }] : []),
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              pending: {
                $sum: { $cond: [{ $in: ["$status", ["Pending", "Processing"]] }, 1, 0] },
              },
              delivered: { $sum: { $cond: [{ $eq: ["$status", "Delivered"] }, 1, 0] } },
              totalRevenue: revenueExpr,
            },
          },
        ],
        current30: [{ $match: { createdAt: { $gte: current30Start } } }, windowGroup],
        previous30: [
          { $match: { createdAt: { $gte: previous30Start, $lt: current30Start } } },
          windowGroup,
        ],
      },
    },
  ]);

  const summary = result?.summary?.[0] || {};
  const current30 = result?.current30?.[0] || {};
  const previous30 = result?.previous30?.[0] || {};

  return {
    totalOrders: summary.totalOrders || 0,
    pending: summary.pending || 0,
    delivered: summary.delivered || 0,
    totalRevenue: summary.totalRevenue || 0,
    orders30d: current30.orders || 0,
    ordersPrev30d: previous30.orders || 0,
    revenue30d: current30.revenue || 0,
    revenuePrev30d: previous30.revenue || 0,
    windowDays: 30,
    generatedAt: now,
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

/**
 * Guarded hard delete — removes the order only when it still matches
 * `filters` (e.g. { _id, status: "Draft" }). Returns the deleted doc or
 * null when the guard lost a race (order transitioned in the meantime).
 * Used by the draft-order service: hard delete is allowed ONLY while the
 * order is still a Draft (audit 5.2.6).
 */
export const deleteOrderWhereRepo = async (models, filters) => {
  return await models.Order.findOneAndDelete(filters);
};

export const getOrdersByUserRepo = async (models, userId, options = {}) => {
  // Customer-facing order history (GET /orders/my-orders). Draft orders
  // are dashboard-only until completed (audit 5.2.4) — exclude them here
  // so a merchant-composed draft never leaks into the account order list.
  return await getOrdersRepo(
    models,
    { user: userId, status: { $ne: "Draft" } },
    options
  );
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
