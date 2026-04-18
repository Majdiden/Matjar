/**
 * Wishlist Routes
 */

import express from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  clearWishlist,
} from "../controllers/wishlist.js";

const router = express.Router();

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
