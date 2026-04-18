import { APIError } from "../middlewares/errorHandler.js";

/**
 * Create a new discount
 */
export const createDiscount = async (models, discountData) => {
  // Normalize the code to match how it's stored (schema setters only run on save)
  const normalizedCode = String(discountData.code || "").trim().toUpperCase();
  if (!normalizedCode) throw new APIError("Discount code is required", 400);

  const existing = await models.Discount.findOne({ code: normalizedCode });
  if (existing) throw new APIError("Discount code already exists", 400);

  // Drop empty-string fields so Mongoose applies defaults / leaves them null
  const clean = { ...discountData, code: normalizedCode };
  if (clean.expiresAt === "" || clean.expiresAt == null) delete clean.expiresAt;
  if (clean.minOrderAmount === "" || clean.minOrderAmount == null) delete clean.minOrderAmount;
  if (clean.usageLimit === "" || clean.usageLimit == null) delete clean.usageLimit;

  // BXGY is only meaningful when method === "buy_x_get_y". Strip it
  // otherwise so we don't persist stale sub-docs from a form that was
  // filled out as BXGY and then switched.
  if (clean.method && clean.method !== "buy_x_get_y") {
    delete clean.bxgy;
  }

  // If the caller supplied `kind` without a matching `method`, we must
  // preserve it — the pre-save hook would otherwise override it from the
  // default `method`. We flag this via $locals so the hook knows.
  const kindExplicit = clean.kind != null && clean.method == null;

  if (kindExplicit && typeof models.Discount.new === "function") {
    // Instantiate + save manually so we can set $locals before save.
    const doc = models.Discount.new(clean);
    doc.$locals.kindExplicit = true;
    await doc.save();
    return doc;
  }

  // scoped Model.create with a single doc still returns an array — unwrap.
  const created = await models.Discount.create(clean);
  return Array.isArray(created) ? created[0] : created;
};

/**
 * Update an existing discount. Code uniqueness still applies — if the
 * caller renames the code we re-check, but only when the new code differs
 * from the current one.
 */
export const updateDiscount = async (models, id, patch) => {
  const existing = await models.Discount.findById(id);
  if (!existing) throw new APIError("Discount not found", 404);

  const clean = { ...patch };
  if (clean.code !== undefined) {
    const normalizedCode = String(clean.code || "").trim().toUpperCase();
    if (!normalizedCode) throw new APIError("Discount code is required", 400);
    if (normalizedCode !== existing.code) {
      const collision = await models.Discount.findOne({ code: normalizedCode });
      if (collision) throw new APIError("Discount code already exists", 400);
    }
    clean.code = normalizedCode;
  }
  if (clean.expiresAt === "" || clean.expiresAt === null) clean.expiresAt = null;

  // Same rule as create: if caller sets `kind` without a matching
  // `method`, keep the explicit kind and mark it so the pre-save hook
  // doesn't clobber it from the default method mapping.
  const kindExplicit = clean.kind != null && clean.method == null;

  Object.assign(existing, clean);
  if (kindExplicit) existing.$locals.kindExplicit = true;
  await existing.save();
  return existing;
};

/**
 * Validate discount code against server-side cart data.
 *
 * @param {Object} models - Mongoose models for the tenant
 * @param {string} code - Discount code
 * @param {Array} cartLines - Server-computed cart lines:
 *   [{ product: ObjectId, category: ObjectId, quantity: Number, unitPrice: Number, lineTotal: Number }]
 * @param {string|null} userId - Authenticated user ID (null for guests)
 * @returns {{ code, type, value, amount, eligibleLineIds }}
 */
/**
 * Compute BXGY discount amount for a cart.
 *
 * Matches against the two scopes (buy and get) from `discount.bxgy`, counts
 * how many times the rule triggers, and applies the getDiscount to the
 * cheapest getQuantity units of eligible "get" lines per application. The
 * returned shape mirrors validateDiscount so the two branches can share
 * the same caller.
 */
const computeBxgyDiscount = (discount, cartLines) => {
  const bxgy = discount.bxgy || {};
  const buyQty = Math.max(1, bxgy.buyQuantity || 1);
  const getQty = Math.max(1, bxgy.getQuantity || 1);
  const buyProducts = new Set((bxgy.buyProducts || []).map((id) => id.toString()));
  const buyCategories = new Set((bxgy.buyCategories || []).map((id) => id.toString()));
  const getProducts = new Set((bxgy.getProducts || []).map((id) => id.toString()));
  const getCategories = new Set((bxgy.getCategories || []).map((id) => id.toString()));

  const matchesBuy = (line) => {
    if (buyProducts.size === 0 && buyCategories.size === 0) return true;
    if (buyProducts.has(line.product.toString())) return true;
    if (line.category && buyCategories.has(line.category.toString())) return true;
    return false;
  };
  const matchesGet = (line) => {
    if (getProducts.size === 0 && getCategories.size === 0) return true;
    if (getProducts.has(line.product.toString())) return true;
    if (line.category && getCategories.has(line.category.toString())) return true;
    return false;
  };

  const buyLines = cartLines.filter(matchesBuy);
  const getLines = cartLines.filter(matchesGet);
  const buyCartQty = buyLines.reduce((s, l) => s + l.quantity, 0);

  if (buyCartQty < buyQty) {
    throw new APIError(
      `Add ${buyQty - buyCartQty} more qualifying item(s) to unlock this discount`,
      400,
    );
  }

  let applications = Math.floor(buyCartQty / buyQty);
  if (bxgy.maxUsesPerOrder != null) {
    applications = Math.min(applications, bxgy.maxUsesPerOrder);
  }
  if (applications === 0) {
    return {
      code: discount.code,
      type: discount.type,
      value: discount.value,
      amount: 0,
      eligibleLineIds: [],
    };
  }

  // Expand get-lines into an array of per-unit prices so we can discount
  // the cheapest `getQty * applications` units — Shopify applies BXGY to
  // the lowest-priced eligible units in the cart.
  const getUnits = [];
  for (const line of getLines) {
    for (let i = 0; i < line.quantity; i++) {
      getUnits.push({ productId: line.product.toString(), unitPrice: line.unitPrice });
    }
  }
  getUnits.sort((a, b) => a.unitPrice - b.unitPrice);

  const unitsToDiscount = Math.min(getUnits.length, getQty * applications);
  const getType = discount.bxgy?.getDiscountType || "percentage";
  const getVal = discount.bxgy?.getDiscountValue ?? 100;

  let amount = 0;
  const eligibleLineIds = new Set();
  for (let i = 0; i < unitsToDiscount; i++) {
    const unit = getUnits[i];
    let perUnit = 0;
    if (getType === "percentage") {
      perUnit = (unit.unitPrice * getVal) / 100;
    } else {
      perUnit = getVal;
    }
    perUnit = Math.min(perUnit, unit.unitPrice);
    amount += perUnit;
    eligibleLineIds.add(unit.productId);
  }

  return {
    code: discount.code,
    type: discount.type,
    value: discount.value,
    amount: Math.round(amount * 100) / 100,
    eligibleLineIds: Array.from(eligibleLineIds),
  };
};

export const validateDiscount = async (models, code, cartLines, userId) => {
  // Normalize: discounts are stored uppercased + trimmed (schema setters)
  // but Mongoose only applies setters on save, NOT on queries — so we must
  // normalize the lookup key here to match what's in the DB.
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) throw new APIError("Discount code is required", 400);

  const discount = await models.Discount.findOne({ code: normalizedCode, isActive: true });
  if (!discount) throw new APIError("Invalid discount code", 400);

  // Expiry check
  if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
    throw new APIError("Discount code has expired", 400);
  }

  // Global usage limit
  if (discount.usageLimit != null && discount.usedCount >= discount.usageLimit) {
    throw new APIError("Discount usage limit reached", 400);
  }

  // Per-user limit — count past orders by this user that used this code
  if (discount.perUserLimit != null && userId) {
    const userRedemptions = await models.Order.countDocuments({
      user: userId,
      discountCode: normalizedCode,
    });
    if (userRedemptions >= discount.perUserLimit) {
      throw new APIError("You have already used this discount code the maximum number of times", 400);
    }
  }

  // BXGY has its own applicability and amount calculation — the rest of
  // this function is the "amount off products/order" branch and assumes a
  // single percentage/fixed reduction against eligible line totals.
  if (discount.method === "buy_x_get_y") {
    // Min order amount still applies (checked against the full cart).
    const cartTotalForBxgy = cartLines.reduce((s, l) => s + l.lineTotal, 0);
    if (discount.minOrderAmount && cartTotalForBxgy < discount.minOrderAmount) {
      throw new APIError(`Minimum order amount of ${discount.minOrderAmount} required`, 400);
    }
    return computeBxgyDiscount(discount, cartLines);
  }

  // Determine eligible cart lines based on applicableProducts / applicableCategories
  let eligibleLines = cartLines;

  const hasProductScope =
    Array.isArray(discount.applicableProducts) && discount.applicableProducts.length > 0;
  const hasCategoryScope =
    Array.isArray(discount.applicableCategories) && discount.applicableCategories.length > 0;

  if (hasProductScope || hasCategoryScope) {
    const productIds = new Set(discount.applicableProducts.map((id) => id.toString()));
    const categoryIds = new Set(discount.applicableCategories.map((id) => id.toString()));

    eligibleLines = cartLines.filter((line) => {
      if (hasProductScope && productIds.has(line.product.toString())) return true;
      if (hasCategoryScope && line.category && categoryIds.has(line.category.toString())) return true;
      return false;
    });

    if (eligibleLines.length === 0) {
      throw new APIError("Discount not applicable to items in cart", 400);
    }
  }

  // Compute totals from eligible lines only
  const eligibleTotal = eligibleLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const cartTotal = cartLines.reduce((sum, l) => sum + l.lineTotal, 0);

  // Min order amount is checked against full cart
  if (discount.minOrderAmount && cartTotal < discount.minOrderAmount) {
    throw new APIError(`Minimum order amount of ${discount.minOrderAmount} required`, 400);
  }

  // Calculate discount on eligible portion only
  let discountAmount = 0;
  if (discount.type === "percentage") {
    discountAmount = (eligibleTotal * discount.value) / 100;
  } else if (discount.type === "fixed") {
    discountAmount = discount.value;
  }
  // Never exceed the eligible total
  discountAmount = Math.min(discountAmount, eligibleTotal);

  const eligibleLineIds = eligibleLines.map((l) => l.product.toString());

  return {
    code: discount.code,
    type: discount.type,
    value: discount.value,
    amount: Math.round(discountAmount * 100) / 100,
    eligibleLineIds,
  };
};

/**
 * Validate a SET of discount codes for stackability and apply each one to
 * the right portion of the cart. Returns a combined breakdown ready to
 * persist on the order.
 *
 * Rules:
 *   1. Each code must individually validate (expiry, usage caps, scope).
 *   2. Two discounts can stack only if BOTH opt in via combinesWith. The
 *      check is mutual — silent one-way consent is a footgun (a merchant
 *      adds a "stacks with shipping" flag to their VIP code without
 *      realising every shipping promo now joins it).
 *   3. The product/order portion of the discount comes off the subtotal.
 *      The shipping portion comes off shippingCost — for percentage
 *      shipping discounts the value is a fraction of the actual shipping
 *      charge, so 100% = free shipping.
 *
 * Returns:
 *   { codes: string[], breakdown: [{code, kind, amount}], productOrderAmount, shippingAmount, error? }
 *
 * On a stackability conflict it throws (the order endpoint surfaces the
 * message). On individual validation failure for code N>0 it also throws
 * — partial application would be more confusing than failing fast.
 */
export const validateDiscountCombination = async (
  models,
  codes,
  cartLines,
  userId,
  shippingCost = 0
) => {
  if (!Array.isArray(codes) || codes.length === 0) {
    return {
      codes: [],
      breakdown: [],
      productOrderAmount: 0,
      shippingAmount: 0,
    };
  }

  // De-dup case-insensitively. A merchant typing "SAVE10, save10" gets one
  // discount applied, not two.
  const seen = new Set();
  const uniq = [];
  for (const c of codes) {
    const norm = String(c || "").trim().toUpperCase();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    uniq.push(norm);
  }

  // Load every discount up front so we can run the stackability check
  // *before* doing the per-discount applicability work — a clear "these
  // two cannot combine" error is more useful than a half-applied quote.
  const records = [];
  for (const code of uniq) {
    const discount = await models.Discount.findOne({ code, isActive: true });
    if (!discount) throw new APIError(`Invalid discount code: ${code}`, 400);
    records.push(discount);
  }

  // Stackability — pairwise mutual-consent check. O(n²) but n is tiny
  // (a cart with >3 codes is already a UX smell).
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      const aAllowsB = !!a.combinesWith?.[b.kind];
      const bAllowsA = !!b.combinesWith?.[a.kind];
      if (!aAllowsB || !bAllowsA) {
        throw new APIError(
          `Discount ${a.code} cannot be combined with ${b.code}`,
          400
        );
      }
    }
  }

  // Now run each one through the per-discount validator and collect the
  // amounts. Shipping discounts are computed against the shipping cost
  // rather than the line totals.
  const breakdown = [];
  let productOrderAmount = 0;
  let shippingAmount = 0;

  for (const discount of records) {
    if (discount.kind === "shipping") {
      // Reuse expiry/cap checks but compute the amount ourselves so we
      // can apply it to shippingCost rather than line totals.
      if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
        throw new APIError(`Discount ${discount.code} has expired`, 400);
      }
      if (discount.usageLimit != null && discount.usedCount >= discount.usageLimit) {
        throw new APIError(`Discount ${discount.code} usage limit reached`, 400);
      }
      if (discount.perUserLimit != null && userId) {
        const userRedemptions = await models.Order.countDocuments({
          user: userId,
          discountCodes: discount.code,
        });
        if (userRedemptions >= discount.perUserLimit) {
          throw new APIError(
            `You have already used ${discount.code} the maximum number of times`,
            400
          );
        }
      }
      let amount = 0;
      if (discount.type === "percentage") {
        amount = (shippingCost * discount.value) / 100;
      } else if (discount.type === "fixed") {
        amount = discount.value;
      }
      amount = Math.min(amount, shippingCost);
      shippingAmount += amount;
      breakdown.push({
        code: discount.code,
        kind: "shipping",
        amount: Math.round(amount * 100) / 100,
      });
      continue;
    }

    // product/order — reuse the existing single-code path which already
    // handles scoping, min order amount, percentage vs fixed, etc.
    const result = await validateDiscount(models, discount.code, cartLines, userId);
    productOrderAmount += result.amount;
    breakdown.push({
      code: result.code,
      kind: discount.kind || "order",
      amount: result.amount,
    });
  }

  return {
    codes: breakdown.map((b) => b.code),
    breakdown,
    productOrderAmount: Math.round(productOrderAmount * 100) / 100,
    shippingAmount: Math.round(shippingAmount * 100) / 100,
  };
};

/**
 * Atomically increment usedCount when an order is placed.
 * Call this inside the order-creation transaction.
 *
 * @param {Object} models - Mongoose models for the tenant
 * @param {string} code - Discount code
 * @param {Object|null} session - Mongoose session for atomic transactions
 * @returns {Object} Updated discount document
 */
export const applyDiscount = async (models, code, session = null) => {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const options = session ? { session, new: true } : { new: true };
  const result = await models.Discount.findOneAndUpdate(
    {
      code: normalizedCode,
      isActive: true,
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
      ],
    },
    { $inc: { usedCount: 1 } },
    options
  );
  if (!result) throw new APIError("Discount usage limit reached", 400);
  return result;
};
