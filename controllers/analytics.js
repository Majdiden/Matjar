import { asyncHandler } from "../middlewares/errorHandler.js";

// Orders we shouldn't count toward revenue. Cancelled / refunded sales would
// otherwise inflate the totals shown on the dashboard.
const REVENUE_STATUS_FILTER = { $nin: ["Cancelled", "Refunded"] };

const buildDateMatch = (startDate, endDate) => {
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);
  const match = { status: REVENUE_STATUS_FILTER };
  if (Object.keys(dateFilter).length > 0) match.createdAt = dateFilter;
  return match;
};

/**
 * @route   GET /api/analytics/stats
 * @desc    Headline KPIs for the dashboard analytics page
 * @access  Private (Admin)
 */
export const getStats = asyncHandler(async (req, res) => {
  const Order = req.models.Order;
  const Product = req.models.Product;
  const { startDate, endDate } = req.query;

  const match = buildDateMatch(startDate, endDate);

  const [salesAgg, totalProducts] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
    ]),
    Product.countDocuments({ status: "active" }),
  ]);

  const sales = salesAgg[0] || { totalRevenue: 0, totalOrders: 0 };
  const averageOrderValue =
    sales.totalOrders > 0 ? sales.totalRevenue / sales.totalOrders : 0;

  res.json({
    success: true,
    data: {
      totalRevenue: sales.totalRevenue,
      totalOrders: sales.totalOrders,
      averageOrderValue,
      totalProducts,
    },
  });
});

/**
 * @route   GET /api/analytics/sales-over-time
 * @desc    Daily revenue / order counts for the chart
 * @access  Private (Admin)
 */
export const getSalesOverTime = asyncHandler(async (req, res) => {
  const Order = req.models.Order;
  const { startDate, endDate } = req.query;

  const match = buildDateMatch(startDate, endDate);

  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id",
        revenue: 1,
        orders: 1,
      },
    },
  ]);

  res.json({ success: true, data: { salesData: rows } });
});

// Customers are store users that aren't staff (mirrors controllers/customer.js).
const CUSTOMER_ONLY_MATCH = { roles: { $nin: ["admin", "manager", "staff"] } };

/**
 * @route   GET /api/analytics/counts-over-time
 * @desc    Daily NEW customers and products in [startDate, endDate]. Powers the
 *          cumulative-growth sparklines on the dashboard's Customers/Products
 *          stat cards. Returns per-day new counts; the client turns them into a
 *          running total that ends at the current grand total.
 * @access  Private (Admin)
 */
export const getCountsOverTime = asyncHandler(async (req, res) => {
  const User = req.models.User;
  const Product = req.models.Product;
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);
  const createdMatch = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  // Shared "group by calendar day, ascending" tail.
  const perDay = [
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", count: 1 } },
  ];

  const [customers, products] = await Promise.all([
    User.aggregate([{ $match: { ...CUSTOMER_ONLY_MATCH, ...createdMatch } }, ...perDay]),
    Product.aggregate([{ $match: { ...createdMatch } }, ...perDay]),
  ]);

  res.json({ success: true, data: { customers, products } });
});

/**
 * @route   GET /api/analytics/top-products
 * @desc    Best-selling products by revenue
 * @access  Private (Admin)
 */
export const getTopProducts = asyncHandler(async (req, res) => {
  const Order = req.models.Order;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  const products = await Order.aggregate([
    { $match: { status: REVENUE_STATUS_FILTER } },
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.product",
        name: { $first: "$products.name" },
        totalSold: { $sum: "$products.quantity" },
        totalRevenue: {
          $sum: { $multiply: ["$products.price", "$products.quantity"] },
        },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: limit },
    // Scoped $lookup — the pipeline form lets us filter the joined
    // collection by tenantId so a product doc from another tenant can
    // never leak into this tenant's analytics.
    {
      $lookup: {
        from: "products",
        let: { pid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$pid"] }, tenantId: req.tenantId } },
          { $limit: 1 },
        ],
        as: "productInfo",
      },
    },
    {
      $addFields: {
        productInfo: { $arrayElemAt: ["$productInfo", 0] },
      },
    },
    {
      $project: {
        _id: 1,
        totalSold: 1,
        totalRevenue: 1,
        // Prefer the live product name, fall back to the line snapshot when
        // the product has been deleted.
        name: { $ifNull: ["$productInfo.name", "$name"] },
        image: { $arrayElemAt: ["$productInfo.images", 0] },
      },
    },
  ]);

  res.json({ success: true, data: { products } });
});
