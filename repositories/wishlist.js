export const getWishlistRepo = async (models, userId) => {
  return await models.Wishlist.findOne({ user: userId })
    .populate("products")
    .lean();
};

export const addToWishlistRepo = async (models, userId, productId) => {
  return await models.Wishlist.findOneAndUpdate(
    { user: userId },
    { $addToSet: { products: productId } },
    { new: true, upsert: true }
  ).populate("products");
};

export const removeFromWishlistRepo = async (models, userId, productId) => {
  return await models.Wishlist.findOneAndUpdate(
    { user: userId },
    { $pull: { products: productId } },
    { new: true }
  ).populate("products");
};

export const clearWishlistRepo = async (models, userId) => {
  return await models.Wishlist.findOneAndUpdate(
    { user: userId },
    { $set: { products: [] } },
    { new: true }
  );
};

/**
 * Aggregate the most-wishlisted products for a tenant.
 *
 * Runs over the raw Wishlist collection (aggregate() bypasses the tenant
 * scope Mongoose applies to find/save), so we $match `tenantId` explicitly
 * and again inside the product $lookup pipeline — a product doc from another
 * tenant can never leak into this tenant's analytics.
 */
export const getTopWishlistedRepo = async (models, tenantId, limit = 10) => {
  return await models.Wishlist.aggregate([
    { $match: { tenantId } },
    { $unwind: "$products" },
    { $group: { _id: "$products", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "products",
        let: { pid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$pid"] }, tenantId } },
          { $limit: 1 },
        ],
        as: "product",
      },
    },
    { $addFields: { product: { $arrayElemAt: ["$product", 0] } } },
    // Drop wishlisted ids whose product was deleted.
    { $match: { product: { $ne: null } } },
    {
      $project: {
        _id: 0,
        count: 1,
        product: {
          _id: "$product._id",
          name: "$product.name",
          slug: "$product.slug",
          price: "$product.price",
          image: { $arrayElemAt: ["$product.images", 0] },
        },
      },
    },
  ]);
};
