import {
  getWishlistRepo,
  addToWishlistRepo,
  removeFromWishlistRepo,
  clearWishlistRepo,
  getTopWishlistedRepo,
} from "../repositories/wishlist.js";
import { APIError } from "../middlewares/errorHandler.js";

export const getWishlistService = async (models, userId) => {
  const wishlist = await getWishlistRepo(models, userId);
  return wishlist || { user: userId, products: [] };
};

export const addToWishlistService = async (models, userId, productId) => {
  const product = await models.Product.findById(productId);
  if (!product) throw new APIError("Product not found", 404);
  return await addToWishlistRepo(models, userId, productId);
};

export const removeFromWishlistService = async (models, userId, productId) => {
  const wishlist = await removeFromWishlistRepo(models, userId, productId);
  return wishlist || { user: userId, products: [] };
};

export const toggleWishlistService = async (models, userId, productId) => {
  const product = await models.Product.findById(productId);
  if (!product) throw new APIError("Product not found", 404);

  const existing = await getWishlistRepo(models, userId);
  const isInWishlist = existing?.products?.some(
    (p) => p._id.toString() === productId.toString()
  );

  let wishlist;
  if (isInWishlist) {
    wishlist = await removeFromWishlistRepo(models, userId, productId);
  } else {
    wishlist = await addToWishlistRepo(models, userId, productId);
  }

  return { wishlist, isInWishlist: !isInWishlist };
};

export const clearWishlistService = async (models, userId) => {
  const wishlist = await clearWishlistRepo(models, userId);
  return wishlist || { user: userId, products: [] };
};

/**
 * Most-wishlisted products for the tenant (merchant analytics).
 */
export const getTopWishlistedService = async (models, tenantId, limit = 10) => {
  return await getTopWishlistedRepo(models, tenantId, limit);
};
