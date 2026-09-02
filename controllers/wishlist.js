/**
 * Wishlist Controller
 * Handles wishlist-related HTTP requests
 */

import {
  getWishlistService,
  addToWishlistService,
  removeFromWishlistService,
  toggleWishlistService,
  clearWishlistService,
  getTopWishlistedService,
} from "../services/wishlist.js";

/**
 * Get user's wishlist
 * GET /api/wishlist
 */
export const getWishlist = async (req, res) => {
  const userId = req.user.userId;
  const wishlist = await getWishlistService(req.models, userId);

  res.json({
    success: true,
    data: { wishlist },
  });
};

/**
 * Add product to wishlist
 * POST /api/wishlist/add
 */
export const addToWishlist = async (req, res) => {
  const userId = req.user.userId;
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Product ID is required",
    });
  }

  const wishlist = await addToWishlistService(req.models, userId, productId);

  res.json({
    success: true,
    message: "Product added to wishlist",
    data: { wishlist },
  });
};

/**
 * Remove product from wishlist
 * DELETE /api/wishlist/remove
 */
export const removeFromWishlist = async (req, res) => {
  const userId = req.user.userId;
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Product ID is required",
    });
  }

  const wishlist = await removeFromWishlistService(req.models, userId, productId);

  res.json({
    success: true,
    message: "Product removed from wishlist",
    data: { wishlist },
  });
};

/**
 * Toggle product in wishlist
 * POST /api/wishlist/toggle
 */
export const toggleWishlist = async (req, res) => {
  const userId = req.user.userId;
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Product ID is required",
    });
  }

  const result = await toggleWishlistService(req.models, userId, productId);

  res.json({
    success: true,
    message: result.isInWishlist
      ? "Product added to wishlist"
      : "Product removed from wishlist",
    data: {
      wishlist: result.wishlist,
      isInWishlist: result.isInWishlist,
    },
  });
};

/**
 * Clear wishlist
 * DELETE /api/wishlist/clear
 */
export const clearWishlist = async (req, res) => {
  const userId = req.user.userId;
  const wishlist = await clearWishlistService(req.models, userId);

  res.json({
    success: true,
    message: "Wishlist cleared",
    data: { wishlist },
  });
};

/**
 * Most-wishlisted products for the tenant (merchant analytics).
 * GET /api/wishlist/analytics/top
 */
export const getTopWishlisted = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const items = await getTopWishlistedService(req.models, req.tenantId, limit);

  res.json({
    success: true,
    data: { items },
  });
};
