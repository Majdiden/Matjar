/**
 * Get basic sales statistics
 */
export const getSalesStats = async (models, startDate, endDate) => {
  const stats = await models.Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
        paymentStatus: "Paid",
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$totalAmount" },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: "$totalAmount" },
      },
    },
  ]);

  return stats[0] || { totalSales: 0, totalOrders: 0, avgOrderValue: 0 };
};

/**
 * Get sales over time (for chart)
 */
export const getSalesOverTime = async (models, startDate, endDate) => {
  const sales = await models.Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
        paymentStatus: "Paid",
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        sales: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return sales;
};

/**
 * Get top selling products
 */
export const getTopProducts = async (models, limit = 5) => {
  const products = await models.Order.aggregate([
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.product",
        name: { $first: "$products.name" },
        totalSold: { $sum: "$products.quantity" },
        revenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit },
  ]);

  return products;
};
