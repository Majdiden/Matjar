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
