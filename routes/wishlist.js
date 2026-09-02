/**
 * Wishlist Routes
 */

import express from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  clearWishlist,
  getTopWishlisted,
} from "../controllers/wishlist.js";

const router = express.Router();

/**
 * @route   GET /api/wishlist/analytics/top
 * @desc    Most-wishlisted products for the tenant (merchant analytics)
 * @access  Private (Admin — analytics.read)
 *
 * Declared before the customer "/" route; the paths don't collide but this
 * keeps the admin surface grouped and unambiguous.
 */
router.get(
  "/analytics/top",
  authenticate,
  requirePermission("analytics.read"),
  asyncHandler(getTopWishlisted)
);

/**
 * @route   GET /api/wishlist
 * @desc    Get user's wishlist
 * @access  Private
 */
router.get("/", authenticate, asyncHandler(getWishlist));

/**
 * @route   POST /api/wishlist/add
 * @desc    Add product to wishlist
 * @access  Private
 */
router.post("/add", authenticate, asyncHandler(addToWishlist));

/**
 * @route   DELETE /api/wishlist/remove
 * @desc    Remove product from wishlist
 * @access  Private
 */
router.delete("/remove", authenticate, asyncHandler(removeFromWishlist));

/**
 * @route   POST /api/wishlist/toggle
 * @desc    Toggle product in wishlist
 * @access  Private
 */
router.post("/toggle", authenticate, asyncHandler(toggleWishlist));

/**
 * @route   DELETE /api/wishlist/clear
 * @desc    Clear wishlist
 * @access  Private
 */
router.delete("/clear", authenticate, asyncHandler(clearWishlist));

export default router;
