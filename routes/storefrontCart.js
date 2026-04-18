import express from "express";
import { optionalAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { addToCartSchema, updateCartItemSchema } from "../validations/index.js";
import { cartLimiter } from "../middlewares/rateLimiters.js";
import {
  addToCartStorefront,
  updateCartItem,
  removeFromCart,
  getCartStorefront,
  clearCart,
} from "../controllers/storefrontCart.js";

const router = express.Router();

// Tenant resolved at route.config.js level via storefrontTenantResolver
// All cart routes use optional auth (supports both authenticated and guest users)
router.use(optionalAuth);

/**
 * @route   GET /api/cart
 * @desc    Get current cart
 * @access  Public
 */
router.get("/", getCartStorefront);

/**
 * Mutating cart operations — `cartLimiter` keys on userId/sessionId so a
 * scripted abuser can't flood inventory holds / price scraping, but a
 * logged-in shopper has plenty of headroom for a normal "add → tweak
 * quantity → remove → re-add" flow.
 */

/**
 * @route   POST /api/cart/add
 * @desc    Add item to cart
 * @access  Public
 */
router.post("/add", cartLimiter, validate(addToCartSchema), addToCartStorefront);

/**
 * @route   PUT /api/cart/update
 * @desc    Update cart item quantity
 * @access  Public
 */
router.put("/update", cartLimiter, validate(updateCartItemSchema), updateCartItem);

/**
 * @route   DELETE /api/cart/remove
 * @desc    Remove item from cart
 * @access  Public
 */
router.delete("/remove", cartLimiter, removeFromCart);

/**
 * @route   DELETE /api/cart/clear
 * @desc    Clear all items from cart
 * @access  Public
 */
router.delete("/clear", cartLimiter, clearCart);

export default router;
