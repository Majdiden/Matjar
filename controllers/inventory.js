import { asyncHandler } from "../middlewares/errorHandler.js";

/**
 * Inventory module — single-writer migration.
 *
 * `Product.stock` (and per-variant stock for variant products) is the only
 * source of truth for on-hand quantities. The legacy `Inventory` collection
 * has been retired: it was only ever populated when an explicit adjustment
 * happened, so most tenants saw an empty list, and dual-writing it from
 * stock mutations gave us drift between the two stores. Every read and
 * write in this controller now operates on Product directly.
 */

/**
 * Map a Product doc into the inventory-row shape the dashboard expects.
 *
 * For variant-enabled products the effective stock is the sum of every
 * variant's stock (the top-level `stock` field is unused on those). The
 * dashboard surfaces the variant count separately so a row reading "0"
 * for a variant product is unambiguous.
 */
const productToInventoryRow = (p) => {
  const isVariantProduct = !!p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0;
  const aggregatedStock = isVariantProduct
    ? (p.variants || []).reduce((sum, v) => sum + (v?.stock ?? 0), 0)
    : (p.stock ?? 0);
  return {
    _id: p._id,
    product: {
      _id: p._id,
      name: p.name,
      price: p.price,
      stock: aggregatedStock,
      hasVariants: isVariantProduct,
      variantCount: isVariantProduct ? p.variants.length : 0,
    },
    stock: aggregatedStock,
    hasVariants: isVariantProduct,
    variantCount: isVariantProduct ? p.variants.length : 0,
    lowStockThreshold: p.lowStockThreshold ?? 10,
    trackInventory: p.trackInventory ?? true,
    updatedAt: p.updatedAt,
  };
};

/**
 * @route   GET /api/inventory
 * @desc    List all inventory items with pagination
 * @access  Private (admin/manager)
 */
export const getInventoryController = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, sort = "-updatedAt", lowStock, search } = req.query;
  const filters = {};
  if (lowStock) filters.stock = { $lte: parseInt(lowStock) };
  if (search) {
    // Escape regex metacharacters so user input can't break the query.
    const escape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filters.name = { $regex: escape(search), $options: "i" };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    req.models.Product.find(filters)
      .select("name price stock lowStockThreshold trackInventory hasVariants variants updatedAt")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    req.models.Product.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: {
      inventories: products.map(productToInventoryRow),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    },
  });
});

/**
 * @route   GET /api/inventory/low-stock
 * @desc    Get items below stock threshold
 * @access  Private (admin/manager)
 */
export const getLowStockController = asyncHandler(async (req, res) => {
  const { threshold = 10 } = req.query;
  const t = parseInt(threshold);
  // Match either: a non-variant product whose top-level stock is low, OR a
  // variant-enabled product that has at least one variant under threshold.
  // The aggregated row may still report a high *total*, but seeing it in
  // the low-stock list signals a specific variant needs restocking.
  const products = await req.models.Product.find({
    $or: [
      { hasVariants: { $ne: true }, stock: { $lte: t } },
      { hasVariants: true, "variants.stock": { $lte: t } },
    ],
  })
    .select("name price stock lowStockThreshold trackInventory hasVariants variants updatedAt")
    .sort("stock");
  const items = products.map(productToInventoryRow);
  res.json({ success: true, data: { items, count: items.length } });
});

/**
 * @route   GET /api/inventory/:productId
 * @desc    Get inventory for a specific product
 * @access  Private (admin/manager)
 */
export const getProductInventoryController = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findById(req.params.productId)
    .select("name price stock lowStockThreshold trackInventory hasVariants variants updatedAt");
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }
  res.json({ success: true, data: { inventory: productToInventoryRow(product) } });
});

/**
 * @route   PUT /api/inventory/:productId
 * @desc    Update inventory settings (threshold, tracking flag) and — for
 *          non-variant products — the absolute stock value.
 * @access  Private (admin/manager)
 *
 * Note: setting an absolute stock value is intentionally not atomic against
 * concurrent order placement. Use POST /:productId/adjust for delta updates,
 * which uses an atomic guarded `$inc`.
 */
export const updateInventoryController = asyncHandler(async (req, res) => {
  const { stock, lowStockThreshold, trackInventory } = req.body;

  const existing = await req.models.Product.findById(req.params.productId)
    .select("hasVariants variants");
  if (!existing) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  const update = {};
  if (lowStockThreshold !== undefined) update.lowStockThreshold = lowStockThreshold;
  if (trackInventory !== undefined) update.trackInventory = trackInventory;

  if (stock !== undefined) {
    if (existing.hasVariants && (existing.variants || []).length > 0) {
      return res.status(400).json({
        success: false,
        message: "This product has variants — set stock per variant from the product editor.",
      });
    }
    if (typeof stock !== "number" || stock < 0) {
      return res.status(400).json({ success: false, message: "Stock must be a non-negative number" });
    }
    update.stock = stock;
  }

  const product = await req.models.Product.findByIdAndUpdate(
    req.params.productId,
    update,
    { new: true, runValidators: true }
  ).select("name price stock lowStockThreshold trackInventory hasVariants variants updatedAt");

  res.json({ success: true, data: { inventory: productToInventoryRow(product) } });
});

/**
 * @route   POST /api/inventory/:productId/adjust
 * @desc    Adjust stock (add/subtract)
 * @access  Private (admin/manager)
 */
export const adjustStockController = asyncHandler(async (req, res) => {
  const { adjustment } = req.body;

  if (typeof adjustment !== "number") {
    return res.status(400).json({ success: false, message: "Adjustment must be a number" });
  }

  // Variant-enabled products store stock per variant — adjusting the
  // top-level field would do nothing visible to the customer. Send the
  // merchant to the product editor instead so they pick which variant.
  const existing = await req.models.Product.findById(req.params.productId).select("hasVariants variants");
  if (!existing) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }
  if (existing.hasVariants && (existing.variants || []).length > 0) {
    return res.status(400).json({
      success: false,
      message: "This product has variants — adjust stock from the product editor's variant table.",
    });
  }

  // Atomic guarded update — if the adjustment is negative, the query refuses
  // to apply it unless current stock can absorb it. No floor at 0, no
  // read-modify-write.
  const query = { _id: req.params.productId };
  if (adjustment < 0) {
    query.stock = { $gte: Math.abs(adjustment) };
  }

  const product = await req.models.Product.findOneAndUpdate(
    query,
    { $inc: { stock: adjustment } },
    { new: true }
  );

  if (!product) {
    return res.status(400).json({ success: false, message: "Insufficient stock or product not found" });
  }

  res.json({
    success: true,
    message: `Stock adjusted by ${adjustment > 0 ? "+" : ""}${adjustment}`,
    data: { stock: product.stock },
  });
});
