import { asyncHandler } from "../middlewares/errorHandler.js";
import { v4 as uuidv4 } from "uuid";
import { tenantPopulate } from "../utils/scopedModel.js";

/**
 * Get or create cart for current user/session
 */
const getOrCreateCart = async (models, user, sessionId) => {
  

  let cart;
  if (user) {
    cart = await models.Cart.findOne({ user: user.userId }).populate("items.product");
  } else if (sessionId) {
    cart = await models.Cart.findOne({ sessionId }).populate("items.product");
  }

  if (!cart) {
    const cartData = {
      items: [],
      subtotal: 0,
      itemCount: 0,
    };

    if (user) {
      cartData.user = user.userId;
    } else {
      cartData.sessionId = sessionId || uuidv4();
    }

    cart = await models.Cart.create(cartData);
  }

  return cart;
};

/**
 * Calculate cart totals
 */
const calculateCartTotals = (items) => {
  let subtotal = 0;
  let itemCount = 0;

  items.forEach((item) => {
    const price = item.unitPrice || (item.product?.price || 0);
    subtotal += price * item.quantity;
    itemCount += item.quantity;
  });

  return { subtotal, itemCount };
};

/**
 * @route   POST /api/cart/add
 * @desc    Add item to cart
 * @access  Public (supports both authenticated and guest users)
 */
export const addToCartStorefront = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, variantId } = req.body;

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Product ID is required",
    });
  }

  const Product = req.models.Product;
  const Cart = req.models.Cart;

  // Verify product exists and is active
  const product = await Product.findById(productId);
  if (!product || product.status !== "active") {
    return res.status(404).json({
      success: false,
      message: "Product not found or not available",
    });
  }

  // Resolve variant if provided. Variant identifiers are the Mongoose
  // subdocument _id from product.variants[].
  let variant = null;
  if (variantId) {
    variant = product.variants?.find(
      (v) => v && v._id && v._id.toString() === String(variantId)
    );
    if (!variant) {
      return res.status(400).json({
        success: false,
        message: "Variant not found on this product",
      });
    }
  } else if (product.hasVariants) {
    // Variant-enabled products require an explicit selection — silently
    // adding the parent product would let the customer end up with an
    // ambiguous order line.
    return res.status(400).json({
      success: false,
      message: "Please select an option before adding to cart",
    });
  }

  // Check stock — variant stock takes precedence when a variant is set.
  // If on-hand stock can't cover the quantity, fall through to pre-order
  // when the (variant or product) preorder block is enabled and the
  // remaining capacity (after currently-reserved units) is sufficient.
  const availableStock = variant ? variant.stock : product.stock;
  // Resolve the active preorder config: variant overrides product when set.
  const preorderCfg =
    (variant && variant.preorder?.enabled && variant.preorder) ||
    (product.preorder?.enabled && product.preorder) ||
    null;
  let isPreorder = false;
  let preorderShipDate = null;
  if (availableStock < quantity) {
    if (!preorderCfg) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock available",
      });
    }
    // Pre-order capacity check (advisory at add time — the authoritative
    // atomic check happens at order placement via reservePreorderRepo).
    const reserved = preorderCfg.unitsReserved || 0;
    const cap = preorderCfg.maxUnits;
    if (cap != null && reserved + quantity > cap) {
      return res.status(400).json({
        success: false,
        message: "Pre-order capacity is full",
      });
    }
    isPreorder = true;
    preorderShipDate = preorderCfg.expectedShipDate || null;
  }

  // Snapshot unit price. A variant `price` (when set) is an override, not
  // an additive — see services/checkout.js for the full pricing rules.
  const unitPrice =
    variant && typeof variant.price === "number" && variant.price >= 0
      ? variant.price
      : product.price;
  const variantOptions = variant?.optionValues || [];
  const variantLabel = variantOptions.length
    ? variantOptions.map((o) => `${o.name}: ${o.value}`).join(" / ")
    : variant?.sku || null;

  // Get or create cart
  let sessionId = req.session.cartSessionId;
  if (!sessionId && !req.user) {
    sessionId = uuidv4();
    req.session.cartSessionId = sessionId;
  }

  const cart = await getOrCreateCart(req.models, req.user, sessionId);

  // Check if item already exists in cart. `cart.items` may have been
  // populated by getOrCreateCart, so `item.product` can be either a raw
  // ObjectId or a populated document — read `_id` defensively.
  const existingItemIndex = cart.items.findIndex(
    (item) =>
      (item.product?._id || item.product).toString() === productId &&
      // Two cart entries are "the same line" only when both their
      // product and variant identifiers match. A null/undefined variant
      // on one side and a value on the other means a different line.
      (item.variantId || null) === (variantId || null)
  );

  if (existingItemIndex > -1) {
    // Update quantity
    cart.items[existingItemIndex].quantity += quantity;
    cart.items[existingItemIndex].unitPrice = unitPrice;
    cart.items[existingItemIndex].lineTotal = unitPrice * cart.items[existingItemIndex].quantity;

    // Re-check capacity for the merged total. If the merged quantity
    // outgrows on-hand stock and the line wasn't already a preorder,
    // promote it to a preorder line if capacity allows.
    const merged = cart.items[existingItemIndex].quantity;
    if (availableStock < merged) {
      if (!preorderCfg) {
        return res.status(400).json({
          success: false,
          message: `Only ${availableStock} items available in stock`,
        });
      }
      const reserved = preorderCfg.unitsReserved || 0;
      const cap = preorderCfg.maxUnits;
      if (cap != null && reserved + merged > cap) {
        return res.status(400).json({
          success: false,
          message: "Pre-order capacity is full",
        });
      }
      cart.items[existingItemIndex].isPreorder = true;
      cart.items[existingItemIndex].preorderExpectedShipDate =
        preorderCfg.expectedShipDate || null;
    }
  } else {
    // Add new item
    cart.items.push({
      product: productId,
      quantity,
      variantId: variant ? variant._id.toString() : undefined,
      variantName: variantLabel,
      variantOptions,
      variantSku: variant?.sku,
      unitPrice,
      lineTotal: unitPrice * quantity,
      isPreorder,
      preorderExpectedShipDate: preorderShipDate,
    });
  }

  // Recalculate totals
  await cart.populate(tenantPopulate("items.product", cart.tenantId));
  const totals = calculateCartTotals(cart.items);
  cart.subtotal = totals.subtotal;
  cart.itemCount = totals.itemCount;
  cart.updatedAt = new Date();

  await cart.save();

  // Save cart session ID
  if (!req.user) {
    req.session.cartId = cart._id.toString();
  }

  res.json({
    success: true,
    message: "Item added to cart successfully",
    data: {
      cart: {
        id: cart._id,
        items: cart.items,
        subtotal: cart.subtotal,
        itemCount: cart.itemCount,
      },
    },
  });
});

/**
 * @route   PUT /api/cart/update
 * @desc    Update cart item quantity
 * @access  Public
 */
export const updateCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity, variantId } = req.body;

  if (!productId || quantity === undefined) {
    return res.status(400).json({
      success: false,
      message: "Product ID and quantity are required",
    });
  }

  if (quantity < 0) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be a positive number",
    });
  }

  const Cart = req.models.Cart;
  const Product = req.models.Product;

  // Get cart
  const sessionId = req.session.cartSessionId;
  const cart = await getOrCreateCart(req.models, req.user, sessionId);

  if (!cart) {
    return res.status(404).json({
      success: false,
      message: "Cart not found",
    });
  }

  // Find item in cart — match both product and (optional) variant.
  // `item.product` may be a populated doc (getOrCreateCart populates
  // items.product) or a raw ObjectId, so pull `_id` defensively.
  const itemIndex = cart.items.findIndex(
    (item) =>
      (item.product?._id || item.product).toString() === productId &&
      (item.variantId || null) === (variantId || null)
  );

  if (itemIndex === -1) {
    return res.status(404).json({
      success: false,
      message: "Item not found in cart",
    });
  }

  // If quantity is 0, remove item
  if (quantity === 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    const product = await Product.findById(productId);
    const cartItem = cart.items[itemIndex];
    let variant = null;
    if (cartItem.variantId) {
      variant = product.variants?.find(
        (v) => v && v._id && v._id.toString() === String(cartItem.variantId)
      );
    }
    const availableStock = variant ? variant.stock : product.stock;
    const preorderCfg =
      (variant && variant.preorder?.enabled && variant.preorder) ||
      (product.preorder?.enabled && product.preorder) ||
      null;
    let willBePreorder = false;
    let preorderShipDate = null;
    if (availableStock < quantity) {
      if (!preorderCfg) {
        return res.status(400).json({
          success: false,
          message: `Only ${availableStock} items available in stock`,
        });
      }
      const reserved = preorderCfg.unitsReserved || 0;
      const cap = preorderCfg.maxUnits;
      if (cap != null && reserved + quantity > cap) {
        return res.status(400).json({
          success: false,
          message: "Pre-order capacity is full",
        });
      }
      willBePreorder = true;
      preorderShipDate = preorderCfg.expectedShipDate || null;
    }

    // Refresh price snapshot — variant.price is an override, not additive
    const unitPrice =
      variant && typeof variant.price === "number" && variant.price >= 0
        ? variant.price
        : product.price;
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].unitPrice = unitPrice;
    cart.items[itemIndex].lineTotal = unitPrice * quantity;
    cart.items[itemIndex].isPreorder = willBePreorder;
    cart.items[itemIndex].preorderExpectedShipDate = preorderShipDate;
  }

  // Recalculate totals
  await cart.populate(tenantPopulate("items.product", cart.tenantId));
  const totals = calculateCartTotals(cart.items);
  cart.subtotal = totals.subtotal;
  cart.itemCount = totals.itemCount;
  cart.updatedAt = new Date();

  await cart.save();

  res.json({
    success: true,
    message: "Cart updated successfully",
    data: {
      cart: {
        id: cart._id,
        items: cart.items,
        subtotal: cart.subtotal,
        itemCount: cart.itemCount,
      },
    },
  });
});

/**
 * @route   DELETE /api/cart/remove
 * @desc    Remove item from cart
 * @access  Public
 */
export const removeFromCart = asyncHandler(async (req, res) => {
  const { productId, variantId } = req.body;

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Product ID is required",
    });
  }

  const Cart = req.models.Cart;

  // Get cart
  const sessionId = req.session.cartSessionId;
  const cart = await getOrCreateCart(req.models, req.user, sessionId);

  if (!cart) {
    return res.status(404).json({
      success: false,
      message: "Cart not found",
    });
  }

  // Find and remove item — match both product and (optional) variant.
  // `item.product` may already be populated to a full doc, so resolve
  // `_id` defensively before stringifying.
  const itemIndex = cart.items.findIndex(
    (item) =>
      (item.product?._id || item.product).toString() === productId &&
      (item.variantId || null) === (variantId || null)
  );

  if (itemIndex === -1) {
    return res.status(404).json({
      success: false,
      message: "Item not found in cart",
    });
  }

  cart.items.splice(itemIndex, 1);

  // Recalculate totals
  await cart.populate(tenantPopulate("items.product", cart.tenantId));
  const totals = calculateCartTotals(cart.items);
  cart.subtotal = totals.subtotal;
  cart.itemCount = totals.itemCount;
  cart.updatedAt = new Date();

  await cart.save();

  res.json({
    success: true,
    message: "Item removed from cart successfully",
    data: {
      cart: {
        id: cart._id,
        items: cart.items,
        subtotal: cart.subtotal,
        itemCount: cart.itemCount,
      },
    },
  });
});

/**
 * @route   GET /api/cart
 * @desc    Get current cart
 * @access  Public
 */
export const getCartStorefront = asyncHandler(async (req, res) => {
  if (!req.models) {
    return res.json({ success: true, data: { items: [], subtotal: 0, itemCount: 0 } });
  }
  const sessionId = req.session?.cartSessionId;
  const cart = await getOrCreateCart(req.models, req.user, sessionId);

  // Format cart items for frontend
  const formattedItems = cart.items.map((item) => {
    const product = item.product;
    return {
      id: item._id.toString(),
      productId: product?._id?.toString() || product?.id,
      quantity: item.quantity,
      price: item.unitPrice || item.price || product?.price || 0,
      lineTotal: item.lineTotal || (item.unitPrice || item.price || product?.price || 0) * item.quantity,
      product: product ? {
        id: product._id?.toString() || product.id,
        name: product.name,
        slug: product.slug,
        images: Array.isArray(product.images) 
          ? product.images 
          : product.images 
            ? [product.images] 
            : [],
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        sku: product.sku,
        stock: product.stock,
      } : null,
      variant: item.variantId
        ? {
            id: item.variantId,
            name: item.variantName,
            sku: item.variantSku,
            options: item.variantOptions || [],
          }
        : null,
      isPreorder: !!item.isPreorder,
      preorderExpectedShipDate: item.preorderExpectedShipDate || null,
    };
  });

  res.json({
    success: true,
    data: {
      cart: {
        id: cart._id.toString(),
        items: formattedItems,
        itemCount: cart.itemCount || formattedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: cart.subtotal || formattedItems.reduce((sum, item) => sum + item.lineTotal, 0),
        total: cart.total || cart.subtotal || formattedItems.reduce((sum, item) => sum + item.lineTotal, 0),
        discount: cart.discount || null,
        savings: cart.savings || 0,
      },
    },
  });
});

/**
 * @route   DELETE /api/cart/clear
 * @desc    Clear all items from cart
 * @access  Public
 */
export const clearCart = asyncHandler(async (req, res) => {
  const Cart = req.models.Cart;

  // Get cart
  const sessionId = req.session.cartSessionId;
  const cart = await getOrCreateCart(req.models, req.user, sessionId);

  if (!cart) {
    return res.status(404).json({
      success: false,
      message: "Cart not found",
    });
  }

  cart.items = [];
  cart.subtotal = 0;
  cart.itemCount = 0;
  cart.updatedAt = new Date();

  await cart.save();

  res.json({
    success: true,
    message: "Cart cleared successfully",
    data: {
      cart: {
        id: cart._id,
        items: [],
        subtotal: 0,
        itemCount: 0,
      },
    },
  });
});
