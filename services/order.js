import mongoose from "mongoose";
import crypto from "crypto";
import {
  createOrderRepo,
  getOrderRepo,
  getOrdersRepo,
  updateOrderRepo,
  updateOrderStatusRepo,
  getOrdersByUserRepo,
} from "../repositories/order.js";
import { getCartRepo, deleteCartRepo } from "../repositories/cart.js";
import {
  getAProductRepo,
  decrementStockRepo,
  incrementStockRepo,
  decrementVariantStockRepo,
  incrementVariantStockRepo,
  reservePreorderRepo,
  releasePreorderRepo,
  reserveVariantPreorderRepo,
  releaseVariantPreorderRepo,
} from "../repositories/product.js";
import { APIError } from "../middlewares/errorHandler.js";
import { tenantPopulate } from "../utils/scopedModel.js";
import { priceCheckout } from "./checkout.js";
import { applyDiscount } from "./discount.js";
import { lookupByCode as lookupGiftCardByCode, redeemGiftCard, redeemGiftCardById, refundGiftCard } from "./giftCard.js";
import { notifyOrderStatusChange, recordOrderNotified, notifyMerchantNewOrder } from "./orderNotifications.js";
import { emit as emitNotification } from "./notification.js";
import { guardTransition } from "../utils/orderStateMachine.js";
import { logStateChange } from "../utils/auditLog.js";

/**
 * Retry-on-VersionError helper.
 *
 * Mongoose optimistic concurrency (enabled on the Order schema) causes any
 * `order.save()` on a stale __v to throw a VersionError. That's the exact
 * signal we want for concurrent fulfillment / payment / return writes: the
 * second writer's view of the document is outdated, so reload and re-apply
 * the mutation against fresh state. We retry a small fixed number of
 * times; if contention is that severe, surfacing a 409 to the merchant so
 * they can refresh the UI is kinder than spinning indefinitely.
 *
 * Callers must ensure their `fn` does its own `findOne` + mutation on
 * every invocation so each retry works with a fresh document.
 */
export async function withVersionRetry(fn, { retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i += 1) {
    try {
      return await fn();
    } catch (e) {
      if (e?.name === "VersionError") {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw new APIError(
    "Order was modified by another request — please refresh and retry",
    409,
    lastErr ? [lastErr.message] : undefined
  );
}

// Permission helpers. Callers pass an effective-permission Set (from
// middlewares/authorize.js#getEffectivePermissions). "*" is the wildcard
// that built-in admin holds and that custom roles cannot grant.
const hasPerm = (permissions, key) => {
  if (!permissions) return false;
  if (typeof permissions.has === "function") return permissions.has("*") || permissions.has(key);
  return permissions.includes("*") || permissions.includes(key);
};
const canReadAllOrders = (p) => hasPerm(p, "orders.read");
const canWriteOrders = (p) => hasPerm(p, "orders.write");
const canCancelOrders = (p) => hasPerm(p, "orders.cancel") || hasPerm(p, "orders.write");

/**
 * Generate the next per-tenant order number.
 *
 * Strategy: find the highest existing order number for this tenant and add
 * one. Falls back to 1001 if there are no numbered orders yet so customer-
 * facing numbers look established (#1001, #1002, #1003…).
 *
 * `countDocuments` was the previous approach but it's wrong: it counts ALL
 * orders, including legacy ones with no orderNumber, which would let a
 * second click reuse a number that's already taken. Querying the actual max
 * is correct regardless of historical data shape.
 *
 * Concurrency: two requests can still race here, so the create call is
 * wrapped in a retry loop further down (createOrderWithUniqueNumber).
 */
const generateOrderNumber = async (models) => {
  const last = await models.Order
    .findOne({ orderNumber: { $exists: true, $ne: null } })
    .sort({ createdAt: -1 })
    .select("orderNumber")
    .lean();

  if (!last || !last.orderNumber) return "#1001";

  // Parse the trailing integer from "#1042" → 1042. Anything we can't parse
  // (legacy formats, manual edits) falls back to a timestamp-derived number.
  const match = String(last.orderNumber).match(/(\d+)$/);
  if (!match) return `#${Date.now()}`;

  const next = parseInt(match[1], 10) + 1;
  return `#${next}`;
};

/**
 * Create an order with a unique orderNumber. If the unique-index race
 * fires (E11000 on tenantId+orderNumber), regenerate the number and retry.
 * Caps at 5 attempts so a genuinely broken state still surfaces an error.
 */
const createOrderWithUniqueNumber = async (models, baseDoc, session) => {
  const MAX_ATTEMPTS = 5;
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const orderNumber = await generateOrderNumber(models);
    try {
      const order = await createOrderRepo(
        models,
        {
          ...baseDoc,
          orderNumber,
          history: [
            {
              event: "created",
              status: "Pending",
              note: `Order ${orderNumber} received and awaiting processing`,
              by: baseDoc.user || null,
              at: new Date(),
            },
          ],
        },
        session
      );
      return order;
    } catch (err) {
      // Only retry on the orderNumber uniqueness collision
      if (err?.code === 11000 && err?.keyPattern?.orderNumber) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError || new APIError("Could not allocate a unique order number", 500);
};

/**
 * Create order from cart
 */
export const createOrderService = async (models, userId, orderData, tenantId) => {
  const {
    cartId,
    shippingAddress,
    billingAddress,
    paymentMethod,
    paymentMethodCode,
    paymentDetails,
    discountCode,
    discountCodes,
    shippingMethod: clientShippingMethod,
    notes,
    customerEmail,
    customerPhone,
    acceptsMarketing,
    saveAddress,
    idempotencyKey: clientIdempotencyKey,
    sessionId,
    giftCardCode,
    giftCardId,
  } = orderData;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Resolve cart: by id when provided, otherwise the user's active cart.
    // Read inside the transaction so the cart snapshot we use to allocate
    // stock matches what other concurrent writes would see at commit time.
    // Guests don't have a userId — they own their cart via the session
    // cookie. The checkout controller passes `sessionId` through for this
    // case. Without this branch, `getCartRepo({ user: undefined })` would
    // match ANY unowned cart in the tenant and place the order against
    // someone else's items (or throw "cart empty").
    const cartFilter = cartId
      ? userId
        ? { _id: cartId, user: userId }
        : { _id: cartId, sessionId }
      : userId
      ? { user: userId }
      : { sessionId };
    const cart = await getCartRepo(models, {}, cartFilter, session);
    if (!cart || cart.items.length === 0) {
      throw new APIError("Cart is empty or not found", 400);
    }

    // ── Idempotency ──────────────────────────────────────────────────
    // Prefer a client-supplied key (fresh per checkout attempt). Fallback
    // incorporates the resolved cart id + its updatedAt so distinct carts
    // or mutated cart state produce distinct keys — avoids collapsing
    // every order by a given user into one deterministic key.
    const cartStamp = cart.updatedAt
      ? new Date(cart.updatedAt).getTime()
      : Date.now();
    const idempotencyKey =
      clientIdempotencyKey ||
      crypto
        .createHash("sha256")
        .update(
          `${tenantId}:${userId || `guest:${sessionId || "anon"}`}:${cart._id}:${cartStamp}`
        )
        .digest("hex");

    const existingOrder = await models.Order.findOne({ idempotencyKey }).session(session);
    if (existingOrder) {
      await session.abortTransaction();
      await session.endSession();
      return {
        success: true,
        statusCode: 200,
        message: "Order already exists (idempotent)",
        responseObject: existingOrder,
      };
    }

    const lines = [];

    for (const item of cart.items) {
      // Product read also bound to session — ensures the product/variant
      // shape we read here is consistent with the atomic stock decrement
      // we'll perform a few lines below.
      const product = await getAProductRepo(models, {}, { _id: item.product }, session);
      if (!product) throw new APIError(`Product not found: ${item.product}`, 404);

      // Resolve the variant (if any) — cart items reference variants by
      // their subdocument _id. We need the resolved variant for both stock
      // accounting and so the order line snapshot is independent of any
      // future edits to the product document.
      let variant = null;
      // The cart marks `isPreorder` at add-to-cart time when it accepted
      // the line against pre-order capacity rather than on-hand stock.
      // We honour that signal here so we hit the right counter (real
      // stock vs. preorder reservations). The pre-order config may
      // inherit from the product when the variant doesn't override.
      const isPreorder = !!item.isPreorder;

      if (item.variantId) {
        variant = (product.variants || []).find(
          (v) => v && v._id && v._id.toString() === String(item.variantId)
        );
        if (!variant) {
          throw new APIError(
            `Variant no longer available for ${product.name}`,
            400
          );
        }
        if (isPreorder) {
          // Reserve against the variant's preorder counter when it has
          // its own preorder block, otherwise fall back to the product's.
          const useVariantPreorder = !!variant.preorder?.enabled;
          const result = useVariantPreorder
            ? await reserveVariantPreorderRepo(
                models,
                item.product,
                variant._id,
                item.quantity,
                session
              )
            : await reservePreorderRepo(models, item.product, item.quantity, session);
          if (!result) {
            throw new APIError(
              `Pre-order capacity exhausted for ${product.name}`,
              400
            );
          }
        } else {
          const result = await decrementVariantStockRepo(
            models,
            item.product,
            variant._id,
            item.quantity,
            session
          );
          if (!result) {
            throw new APIError(
              `Insufficient stock for ${product.name} (${
                variant.optionValues?.map((o) => o.value).join(" / ") || variant.sku
              })`,
              400
            );
          }
        }
      } else {
        // Variant-less product — guard against accidentally selling a
        // variant-enabled product without a selection. We require the
        // storefront to always pick a variant for `hasVariants` products.
        if (product.hasVariants) {
          throw new APIError(
            `${product.name} requires a variant selection`,
            400
          );
        }
        if (isPreorder) {
          const result = await reservePreorderRepo(
            models,
            item.product,
            item.quantity,
            session
          );
          if (!result) {
            throw new APIError(
              `Pre-order capacity exhausted for ${product.name}`,
              400
            );
          }
        } else {
          const result = await decrementStockRepo(
            models,
            item.product,
            item.quantity,
            session
          );
          if (!result) {
            throw new APIError(`Insufficient stock for ${product.name}`, 400);
          }
        }
      }

      lines.push({
        product,
        quantity: item.quantity,
        variant,
        isPreorder,
        preorderExpectedShipDate: item.preorderExpectedShipDate,
      });
    }

    const quote = await priceCheckout({
      lines,
      shippingAddress,
      discountCode,
      discountCodes,
      models,
      tenantId,
      userId,
    });

    // priceCheckout swallows discount validation errors so the *quote* can
    // still render at full price in the storefront UI. But at the point of
    // actually placing an order, a user who supplied a code expects either
    // (a) the discount applied or (b) a clear error — silently charging
    // them full price is the worst outcome. Reject the order so the
    // storefront can show the reason and let them remove the code.
    const userProvidedAnyCode = discountCode || (Array.isArray(discountCodes) && discountCodes.length > 0);
    if (userProvidedAnyCode && quote.discountError) {
      throw new APIError(quote.discountError, 400);
    }

    // ── Gift card pre-validation ────────────────────────────────
    // Coverage is now per-card (card.coverShipping / card.coverTax) rather
    // than tenant-wide. Base coverage is always goods (subtotal - product
    // discount); the two per-card flags optionally extend it to shipping
    // and/or tax. A zero-total (fully covered) order bypasses the payment-
    // method requirement below.
    let giftCardApplied = null;
    if (giftCardId || giftCardCode) {
      let preview;
      if (giftCardId) {
        // Signed-in customer picked one of their stored cards. Verify
        // ownership server-side: match customerId OR the card's
        // issuedTo.email against the user's email (case-insensitive).
        if (!userId) {
          throw new APIError("Authentication required to use a stored gift card", 401);
        }
        const card = await models.GiftCard.findById(giftCardId).lean();
        if (!card) throw new APIError("Gift card not found", 404);
        const User = mongoose.model("User");
        const me = await models.User.findById(userId).select("email").lean()
          || await User.findById(userId).select("email").lean();
        const ownsByCustomer = card.customerId && String(card.customerId) === String(userId);
        const ownsByEmail =
          me?.email && card.issuedTo?.email &&
          String(card.issuedTo.email).toLowerCase() === String(me.email).toLowerCase();
        if (!ownsByCustomer && !ownsByEmail) {
          throw new APIError("Gift card does not belong to this customer", 403);
        }
        if (card.status !== "active") throw new APIError("Gift card is not active", 400);
        if (card.expiresAt && new Date(card.expiresAt) < new Date())
          throw new APIError("Gift card has expired", 400);
        preview = card;
      } else {
        preview = await lookupGiftCardByCode(models, giftCardCode);
      }

      const productDiscount = Math.max(
        0,
        (quote.discount || 0) - (quote.shippingDiscount || 0)
      );
      let coverageBase = Math.max(0, (quote.subtotal || 0) - productDiscount);
      if (preview.coverShipping) {
        coverageBase += Math.max(
          0,
          (quote.shippingCost || 0) - (quote.shippingDiscount || 0)
        );
      }
      if (preview.coverTax) {
        coverageBase += quote.tax || 0;
      }
      coverageBase = Math.min(coverageBase, quote.totalAmount);

      const applyAmount = Math.min(Number(preview.balance) || 0, coverageBase);
      if (applyAmount <= 0) {
        throw new APIError("Gift card has no available balance", 400);
      }
      giftCardApplied = {
        id: preview._id,
        code: giftCardCode || null,
        codeLast4: preview.codeLast4,
        amount: applyAmount,
      };
    }
    const isZeroTotal = !!(giftCardApplied && giftCardApplied.amount >= quote.totalAmount);

    // Persist customer profile updates (marketing opt-in, save address).
    // We split into $set + $push so Mongoose doesn't choke on the mixed-
    // operator update, and we use updateOne (not findByIdAndUpdate) so the
    // tenantId scope is enforced through the scoped model.
    if (userId) {
      const setFields = {};
      if (acceptsMarketing === true) {
        setFields.acceptsMarketing = true;
        setFields.marketingConsentAt = new Date();
      }
      const updateOps = {};
      if (Object.keys(setFields).length > 0) updateOps.$set = setFields;
      if (saveAddress && shippingAddress?.addressLine1) {
        updateOps.$push = {
          addresses: {
            label: "Shipping",
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
            phone: shippingAddress.phone,
            addressLine1: shippingAddress.addressLine1,
            addressLine2: shippingAddress.addressLine2,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.country,
          },
        };
      }
      if (Object.keys(updateOps).length > 0) {
        await models.User.updateOne({ _id: userId }, updateOps, { session });
      }
    }

    // ── Resolve dynamic payment method ───────────────────────────
    // If the storefront passed a `paymentMethodCode`, look up the tenant's
    // configured PaymentMethod, validate any required customer fields, and
    // derive a human-readable label for the legacy `paymentMethod` column.
    // Falls back to the raw `paymentMethod` string when no code is supplied
    // so older clients and admin-side creation paths keep working.
    let resolvedPaymentMethodCode = paymentMethodCode || undefined;
    let resolvedPaymentLabel = paymentMethod;
    let sanitizedPaymentDetails = {};
    if (isZeroTotal) {
      resolvedPaymentMethodCode = undefined;
      resolvedPaymentLabel = "Gift Card";
      sanitizedPaymentDetails = {};
    } else if (paymentMethodCode) {
      const configured = models.PaymentMethod
        ? await models.PaymentMethod.findOne({ code: paymentMethodCode, enabled: true }).session(session)
        : null;
      if (!configured) {
        throw new APIError(`Payment method not available: ${paymentMethodCode}`, 400);
      }
      const details = paymentDetails && typeof paymentDetails === "object" ? paymentDetails : {};
      const fieldErrors = {};

      // Manual methods require the customer to pick a sub-provider
      // (Bankak, Fawry, ...). Validate the provider exists and is
      // enabled by the merchant; persist it in paymentDetails.
      if (configured.type === "manual") {
        const providerCode = details.providerCode;
        const availableProviders = (configured.providers || []).filter(
          (p) => p.enabled
        );
        if (availableProviders.length === 0) {
          throw new APIError(
            "This payment method has no providers configured. Please choose another.",
            400
          );
        }
        if (!providerCode) {
          const err = new APIError("Please select a transfer provider", 400);
          err.fieldErrors = { providerCode: "Required" };
          throw err;
        }
        const provider = availableProviders.find((p) => p.code === providerCode);
        if (!provider) {
          const err = new APIError("Selected provider is not available", 400);
          err.fieldErrors = { providerCode: "Unavailable" };
          throw err;
        }
        sanitizedPaymentDetails.providerCode = provider.code;
        sanitizedPaymentDetails.providerLabel = provider.label;
      }

      const MAX_FILE_BYTES = 5 * 1024 * 1024;
      for (const field of configured.customerFields || []) {
        const raw = details[field.name];
        const hasValue =
          raw !== undefined &&
          raw !== null &&
          !(typeof raw === "string" && raw.trim() === "");
        if (field.required && !hasValue) {
          fieldErrors[field.name] = `${field.label} is required`;
          continue;
        }
        if (hasValue && field.type === "file") {
          // Accept base64 data URL or { data, name, type, size }
          const dataUrl = typeof raw === "string" ? raw : raw?.data;
          if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
            fieldErrors[field.name] = `${field.label} must be an uploaded file`;
            continue;
          }
          // approximate decoded byte size from base64 length
          const base64 = dataUrl.split(",")[1] || "";
          const approxBytes = Math.floor((base64.length * 3) / 4);
          const cap = field.maxSize || MAX_FILE_BYTES;
          if (approxBytes > cap) {
            const err = new APIError(`${field.label} exceeds maximum size`, 400);
            err.code = "PAYLOAD_TOO_LARGE";
            err.fieldErrors = { [field.name]: "File too large" };
            throw err;
          }
        }
        if (hasValue) sanitizedPaymentDetails[field.name] = raw;
      }
      if (Object.keys(fieldErrors).length > 0) {
        const err = new APIError("Payment details invalid", 400);
        err.fieldErrors = fieldErrors;
        throw err;
      }
      resolvedPaymentMethodCode = configured.code;
      resolvedPaymentLabel = configured.label || paymentMethodCode;
    }
    if (!resolvedPaymentLabel && !isZeroTotal) {
      throw new APIError("Payment method is required", 400);
    }

    // ── Per-line allocation of order-level discount & tax ─────────────
    // Distribute the order's product/order discount and tax across the
    // lines pro-rata by line subtotal so refund math and reporting can be
    // done at the line level without re-deriving the split later. Shipping
    // discounts are intentionally excluded (they apply to shipping, not
    // goods). Rounding error is absorbed by the last line so the sum
    // exactly matches the order-level totals.
    const orderSubtotal = quote.subtotal || 0;
    const productOrderDiscount = Math.max(0, (quote.discount || 0) - (quote.shippingDiscount || 0));
    const lineAllocations = quote.lines.map((l, idx) => {
      const lineTotal = (l.unitPrice || 0) * (l.quantity || 0);
      const share = orderSubtotal > 0 ? lineTotal / orderSubtotal : (idx === 0 ? 1 : 0);
      return {
        discount: Math.round(productOrderDiscount * share * 100) / 100,
        tax: Math.round((quote.tax || 0) * share * 100) / 100,
      };
    });
    // Reconcile rounding: last line absorbs the residual.
    if (lineAllocations.length > 0) {
      const dSum = lineAllocations.reduce((s, a) => s + a.discount, 0);
      const tSum = lineAllocations.reduce((s, a) => s + a.tax, 0);
      const last = lineAllocations[lineAllocations.length - 1];
      last.discount = Math.round((last.discount + (productOrderDiscount - dSum)) * 100) / 100;
      last.tax = Math.round((last.tax + ((quote.tax || 0) - tSum)) * 100) / 100;
      if (last.discount < 0) last.discount = 0;
      if (last.tax < 0) last.tax = 0;
    }

    // ── Customer snapshot ─────────────────────────────────────────────
    // Immutable identity captured once at creation. For authenticated
    // buyers we pull the profile fields (best-effort — a failed lookup
    // falls back to the shipping address + provided email so the snapshot
    // is always populated). For guests we use the guestCustomer fields.
    let customerSnapshot = null;
    // Language to localize this order's customer emails: the registered
    // customer's account language, else the store's language at order time.
    let orderLanguage = null;
    if (userId) {
      try {
        const u = models.User
          ? await models.User.findById(userId).select("email firstName lastName phone name language").session(session).lean()
          : null;
        if (u) {
          orderLanguage = u.language || null;
          let firstName = u.firstName;
          let lastName = u.lastName;
          if ((!firstName || !lastName) && u.name) {
            const parts = String(u.name).trim().split(/\s+/);
            firstName = firstName || parts[0];
            lastName = lastName || parts.slice(1).join(" ") || undefined;
          }
          customerSnapshot = {
            email: u.email || customerEmail,
            firstName: firstName || shippingAddress?.firstName,
            lastName: lastName || shippingAddress?.lastName,
            phone: u.phone || customerPhone || shippingAddress?.phone,
          };
        }
      } catch {
        // Non-fatal — fall through to address-derived fallback below.
      }
      if (!customerSnapshot) {
        customerSnapshot = {
          email: customerEmail,
          firstName: shippingAddress?.firstName,
          lastName: shippingAddress?.lastName,
          phone: customerPhone || shippingAddress?.phone,
        };
      }
    } else {
      customerSnapshot = {
        email: customerEmail,
        firstName: shippingAddress?.firstName,
        lastName: shippingAddress?.lastName,
        phone: customerPhone || shippingAddress?.phone,
      };
    }

    // Product image resolver — the product document carries either an
    // `images[]` array (new schema) or a single `image` string (legacy).
    // We snapshot the first available URL onto the line so the dashboard
    // renders a thumbnail even if the product's media is later removed.
    const imageForLine = (line) => {
      const p = line.productDoc || null;
      if (!p) return undefined;
      if (Array.isArray(p.images) && p.images.length > 0) {
        const first = p.images[0];
        if (typeof first === "string") return first;
        if (first && typeof first === "object") return first.url || first.src || undefined;
      }
      if (typeof p.image === "string") return p.image;
      return undefined;
    };

    const adjustedTotal = giftCardApplied
      ? Math.max(0, quote.totalAmount - giftCardApplied.amount)
      : quote.totalAmount;

    // Guests (and any registered user without a language) inherit the
    // store's current language — captured on the order so later emails use
    // the locale the order was actually placed in.
    if (!orderLanguage) {
      try {
        const t = await mongoose.model("Tenant").findById(tenantId).select("settings.language").lean();
        orderLanguage = t?.settings?.language || "en";
      } catch {
        orderLanguage = "en";
      }
    }

    const order = await createOrderWithUniqueNumber(
      models,
      {
        idempotencyKey,
        calculationVersion: quote.calculationVersion,
        user: userId,
        language: orderLanguage,
        customerSnapshot,
        products: quote.lines.map((l, idx) => {
          // `lines` (the input array we built earlier from cart items) still
          // carries the full product document; `quote.lines` was remapped to
          // ids. Cross-walk by product id to recover the thumbnail.
          const originalLine = lines.find(
            (ol) => ol.product && ol.product._id && l.product &&
              ol.product._id.toString() === l.product.toString()
          );
          const imageUrl = originalLine ? imageForLine({ productDoc: originalLine.product }) : undefined;
          const alloc = lineAllocations[idx] || { discount: 0, tax: 0 };
          return {
            product: l.product,
            name: l.name,
            sku: l.sku,
            ...(imageUrl ? { image: imageUrl } : {}),
            quantity: l.quantity,
            price: l.unitPrice,
            discountAllocation: alloc.discount,
            taxAllocation: alloc.tax,
            ...(l.variant
              ? {
                  variantId: l.variant.id,
                  variantOptions: l.variant.optionValues || [],
                }
              : {}),
            ...(l.isPreorder
              ? {
                  isPreorder: true,
                  preorderExpectedShipDate: l.preorderExpectedShipDate || undefined,
                }
              : {}),
          };
        }),
        subtotal: quote.subtotal,
        discount: quote.discount,
        discountCode: quote.discountCode,
        discountCodes: quote.discountCodes || [],
        discountBreakdown: quote.discountBreakdown || [],
        shippingDiscount: quote.shippingDiscount || 0,
        shippingCost: quote.shippingCost,
        shippingMethod: clientShippingMethod || quote.shippingMethod,
        tax: quote.tax,
        taxBreakdown: quote.taxBreakdown || [],
        taxIncluded: quote.taxIncluded || false,
        totalAmount: adjustedTotal,
        ...(giftCardApplied
          ? {
              giftCardRedemption: {
                codeLast4: giftCardApplied.codeLast4,
                amount: giftCardApplied.amount,
                redeemedAt: new Date(),
              },
            }
          : {}),
        // Presentment snapshot — only persisted when the checkout actually
        // resolved a market. Buyers in unconfigured stores keep the legacy
        // base-currency-only order shape so older clients aren't confused
        // by null presentment fields.
        ...(quote.presentmentCurrency
          ? {
              baseCurrency: quote.baseCurrency,
              presentmentCurrency: quote.presentmentCurrency,
              presentmentSubtotal: quote.presentmentSubtotal,
              presentmentTotal: quote.presentmentTotal,
              presentmentTax: quote.presentmentTax,
              presentmentShipping: quote.presentmentShipping,
              fxRate: quote.fxRate,
              marketCode: quote.marketCode,
            }
          : {}),
        shippingAddress,
        billingAddress: billingAddress || shippingAddress,
        paymentMethod: resolvedPaymentLabel,
        paymentMethodCode: resolvedPaymentMethodCode,
        paymentDetails: sanitizedPaymentDetails,
        notes,
        ...(customerEmail && !userId
          ? {
              guestCustomer: {
                email: customerEmail,
                phone: customerPhone,
                firstName: shippingAddress?.firstName,
                lastName: shippingAddress?.lastName,
              },
            }
          : {}),
        status: isZeroTotal ? "Processing" : "Pending",
        paymentStatus: isZeroTotal ? "Paid" : "Not Paid",
      },
      session
    );

    if (isZeroTotal && giftCardApplied) {
      const gcTxnId = `gc-${giftCardApplied.codeLast4}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await models.Payment.create(
        [
          {
            order: order._id,
            provider: "giftcard",
            amount: giftCardApplied.amount,
            status: "completed",
            providerTransactionId: gcTxnId,
            // Compound sparse index on (tenantId, eventId) still indexes
            // rows where eventId is missing, so every Payment needs a
            // unique value here or the second gift-card payment collides.
            eventId: gcTxnId,
          },
        ],
        { session }
      );
    }

    // Atomically increment discount usage within the transaction. With
    // multi-code support every applied code's usedCount must be bumped —
    // not just the legacy `discountCode` shorthand. We iterate the
    // breakdown so the count matches what was actually applied to the
    // order.
    const codesToBump = quote.discountCodes && quote.discountCodes.length > 0
      ? quote.discountCodes
      : (quote.discountCode ? [quote.discountCode] : []);
    for (const code of codesToBump) {
      await applyDiscount(models, code, session);
    }

    // Delete the cart we actually loaded — `cartId` from request body may
    // be undefined, in which case the previous code did `deleteOne({_id:
    // undefined})` and silently kept the cart around, polluting the next
    // order with stale items.
    await deleteCartRepo(models, { _id: cart._id }, session);

    // Redeem the gift card BEFORE commit. The giftCard service operates
    // outside our mongo session (no session param supported), so if the
    // commit below fails we compensate with a refund. If redeem itself
    // fails we abort the transaction cleanly — no zombie order.
    let redeemedCard = null;
    if (giftCardApplied) {
      redeemedCard = giftCardApplied.code
        ? await redeemGiftCard(
            models,
            giftCardApplied.code,
            giftCardApplied.amount,
            { orderId: order._id, by: userId || null }
          )
        : await redeemGiftCardById(
            models,
            giftCardApplied.id,
            giftCardApplied.amount,
            { orderId: order._id, by: userId || null }
          );
    }

    try {
      await session.commitTransaction();
    } catch (commitErr) {
      if (redeemedCard) {
        // Best-effort compensation: the balance has been debited but the
        // order never materialised. Add the amount back so the customer
        // isn't charged for nothing.
        try {
          await refundGiftCard(models, redeemedCard._id, giftCardApplied.amount, {
            orderId: order._id,
            by: userId || null,
            note: "Auto-refund: order commit failed",
          });
        } catch (_) {
          // Swallow — the original commit error is what the caller needs.
        }
      }
      throw commitErr;
    }
    await session.endSession();

    // Audit log — post-commit, fire-and-forget.
    logStateChange(models, {
      entity: "order",
      resourceId: order._id,
      from: null,
      to: "Pending",
      actor: userId || null,
      reason: "Order created from cart",
      metadata: {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        idempotencyKey,
        calculationVersion: quote.calculationVersion,
      },
    });

    // Fire-and-forget merchant new-order email. Must NOT block the response
    // or surface a 500 if the mail provider is flaky — the order is already
    // safely committed at this point.
    notifyMerchantNewOrder(order, tenantId).catch((err) =>
      console.error("notifyMerchantNewOrder failed", err)
    );

    // Customer order-confirmation email (the "order received" template for the
    // order's initial status). Previously only status CHANGES emailed the
    // customer, so they never got a confirmation on placement. Fire-and-forget.
    notifyOrderStatusChange(order, order.status || "Pending")
      .then((r) => recordOrderNotified(order, order.status || "Pending", r).catch(() => {}))
      .catch((err) => console.error("customer order-confirmation email failed", err));

    // ── In-app notifications (best-effort, never break the order flow) ──
    try {
      const customerName = [
        order.customerSnapshot?.firstName,
        order.customerSnapshot?.lastName,
      ]
        .filter(Boolean)
        .join(" ") || order.customerSnapshot?.email || "Guest";
      emitNotification(models, tenantId, {
        type: "order.created",
        severity: "success",
        title: "New order",
        body: `${order.orderNumber} from ${customerName}`,
        resourceType: "order",
        resourceId: order._id,
        permission: "orders.read",
        data: {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          currency: order.baseCurrency || order.presentmentCurrency,
          customerName,
        },
      });
    } catch (err) {
      console.warn("emit order.created failed", err?.message);
    }

    // Manual payment method submitted — flags the order for merchant
    // verification in the payments inbox.
    try {
      if (order.paymentMethodCode && order.paymentStatus === "Not Paid") {
        // Re-read configured method to confirm it's a manual type before
        // emitting; a gateway code (e.g. "stripe") shouldn't fire this.
        const method = models.PaymentMethod
          ? await models.PaymentMethod.findOne({ code: order.paymentMethodCode }).lean()
          : null;
        if (method?.type === "manual") {
          emitNotification(models, tenantId, {
            type: "payment.manual_submitted",
            severity: "warning",
            title: "Manual payment submitted",
            body: `Order ${order.orderNumber} is awaiting manual payment verification`,
            resourceType: "payment",
            resourceId: order._id,
            permission: "payments.read",
            data: {
              orderNumber: order.orderNumber,
              totalAmount: order.totalAmount,
              methodCode: order.paymentMethodCode,
            },
          });
        }
      }
    } catch (err) {
      console.warn("emit payment.manual_submitted failed", err?.message);
    }

    // Low-stock sweep for lines we decremented. Dedupe by resourceId over
    // the last 24h so a flurry of orders doesn't spam the inbox.
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      for (const line of lines) {
        const p = line.product;
        if (!p || line.isPreorder) continue;
        if (p.trackInventory === false) continue;
        const threshold = typeof p.lowStockThreshold === "number" ? p.lowStockThreshold : 5;
        // Re-read stock post-decrement — `lines[].product` is the pre-write snapshot.
        const fresh = await models.Product.findById(p._id).select("stock lowStockThreshold name").lean();
        if (!fresh) continue;
        const currentStock = typeof fresh.stock === "number" ? fresh.stock : 0;
        if (currentStock > threshold) continue;
        const dupe = await models.Notification.findOne({
          type: "stock.low",
          resourceId: p._id,
          createdAt: { $gte: cutoff },
        }).lean();
        if (dupe) continue;
        emitNotification(models, tenantId, {
          type: "stock.low",
          severity: "warning",
          title: "Low stock",
          body: `${fresh.name} is at ${currentStock} (threshold ${threshold})`,
          resourceType: "product",
          resourceId: p._id,
          permission: "products.read",
          data: {
            productId: String(p._id),
            name: fresh.name,
            stock: currentStock,
            threshold,
          },
        });
      }
    } catch (err) {
      console.warn("emit stock.low failed", err?.message);
    }

    return { success: true, statusCode: 201, message: "Order created successfully", responseObject: order };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

const formatOrderForDashboard = (order) => {
  if (!order) return null;

  let subtotal = 0;
  const formattedProducts = order.products.map((item) => {
    const product = item.product || {};
    const price = item.price || product.price || 0;
    const quantity = item.quantity || 1;
    const itemTotal = price * quantity;
    subtotal += itemTotal;
    return {
      // Preserve the order-line `_id` so the dashboard can map fulfillment
      // items back to their parent line for the picker UI.
      _id: item._id,
      product: product._id || product.id || item.product,
      name: item.name || product.name || "Unknown Product",
      sku: item.sku || product.sku || "N/A",
      image:
        item.image ||
        (Array.isArray(product.images) && product.images.length > 0
          ? (typeof product.images[0] === "string"
              ? product.images[0]
              : product.images[0]?.url || product.images[0]?.src)
          : product.image) ||
        undefined,
      quantity,
      price,
      total: itemTotal,
      variantId: item.variantId,
      variantOptions: item.variantOptions,
      isPreorder: item.isPreorder,
      preorderExpectedShipDate: item.preorderExpectedShipDate,
      fulfilledQuantity: item.fulfilledQuantity || 0,
      discountAllocation: item.discountAllocation || 0,
      taxAllocation: item.taxAllocation || 0,
      refundedQuantity: item.refundedQuantity || 0,
      returnedQuantity: item.returnedQuantity || 0,
    };
  });

  const shipping = order.shippingCost || 0;
  const tax = order.tax || 0;
  const total = order.totalAmount || 0;

  const shippingAddress = order.shippingAddress
    ? {
        name: order.shippingAddress.firstName && order.shippingAddress.lastName
          ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
          : "",
        street: order.shippingAddress.addressLine1 || "",
        city: order.shippingAddress.city || "",
        state: order.shippingAddress.state || "",
        postalCode: order.shippingAddress.postalCode || "",
        country: order.shippingAddress.country || "",
        phone: order.shippingAddress.phone || "",
      }
    : {};

  const orderObj = order.toObject ? order.toObject() : order._doc || order;

  return {
    ...orderObj,
    subtotal,
    tax,
    shipping,
    total,
    products: formattedProducts,
    shippingAddress,
  };
};

export const getOrderService = async (models, orderId, userId, permissions) => {
  const order = await getOrderRepo(models, { _id: orderId });
  if (!order) throw new APIError("Order not found", 404);

  const isOwner = order.user && order.user._id && order.user._id.toString() === userId;
  if (!canReadAllOrders(permissions) && !isOwner) {
    throw new APIError("Access denied to this order", 403);
  }

  return { success: true, statusCode: 200, message: "Order retrieved successfully", responseObject: formatOrderForDashboard(order) };
};

export const getOrdersService = async (models, filters, options, userId, permissions) => {
  if (!canReadAllOrders(permissions)) filters.user = userId;

  const result = await getOrdersRepo(models, filters, options);
  return {
    success: true,
    statusCode: 200,
    message: "Orders retrieved successfully",
    responseObject: { orders: result.orders.map(formatOrderForDashboard), pagination: result.pagination },
  };
};

// Customer-facing description of each terminal state. The timeline UI
// labels events from this map so the audit trail reads as a narrative
// ("Order is being processed") instead of a transcript of admin actions
// ("Status changed from Pending to Processing").
const STATUS_NOTE = {
  Pending:    "Order is awaiting processing",
  Processing: "Order is being prepared",
  Shipped:    "Order has been shipped and is on its way",
  Delivered:  "Order has been delivered",
  Cancelled:  "Order has been cancelled",
  Refunded:   "Order has been refunded",
};

export const updateOrderStatusService = async (models, orderId, status, userId, permissions) => {
  if (!canWriteOrders(permissions)) {
    throw new APIError("You do not have permission to update order status", 403);
  }

  return withVersionRetry(async () => {
  const existing = await models.Order.findOne({ _id: orderId });
  if (!existing) throw new APIError("Order not found", 404);

  const previousStatus = existing.status;

  // State machine guard — rejects illegal transitions with a clear error.
  const transition = guardTransition("order", previousStatus, status);
  if (transition.noop) {
    return { success: true, statusCode: 200, message: "Order already in requested status", responseObject: formatOrderForDashboard(existing) };
  }

  // COD orders are settled in cash when the courier hands the package over,
  // so the moment the order flips to "Delivered" the payment is effectively
  // collected. Auto-mark it Paid and log a separate history event so the
  // audit trail shows both the status change AND the payment settlement.
  const now = new Date();
  const pmLc = (existing.paymentMethod || "").toLowerCase();
  const pmCodeLc = (existing.paymentMethodCode || "").toLowerCase();
  const isCod =
    pmLc === "cod" ||
    pmLc.includes("cash on delivery") ||
    pmCodeLc === "cod" ||
    pmCodeLc.includes("cash_on_delivery");
  const shouldSettleCod =
    status === "Delivered" &&
    isCod &&
    existing.paymentStatus !== "Paid";

  const setFields = { status, updatedAt: now };
  const historyEntries = [
    {
      event: "status_changed",
      status,
      previousStatus,
      note: STATUS_NOTE[status] || `Order is now ${status.toLowerCase()}`,
      by: userId || null,
      at: now,
    },
  ];
  if (shouldSettleCod) {
    setFields.paymentStatus = "Paid";
    historyEntries.push({
      event: "payment_status_changed",
      note: "Cash on delivery collected — marked as paid",
      by: userId || null,
      at: now,
    });
  }

  const order = await models.Order.findOneAndUpdate(
    { _id: orderId },
    {
      $set: setFields,
      $push: { history: { $each: historyEntries } },
    },
    { new: true, runValidators: true }
  )
    .populate("user", "name email")
    .populate("products.product", "name price images");

  // COD just settled — record a Payment row so it shows up in the
  // transactions list and counts toward the refund cap. Post-write,
  // best-effort; a failure here must not break the status transition.
  if (shouldSettleCod && models.Payment) {
    try {
      await models.Payment.create({
        tenantId: order.tenantId,
        order: order._id,
        provider: "manual",
        amount: order.totalAmount,
        currency: order.baseCurrency || "SDG",
        status: "completed",
        paymentMethod: order.paymentMethod || "cod",
        metadata: { reason: "Cash on delivery collected on delivery" },
      });
    } catch (err) {
      console.error("[order] Failed to record COD Payment row:", err?.message || err);
    }
  }

  // Fire customer notification for the new status. Awaited so the test
  // inbox is populated by the time the response returns; failures are
  // swallowed inside the notifier so they can never break the status
  // write itself.
  const notifyResult = await notifyOrderStatusChange(order, status);
  await recordOrderNotified(order, status, notifyResult, { userId });

  // Audit log — post-write, fire-and-forget.
  logStateChange(models, {
    entity: "order",
    resourceId: orderId,
    from: previousStatus,
    to: status,
    actor: userId || null,
  });

  if (shouldSettleCod) {
    logStateChange(models, {
      entity: "payment",
      resourceId: orderId,
      from: "Not Paid",
      to: "Paid",
      actor: null,
      reason: "COD auto-settled on delivery",
    });
  }

  return { success: true, statusCode: 200, message: "Order status updated successfully", responseObject: formatOrderForDashboard(order) };
  });
};

/**
 * Update tracking number / carrier on a shipped order. Records to history
 * so the timeline shows when fulfillment info was added or changed.
 */
export const updateOrderTrackingService = async (models, orderId, trackingData, userId, permissions) => {
  if (!canWriteOrders(permissions)) {
    throw new APIError("You do not have permission to update tracking", 403);
  }

  const { trackingNumber, trackingCarrier } = trackingData;

  const existing = await models.Order.findOne({ _id: orderId });
  if (!existing) throw new APIError("Order not found", 404);

  const previousTracking = existing.trackingNumber;
  const setFields = { updatedAt: new Date() };
  if (trackingNumber !== undefined) setFields.trackingNumber = trackingNumber;
  if (trackingCarrier !== undefined) setFields.trackingCarrier = trackingCarrier;

  const note = previousTracking
    ? `Tracking number changed to ${trackingNumber}`
    : `Tracking number ${trackingNumber} is now available`;

  const order = await models.Order.findOneAndUpdate(
    { _id: orderId },
    {
      $set: setFields,
      $push: {
        history: {
          event: "tracking_updated",
          note,
          by: userId || null,
          at: new Date(),
        },
      },
    },
    { new: true, runValidators: true }
  )
    .populate("user", "name email")
    .populate("products.product", "name price images");

  return { success: true, statusCode: 200, message: "Tracking updated successfully", responseObject: formatOrderForDashboard(order) };
};

export const cancelOrderService = async (models, orderId, userId, permissions) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Read in-session so the status check, stock rollback, and order
    // update all observe the same snapshot. Without this, two concurrent
    // cancels could both pass the "Pending|Processing" guard.
    const order = await getOrderRepo(models, { _id: orderId }, {}, session);
    if (!order) throw new APIError("Order not found", 404);

    const isOwner = order.user._id.toString() === userId;
    if (!canCancelOrders(permissions) && !isOwner) {
      throw new APIError("Access denied to cancel this order", 403);
    }
    if (!["Pending", "Processing"].includes(order.status)) throw new APIError(`Cannot cancel order with status: ${order.status}`, 400);

    for (const item of order.products) {
      // Restore to the variant when the order line was variant-scoped,
      // otherwise to the product itself. The product/variant may have
      // been deleted since the order was placed — in that case the
      // increment is a silent no-op (nothing to roll back into).
      //
      // Pre-order lines didn't decrement on-hand stock at order time;
      // they incremented a reservation counter instead. Release that
      // counter so the freed capacity is available to other shoppers.
      if (item.isPreorder) {
        if (item.variantId) {
          // Try variant-level release first; if the variant has no
          // preorder block of its own, the order would have reserved
          // against the product-level counter.
          const productDoc = await getAProductRepo(models, {}, { _id: item.product }, session);
          const v = (productDoc?.variants || []).find(
            (x) => x && x._id && String(x._id) === String(item.variantId)
          );
          if (v?.preorder?.enabled) {
            await releaseVariantPreorderRepo(
              models,
              item.product,
              item.variantId,
              item.quantity,
              session
            );
          } else {
            await releasePreorderRepo(models, item.product, item.quantity, session);
          }
        } else {
          await releasePreorderRepo(models, item.product, item.quantity, session);
        }
      } else if (item.variantId) {
        await incrementVariantStockRepo(
          models,
          item.product,
          item.variantId,
          item.quantity,
          session
        );
      } else {
        await incrementStockRepo(models, item.product, item.quantity, session);
      }
    }

    // Guarded transition: only flip Pending|Processing → Cancelled. If
    // some other process already cancelled or moved it forward, this
    // returns null and we abort the txn so the stock rollback never
    // commits — there's nothing to roll back into.
    const updatedOrder = await models.Order.findOneAndUpdate(
      { _id: orderId, status: { $in: ["Pending", "Processing"] } },
      {
        $set: { status: "Cancelled", updatedAt: new Date() },
        $push: {
          history: {
            event: "cancelled",
            status: "Cancelled",
            previousStatus: order.status,
            note: "Order has been cancelled and stock returned",
            by: userId || null,
            at: new Date(),
          },
        },
      },
      { new: true, runValidators: true, session }
    )
      .populate("user", "name email")
      .populate("products.product", "name price images");

    if (!updatedOrder) {
      // Lost the race — another actor flipped status between our read
      // and our write. Abort to roll back the stock increments.
      throw new APIError("Order is no longer cancellable", 409);
    }

    // ── Discount usage rollback ─────────────────────────────────────
    // Decrement usedCount for every discount code applied to this order.
    // If the discount was deleted since the order was placed, the
    // findOneAndUpdate is a silent no-op — nothing to roll back.
    const codesToRollback =
      order.discountCodes && order.discountCodes.length > 0
        ? order.discountCodes
        : order.discountCode
        ? [order.discountCode]
        : [];
    for (const code of codesToRollback) {
      const normalizedCode = String(code || "").trim().toUpperCase();
      await models.Discount.findOneAndUpdate(
        { code: normalizedCode, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
        { session }
      );
    }

    await session.commitTransaction();
    await session.endSession();

    // Audit log — post-commit, fire-and-forget.
    logStateChange(models, {
      entity: "order",
      resourceId: orderId,
      from: order.status,
      to: "Cancelled",
      actor: userId || null,
      reason: "Order cancelled — stock and discount usage rolled back",
    });

    // Notify customer post-commit. We deliberately wait until after the
    // txn closes — sending an "order cancelled" email and then aborting
    // would be worse than not sending one at all.
    const cancelNotifyResult = await notifyOrderStatusChange(updatedOrder, "Cancelled");
    if (cancelNotifyResult?.success) {
      // Reload as a live doc so we can push a notified event (we're
      // post-commit so the main txn can't carry it). Best-effort; don't
      // fail the cancel if the history append fails.
      try {
        const liveOrder = await models.Order.findById(orderId);
        if (liveOrder) {
          await recordOrderNotified(liveOrder, "Cancelled", cancelNotifyResult, { userId });
        }
      } catch { /* best-effort */ }
    }

    return { success: true, statusCode: 200, message: "Order cancelled successfully", responseObject: updatedOrder };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

export const getUserOrdersService = async (models, userId, options) => {
  const result = await getOrdersByUserRepo(models, userId, options);
  return { success: true, statusCode: 200, message: "Order history retrieved successfully", responseObject: result };
};

// ─── Fulfillments ──────────────────────────────────────────────────────
//
// Fulfillments are first-class shipment records on an order. The order's
// top-level status is auto-derived from the union of fulfillment statuses
// (see `recomputeOrderStatusFromFulfillments`) so admins don't need to
// keep both in sync — they manage fulfillments and the order status
// follows. Manual order-status overrides still work via
// `updateOrderStatusService`.

/**
 * Roll up the order status from its non-cancelled fulfillments and the
 * remaining unfulfilled quantity. Returns the new status string.
 *
 *   • All ordered units delivered            → "Delivered"
 *   • All ordered units shipped (or beyond)  → "Shipped"
 *   • Any fulfillment exists, more pending   → "Processing"
 *   • Nothing fulfilled yet                  → "Pending"
 *
 * Cancelled fulfillments don't count toward shipped/delivered totals
 * (their units bounce back to the unfulfilled pool).
 */
export const recomputeOrderStatusFromFulfillments = (order) => {
  // If the merchant has manually cancelled or refunded the order, leave
  // the status alone — fulfillment changes don't override those.
  if (["Cancelled", "Refunded"].includes(order.status)) return order.status;

  const totalQuantity = (order.products || []).reduce(
    (sum, p) => sum + (p.quantity || 0),
    0
  );
  if (totalQuantity === 0) return order.status;

  const live = (order.fulfillments || []).filter((f) => f.status !== "Cancelled");
  if (live.length === 0) return "Pending";

  const sumLive = (predicate) =>
    live
      .filter(predicate)
      .reduce(
        (sum, f) => sum + (f.items || []).reduce((s, i) => s + i.quantity, 0),
        0
      );

  const deliveredQty = sumLive((f) => f.status === "Delivered");
  const shippedOrBeyondQty = sumLive((f) => f.status === "Shipped" || f.status === "Delivered");

  if (deliveredQty >= totalQuantity) return "Delivered";
  if (shippedOrBeyondQty >= totalQuantity) return "Shipped";
  return "Processing";
};

/**
 * Roll up the ORDER-LEVEL fulfillmentStatus enum ("Unfulfilled",
 * "Partially Fulfilled", "Fulfilled", "Returned", "Cancelled") from the
 * fulfillments[] + returns[] sub-documents. Stored on the order so list
 * views can filter/sort by it without loading every shipment, and so the
 * UI can show payment / order / fulfillment lifecycles independently.
 */
export const recomputeOrderFulfillmentStatus = (order) => {
  if (order.status === "Cancelled") return "Cancelled";

  const totalQuantity = (order.products || []).reduce(
    (sum, p) => sum + (p.quantity || 0),
    0
  );
  if (totalQuantity === 0) return "Unfulfilled";

  const live = (order.fulfillments || []).filter((f) => f.status !== "Cancelled");
  const shippedOrBeyondQty = live
    .filter((f) => f.status === "Shipped" || f.status === "Delivered")
    .reduce(
      (sum, f) => sum + (f.items || []).reduce((s, i) => s + i.quantity, 0),
      0
    );

  // Fully refunded returns flip the order into Returned terminal state.
  const refundedReturnQty = (order.returns || [])
    .filter((r) => r.status === "Refunded")
    .reduce(
      (sum, r) => sum + (r.items || []).reduce((s, i) => s + i.quantity, 0),
      0
    );
  if (refundedReturnQty >= totalQuantity && shippedOrBeyondQty >= totalQuantity) {
    return "Returned";
  }

  if (shippedOrBeyondQty <= 0) return "Unfulfilled";
  if (shippedOrBeyondQty >= totalQuantity) return "Fulfilled";
  return "Partially Fulfilled";
};

/**
 * Compute "remaining to fulfill" per order line, taking existing
 * non-cancelled fulfillments into account. Used to validate new
 * fulfillment payloads and to render the dashboard picker.
 */
export const computeUnfulfilledByLine = (order) => {
  const remaining = new Map();
  for (const line of order.products || []) {
    remaining.set(String(line._id), line.quantity || 0);
  }
  for (const f of order.fulfillments || []) {
    if (f.status === "Cancelled") continue;
    for (const fi of f.items || []) {
      const key = String(fi.orderLineId);
      remaining.set(key, (remaining.get(key) || 0) - fi.quantity);
    }
  }
  return remaining;
};

const getEffectiveFulfilledQuantityForLine = (order, line) => {
  const quantity = Number(line?.quantity) || 0;
  const explicit = Number(line?.fulfilledQuantity) || 0;
  if (explicit > 0) return Math.min(quantity, explicit);

  const lineId = String(line?._id || "");
  const fromFulfillments = (order.fulfillments || [])
    .filter((f) => f.status !== "Cancelled")
    .reduce((sum, f) => {
      return sum + (f.items || []).reduce((s, item) => {
        return String(item.orderLineId) === lineId ? s + (Number(item.quantity) || 0) : s;
      }, 0);
    }, 0);
  if (fromFulfillments > 0) return Math.min(quantity, fromFulfillments);

  // Legacy/manual orders may have no fulfillment subdocuments or per-line
  // counters even though the merchant already marked the order fulfilled.
  if (
    ["Shipped", "Delivered", "Refunded"].includes(order.status) ||
    ["Fulfilled", "Returned"].includes(String(order.fulfillmentStatus || ""))
  ) {
    return quantity;
  }

  return 0;
};

const requireOrderWrite = (permissions) => {
  if (!canWriteOrders(permissions)) {
    throw new APIError("You do not have permission to manage order fulfillment", 403);
  }
};

/**
 * Create a new fulfillment on an order. Validates that requested
 * quantities don't exceed the unfulfilled remainder per line, then
 * appends the fulfillment, bumps `fulfilledQuantity` on the affected
 * lines, and rolls up the order status.
 *
 * `items` shape: [{ orderLineId, quantity }]. Empty `items` is rejected.
 */
export const createFulfillmentService = async (
  models,
  orderId,
  payload,
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  const { items, trackingNumber, trackingCarrier, shippingCost, notes, markShipped } =
    payload || {};
  if (!Array.isArray(items) || items.length === 0) {
    throw new APIError("Fulfillment must include at least one line", 400);
  }

  return withVersionRetry(async () => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await models.Order.findOne({ _id: orderId }).session(session);
    if (!order) throw new APIError("Order not found", 404);

    // Quantity validation runs inside the retry wrapper so that if a
    // concurrent writer commits between the findOne and save, we reload
    // and recompute against fresh `computeUnfulfilledByLine` values.
    const remaining = computeUnfulfilledByLine(order);

    // Validate every requested item against the unfulfilled remainder.
    // We collect all errors first so the merchant sees the full picture
    // instead of one error at a time.
    const normalised = [];
    for (const item of items) {
      if (!item?.orderLineId || !(item.quantity > 0)) {
        throw new APIError("Each fulfillment item needs orderLineId and quantity > 0", 400);
      }
      const key = String(item.orderLineId);
      const left = remaining.get(key);
      if (left == null) {
        throw new APIError(`Order line ${item.orderLineId} not found on this order`, 400);
      }
      if (item.quantity > left) {
        throw new APIError(
          `Cannot fulfill ${item.quantity} units of line ${item.orderLineId} — only ${left} remaining`,
          400
        );
      }
      normalised.push({ orderLineId: item.orderLineId, quantity: item.quantity });
    }

    const now = new Date();
    const initialStatus = markShipped ? "Shipped" : "Pending";
    const fulfillment = {
      status: initialStatus,
      items: normalised,
      trackingNumber: trackingNumber || undefined,
      trackingCarrier: trackingCarrier || undefined,
      shippingCost: shippingCost ?? undefined,
      notes: notes || undefined,
      shippedAt: markShipped ? now : undefined,
      history: [
        {
          event: "created",
          status: initialStatus,
          note:
            initialStatus === "Shipped"
              ? `Shipment created and marked as shipped${trackingNumber ? ` (${trackingNumber})` : ""}`
              : "Shipment created and awaiting dispatch",
          by: userId || null,
          at: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    order.fulfillments.push(fulfillment);

    // Apply fulfilledQuantity bumps to the order lines.
    for (const fi of normalised) {
      const line = order.products.id(fi.orderLineId);
      if (line) line.fulfilledQuantity = (line.fulfilledQuantity || 0) + fi.quantity;
    }

    // Add an order-level history entry so the main timeline shows the
    // fulfillment alongside status changes etc.
    order.history.push({
      event: "fulfillment_created",
      note:
        initialStatus === "Shipped"
          ? `Shipment dispatched${trackingNumber ? ` with tracking ${trackingNumber}` : ""}`
          : "Shipment created and awaiting dispatch",
      by: userId || null,
      at: now,
    });

    // Recompute order status now that the fulfillment exists.
    order.fulfillmentStatus = recomputeOrderFulfillmentStatus(order);
    const newStatus = recomputeOrderStatusFromFulfillments(order);
    let statusDidChange = false;
    if (newStatus !== order.status) {
      statusDidChange = true;
      const previousStatus = order.status;
      order.status = newStatus;
      order.history.push({
        event: "status_changed",
        status: newStatus,
        previousStatus,
        note: STATUS_NOTE[newStatus] || `Order is now ${newStatus.toLowerCase()}`,
        by: userId || null,
        at: now,
      });
    }
    order.updatedAt = now;

    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();

    if (statusDidChange) {
      // Re-populate user so the notifier has the customer email.
      await order.populate(tenantPopulate("user", order.tenantId, "name email"));
      const fnotify = await notifyOrderStatusChange(order, order.status);
      await recordOrderNotified(order, order.status, fnotify, { userId });
    }

    return {
      success: true,
      statusCode: 201,
      message: "Fulfillment created",
      responseObject: formatOrderForDashboard(order),
    };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
  });
};

/**
 * Update a fulfillment's status (Pending → Shipped → Delivered, or
 * Pending/Shipped → Cancelled). Rolls back `fulfilledQuantity` on the
 * order lines when cancelling so the units become re-fulfillable.
 */
export const updateFulfillmentStatusService = async (
  models,
  orderId,
  fulfillmentId,
  payload,
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  const { status, trackingNumber, trackingCarrier, note } = payload || {};
  if (!["Shipped", "Delivered", "Cancelled"].includes(status)) {
    throw new APIError("Invalid fulfillment status", 400);
  }

  return withVersionRetry(async () => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await models.Order.findOne({ _id: orderId }).session(session);
    if (!order) throw new APIError("Order not found", 404);

    const fulfillment = order.fulfillments.id(fulfillmentId);
    if (!fulfillment) throw new APIError("Fulfillment not found", 404);

    const previousStatus = fulfillment.status;
    if (previousStatus === status) {
      return {
        success: true,
        statusCode: 200,
        message: "Fulfillment already in requested status",
        responseObject: formatOrderForDashboard(order),
      };
    }

    // State machine guard — rejects illegal transitions with a clear error.
    guardTransition("fulfillment", previousStatus, status);

    const now = new Date();
    fulfillment.status = status;
    if (trackingNumber !== undefined) fulfillment.trackingNumber = trackingNumber;
    if (trackingCarrier !== undefined) fulfillment.trackingCarrier = trackingCarrier;

    if (status === "Shipped") fulfillment.shippedAt = now;
    if (status === "Delivered") fulfillment.deliveredAt = now;
    if (status === "Cancelled") {
      fulfillment.cancelledAt = now;
      // Roll back the fulfilledQuantity on the affected order lines so
      // the units are eligible for a new fulfillment.
      for (const fi of fulfillment.items || []) {
        const line = order.products.id(fi.orderLineId);
        if (line) {
          line.fulfilledQuantity = Math.max(0, (line.fulfilledQuantity || 0) - fi.quantity);
        }
      }
    }

    fulfillment.history.push({
      event: "status_changed",
      status,
      previousStatus,
      note: note || `Shipment ${status.toLowerCase()}`,
      by: userId || null,
      at: now,
    });
    fulfillment.updatedAt = now;

    order.history.push({
      event: "fulfillment_status_changed",
      note: `Shipment ${status.toLowerCase()}${trackingNumber ? ` (${trackingNumber})` : ""}`,
      by: userId || null,
      at: now,
    });

    order.fulfillmentStatus = recomputeOrderFulfillmentStatus(order);
    const newOrderStatus = recomputeOrderStatusFromFulfillments(order);
    let orderStatusDidChange = false;
    let previousOrderStatus = order.status;
    if (newOrderStatus !== order.status) {
      orderStatusDidChange = true;
      previousOrderStatus = order.status;
      order.status = newOrderStatus;
      order.history.push({
        event: "status_changed",
        status: newOrderStatus,
        previousStatus: previousOrderStatus,
        note: STATUS_NOTE[newOrderStatus] || `Order is now ${newOrderStatus.toLowerCase()}`,
        by: userId || null,
        at: now,
      });

      // COD settles on delivery — if the last fulfillment transitioning to
      // Delivered just tipped the whole order into Delivered, the cash is
      // in hand and the order should flip to Paid automatically.
      const isCodForSettle = (() => {
        const lc = (order.paymentMethod || "").toLowerCase();
        const codeLc = (order.paymentMethodCode || "").toLowerCase();
        return lc === "cod" || lc.includes("cash on delivery") || codeLc === "cod" || codeLc.includes("cash_on_delivery");
      })();
      if (
        newOrderStatus === "Delivered" &&
        isCodForSettle &&
        order.paymentStatus !== "Paid"
      ) {
        order.paymentStatus = "Paid";
        order.history.push({
          event: "payment_status_changed",
          note: "Cash on delivery collected — marked as paid",
          by: userId || null,
          at: now,
        });
        // Record the COD cash as a Payment row inside the same
        // transaction so it's visible in the transactions list and
        // counts toward the refund cap.
        if (models.Payment) {
          await models.Payment.create(
            [
              {
                tenantId: order.tenantId,
                order: order._id,
                provider: "manual",
                amount: order.totalAmount,
                currency: order.baseCurrency || "SDG",
                status: "completed",
                paymentMethod: order.paymentMethod || "cod",
                metadata: { reason: "Cash on delivery collected on delivery" },
              },
            ],
            { session }
          );
        }
      }
    }
    order.updatedAt = now;

    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();

    // Audit log — fire-and-forget post-commit.
    logStateChange(models, {
      entity: "fulfillment",
      resourceId: fulfillmentId,
      from: previousStatus,
      to: status,
      actor: userId || null,
      metadata: { orderId },
    });

    if (orderStatusDidChange) {
      logStateChange(models, {
        entity: "order",
        resourceId: orderId,
        from: previousOrderStatus,
        to: newOrderStatus,
        actor: userId || null,
        reason: "Auto-derived from fulfillment status",
      });

      // COD payment audit log — only fires when fulfillment delivery
      // triggered the COD settlement.
      if (
        newOrderStatus === "Delivered" &&
        (() => {
          const lc = (order.paymentMethod || "").toLowerCase();
          const codeLc = (order.paymentMethodCode || "").toLowerCase();
          return lc === "cod" || lc.includes("cash on delivery") || codeLc === "cod" || codeLc.includes("cash_on_delivery");
        })() &&
        order.paymentStatus === "Paid"
      ) {
        logStateChange(models, {
          entity: "payment",
          resourceId: orderId,
          from: "Not Paid",
          to: "Paid",
          actor: null,
          reason: "COD auto-settled on fulfillment delivery",
          metadata: { fulfillmentId },
        });
      }

      await order.populate(tenantPopulate("user", order.tenantId, "name email"));
      const fsNotify = await notifyOrderStatusChange(order, order.status);
      await recordOrderNotified(order, order.status, fsNotify, { userId });
    }

    return {
      success: true,
      statusCode: 200,
      message: "Fulfillment updated",
      responseObject: formatOrderForDashboard(order),
    };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
  });
};

/**
 * Read fulfillments for an order. Used by the dashboard fulfillments
 * card and the storefront tracking page (filtered for the customer).
 */
export const getFulfillmentsService = async (models, orderId, userId, permissions) => {
  const order = await getOrderRepo(models, { _id: orderId });
  if (!order) throw new APIError("Order not found", 404);

  const isOwner = order.user && order.user._id && order.user._id.toString() === userId;
  if (!canReadAllOrders(permissions) && !isOwner) {
    throw new APIError("Access denied to this order", 403);
  }

  // Return `unfulfilledByLine` as a plain object keyed by orderLineId so
  // both dashboard and storefront can do `map[lineId]` lookups directly.
  const remaining = computeUnfulfilledByLine(order);
  const unfulfilledByLine = {};
  for (const [lineId, qty] of remaining) unfulfilledByLine[lineId] = qty;

  return {
    success: true,
    statusCode: 200,
    message: "Fulfillments retrieved",
    responseObject: {
      fulfillments: order.fulfillments || [],
      unfulfilledByLine,
    },
  };
};

// ─── Replacements ──────────────────────────────────────────────────────
// Create a $0 replacement order that mirrors a subset of the original's
// lines. Used by support when re-shipping damaged / lost items rather
// than refunding. The replacement is a real order so it shows up in
// reporting, can be fulfilled normally, and keeps its own history; both
// sides are cross-linked via `replacementOf` / `replacementOrders`.
/**
 * @param {Array<{ orderLineId: string, quantity: number }>} items
 */
export const createReplacementOrderService = async (
  models,
  originalOrderId,
  { items, reason, notes },
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  if (!Array.isArray(items) || items.length === 0) {
    throw new APIError("At least one line item is required", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const original = await models.Order.findOne({ _id: originalOrderId }).session(session);
    if (!original) throw new APIError("Original order not found", 404);

    // Validate every pick against the original. Replacement quantities
    // are bounded by the original's line quantity — a merchant can't
    // send more units than the customer originally ordered.
    const replacementProducts = [];
    for (const pick of items) {
      const line = original.products.id(pick.orderLineId);
      if (!line) {
        throw new APIError(`Line ${pick.orderLineId} not found on original order`, 400);
      }
      const qty = Number(pick.quantity) || 0;
      if (qty <= 0 || qty > line.quantity) {
        throw new APIError(
          `Replacement quantity for ${line.name || "item"} must be 1–${line.quantity}`,
          400
        );
      }
      replacementProducts.push({
        product: line.product,
        name: line.name,
        sku: line.sku,
        quantity: qty,
        // Price is captured at $0 so the replacement doesn't inflate
        // revenue metrics. Totals derive from this.
        price: 0,
        variantId: line.variantId,
        variantOptions: line.variantOptions,
      });
    }

    const orderNumber = await generateOrderNumber(models);

    const now = new Date();
    const [replacement] = await models.Order.create(
      [
        {
          tenantId: original.tenantId,
          orderNumber,
          user: original.user,
          guestCustomer: original.guestCustomer,
          products: replacementProducts,
          totalAmount: 0,
          subtotal: 0,
          shippingCost: 0,
          tax: 0,
          status: "Processing",
          shippingAddress: original.shippingAddress,
          billingAddress: original.billingAddress,
          shippingMethod: original.shippingMethod,
          paymentMethod: "Replacement",
          paymentStatus: "Paid",
          replacementOf: original._id,
          notes: notes || `Replacement for ${original.orderNumber || original._id}`,
          history: [
            {
              event: "created",
              status: "Processing",
              note: `Replacement order created from ${
                original.orderNumber || original._id
              }${reason ? ` — ${reason}` : ""}`,
              by: userId || null,
              at: now,
            },
          ],
        },
      ],
      { session }
    );

    // Link back from the original order so both sides are discoverable.
    original.replacementOrders = [
      ...(original.replacementOrders || []),
      replacement._id,
    ];
    original.history.push({
      event: "replacement_created",
      note: `Replacement ${replacement.orderNumber || replacement._id} created${
        reason ? ` — ${reason}` : ""
      }`,
      by: userId || null,
      at: now,
    });
    original.updatedAt = now;
    await original.save({ session });

    await session.commitTransaction();
    await session.endSession();

    return {
      success: true,
      statusCode: 201,
      message: "Replacement order created",
      responseObject: {
        replacement: formatOrderForDashboard(replacement),
        original: formatOrderForDashboard(original),
      },
    };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// ─── Returns (RMA) ─────────────────────────────────────────────────────
// Merchant- or customer-initiated return request. Separate from refunds:
// a return tracks the physical movement of goods, a refund tracks money.
// The two intersect at the "Refunded" terminal state where the refund
// amount is recorded on the return row so reconciliation works even when
// the money moves through a different provider.

export const createReturnService = async (
  models,
  orderId,
  { items, reason, notes },
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  if (!Array.isArray(items) || items.length === 0) {
    throw new APIError("At least one line item is required", 400);
  }

  const order = await models.Order.findOne({ _id: orderId });
  if (!order) throw new APIError("Order not found", 404);

  // Validate quantities — a return can't ask for more units than the
  // customer actually received. We use the fulfilled quantity (not the
  // ordered quantity) so merchants can't refund units that were never
  // shipped — those should be cancelled instead.
  for (const pick of items) {
    const line = order.products.id(pick.orderLineId);
    if (!line) {
      throw new APIError(`Line ${pick.orderLineId} not found on order`, 400);
    }
    const qty = Number(pick.quantity) || 0;
    const maxReturnable = getEffectiveFulfilledQuantityForLine(order, line);
    if (qty <= 0 || qty > maxReturnable) {
      throw new APIError(
        `Return quantity for ${line.name || "item"} must be 1–${maxReturnable}`,
        400
      );
    }
  }

  const now = new Date();
  const returnDoc = {
    status: "Requested",
    items: items.map((i) => ({
      orderLineId: i.orderLineId,
      quantity: Number(i.quantity),
      reason: i.reason,
    })),
    reason: reason || null,
    notes: notes || null,
    createdBy: userId || null,
    createdAt: now,
    updatedAt: now,
    history: [
      {
        event: "created",
        status: "Requested",
        note: reason || "Return requested",
        by: userId || null,
        at: now,
      },
    ],
  };

  order.returns.push(returnDoc);
  order.history.push({
    event: "return_created",
    note: reason ? `Return requested — ${reason}` : "Return requested",
    by: userId || null,
    at: now,
  });
  // A newly-requested return doesn't change physical fulfillment state,
  // but we recompute so any derived filter (e.g. orders listed as
  // "returnable") stays coherent as returns accumulate on the order.
  order.fulfillmentStatus = recomputeOrderFulfillmentStatus(order);
  order.updatedAt = now;
  await order.save();

  // Audit log — fire-and-forget. The return subdoc _id is assigned by
  // Mongoose during push, so we grab it from the last element.
  const createdReturn = order.returns[order.returns.length - 1];
  logStateChange(models, {
    entity: "return",
    resourceId: createdReturn?._id || orderId,
    from: null,
    to: "Requested",
    actor: userId || null,
    reason: reason || "Return requested",
    metadata: { orderId },
  });

  try {
    emitNotification(models, order.tenantId, {
      type: "return.requested",
      severity: "info",
      title: "Return requested",
      body: `Return requested on order ${order.orderNumber}${reason ? ` — ${reason}` : ""}`,
      resourceType: "order",
      resourceId: order._id,
      permission: "orders.read",
      data: {
        orderNumber: order.orderNumber,
        returnId: String(createdReturn?._id || ""),
        reason: reason || null,
      },
    });
  } catch (err) {
    console.warn("emit return.requested failed", err?.message);
  }

  return {
    success: true,
    statusCode: 201,
    message: "Return created",
    responseObject: formatOrderForDashboard(order),
  };
};

export const updateReturnStatusService = async (
  models,
  orderId,
  returnId,
  { status, refundAmount, note },
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  return withVersionRetry(async () => {
  const order = await models.Order.findOne({ _id: orderId });
  if (!order) throw new APIError("Order not found", 404);

  const ret = order.returns.id(returnId);
  if (!ret) throw new APIError("Return not found", 404);

  // State machine guard — rejects illegal transitions with a clear error.
  guardTransition("return", ret.status, status);

  const previousStatus = ret.status;
  const now = new Date();
  ret.status = status;
  if (typeof refundAmount === "number") ret.refundAmount = refundAmount;
  ret.updatedAt = now;

  // Advance per-line return counters ONLY on entry into a terminal state,
  // and only once per return transition (guarded by previousStatus !==
  // status) so re-saving the same record won't double-count.
  if (previousStatus !== status) {
    if (status === "Received") {
      for (const pick of ret.items || []) {
        const line = order.products.id(pick.orderLineId);
        if (!line) continue;
        const qty = Number(pick.quantity) || 0;
        line.returnedQuantity = Math.min(
          (line.returnedQuantity || 0) + qty,
          getEffectiveFulfilledQuantityForLine(order, line)
        );
      }
    } else if (status === "Refunded") {
      for (const pick of ret.items || []) {
        const line = order.products.id(pick.orderLineId);
        if (!line) continue;
        const qty = Number(pick.quantity) || 0;
        line.refundedQuantity = Math.min(
          (line.refundedQuantity || 0) + qty,
          getEffectiveFulfilledQuantityForLine(order, line)
        );
      }
    }
  }
  ret.history.push({
    event: "status_changed",
    status,
    previousStatus,
    note: note || `Return ${status.toLowerCase()}`,
    by: userId || null,
    at: now,
  });

  order.history.push({
    event: "return_status_changed",
    note: `Return ${status.toLowerCase()}${
      refundAmount ? ` · $${Number(refundAmount).toFixed(2)}` : ""
    }`,
    by: userId || null,
    at: now,
  });
  order.fulfillmentStatus = recomputeOrderFulfillmentStatus(order);
  order.updatedAt = now;
  await order.save();

  // Audit log — fire-and-forget.
  logStateChange(models, {
    entity: "return",
    resourceId: returnId,
    from: previousStatus,
    to: status,
    actor: userId || null,
    metadata: {
      orderId,
      ...(typeof refundAmount === "number" ? { refundAmount } : {}),
    },
  });

  return {
    success: true,
    statusCode: 200,
    message: "Return updated",
    responseObject: formatOrderForDashboard(order),
  };
  });
};

// ── Internal notes & tags ─────────────────────────────────────────────
// Internal notes are staff-only commentary (never rendered to customers).
// Tags are free-form workflow labels. Both mutate through orders.write.
const MAX_TAG_LEN = 32;
const MAX_TAGS = 30;
const MAX_NOTE_LEN = 2000;

/**
 * Resolve the actor's display name for history/note attribution.
 * Best-effort — returns `null` on any lookup failure so the note write
 * doesn't get blocked by a transient User read.
 */
const resolveUserName = async (models, userId) => {
  if (!userId || !models?.User) return null;
  try {
    const user = await models.User
      .findById(userId)
      .select("name firstName lastName email")
      .lean();
    if (!user) return null;
    if (user.name) return user.name;
    const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return full || user.email || null;
  } catch {
    return null;
  }
};

export const addOrderNoteService = async (
  models,
  orderId,
  { body, pinned },
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  const trimmed = typeof body === "string" ? body.trim() : "";
  if (!trimmed) throw new APIError("Note body is required", 400);
  if (trimmed.length > MAX_NOTE_LEN) {
    throw new APIError(`Note body exceeds ${MAX_NOTE_LEN} characters`, 400);
  }

  const order = await models.Order.findOne({ _id: orderId });
  if (!order) throw new APIError("Order not found", 404);

  const now = new Date();
  const byName = await resolveUserName(models, userId);
  order.internalNotes.push({
    body: trimmed,
    createdBy: userId || undefined,
    createdByName: byName || undefined,
    createdAt: now,
    updatedAt: now,
    pinned: Boolean(pinned),
  });
  order.history.push({
    event: "note_added",
    note: trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed,
    by: userId || null,
    byName: byName || undefined,
    at: now,
  });
  order.updatedAt = now;
  await order.save();

  return {
    success: true,
    statusCode: 200,
    message: "Note added",
    responseObject: formatOrderForDashboard(order),
  };
};

export const deleteOrderNoteService = async (
  models,
  orderId,
  noteId,
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  const order = await models.Order.findOne({ _id: orderId });
  if (!order) throw new APIError("Order not found", 404);

  const note = order.internalNotes.id(noteId);
  if (!note || note.deletedAt) throw new APIError("Note not found", 404);

  const now = new Date();
  note.deletedAt = now;
  note.updatedAt = now;

  const byName = await resolveUserName(models, userId);
  order.history.push({
    event: "note_deleted",
    note: `Internal note deleted`,
    by: userId || null,
    byName: byName || undefined,
    at: now,
  });
  order.updatedAt = now;
  await order.save();

  return {
    success: true,
    statusCode: 200,
    message: "Note deleted",
    responseObject: formatOrderForDashboard(order),
  };
};

const sanitizeTag = (raw) => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_TAG_LEN) return { error: `Tag exceeds ${MAX_TAG_LEN} characters` };
  return { value: trimmed };
};

export const addOrderTagsService = async (
  models,
  orderId,
  tags,
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  if (!Array.isArray(tags) || tags.length === 0) {
    throw new APIError("At least one tag is required", 400);
  }

  const clean = [];
  for (const raw of tags) {
    const r = sanitizeTag(raw);
    if (!r) throw new APIError("Tag cannot be empty", 400);
    if (r.error) throw new APIError(r.error, 400);
    clean.push(r.value);
  }

  const order = await models.Order.findOne({ _id: orderId });
  if (!order) throw new APIError("Order not found", 404);

  // Case-insensitive dedupe; preserve existing casing when tag already exists.
  const existing = Array.isArray(order.tags) ? [...order.tags] : [];
  const lowerExisting = new Set(existing.map((t) => String(t).toLowerCase()));
  const added = [];
  for (const tag of clean) {
    const lc = tag.toLowerCase();
    if (lowerExisting.has(lc)) continue;
    if (added.some((t) => t.toLowerCase() === lc)) continue;
    added.push(tag);
  }

  if (existing.length + added.length > MAX_TAGS) {
    throw new APIError(`An order can have at most ${MAX_TAGS} tags`, 400);
  }

  if (added.length === 0) {
    return {
      success: true,
      statusCode: 200,
      message: "No new tags added",
      responseObject: formatOrderForDashboard(order),
    };
  }

  order.tags = [...existing, ...added];
  const now = new Date();
  const byName = await resolveUserName(models, userId);
  for (const tag of added) {
    order.history.push({
      event: "tag_added",
      note: `Tag added: ${tag}`,
      by: userId || null,
      byName: byName || undefined,
      at: now,
    });
  }
  order.updatedAt = now;
  await order.save();

  return {
    success: true,
    statusCode: 200,
    message: "Tags added",
    responseObject: formatOrderForDashboard(order),
  };
};

export const removeOrderTagService = async (
  models,
  orderId,
  tag,
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  const r = sanitizeTag(tag);
  if (!r) throw new APIError("Tag is required", 400);
  if (r.error) throw new APIError(r.error, 400);
  const target = r.value.toLowerCase();

  const order = await models.Order.findOne({ _id: orderId });
  if (!order) throw new APIError("Order not found", 404);

  const current = Array.isArray(order.tags) ? order.tags : [];
  const idx = current.findIndex((t) => String(t).toLowerCase() === target);
  if (idx === -1) throw new APIError("Tag not found on order", 404);

  const removed = current[idx];
  order.tags = current.filter((_, i) => i !== idx);

  const now = new Date();
  const byName = await resolveUserName(models, userId);
  order.history.push({
    event: "tag_removed",
    note: `Tag removed: ${removed}`,
    by: userId || null,
    byName: byName || undefined,
    at: now,
  });
  order.updatedAt = now;
  await order.save();

  return {
    success: true,
    statusCode: 200,
    message: "Tag removed",
    responseObject: formatOrderForDashboard(order),
  };
};

// ─── Payment actions ──────────────────────────────────────────────
//
// Generic dashboard entry-point for flipping an order's paymentStatus.
// Every branch routes through the payment state machine so illegal
// transitions (e.g. Voided → Paid) are rejected with a clear 400.
//
// Actions:
//   mark_paid       Not Paid / Failed / Authorized → Paid (merchant confirms)
//   mark_failed     Not Paid / Authorized → Failed
//   capture         Authorized → Paid (gateway-less capture)
//   void            Authorized → Voided
//   record_manual   Not Paid / Failed → Paid + creates a Payment row
//
// Real gateway capture/void should go through services/payment.js where
// we have access to the provider SDK; this path is for manual / COD
// / bank-transfer flows where the merchant is the source of truth.
const PAYMENT_ACTION_TARGETS = {
  mark_paid: "Paid",
  mark_failed: "Failed",
  capture: "Paid",
  void: "Voided",
  record_manual: "Paid",
};

const PAYMENT_ACTION_DEFAULT_NOTE = {
  mark_paid: "Payment marked as received by staff",
  mark_failed: "Payment marked as failed by staff",
  capture: "Authorized payment captured",
  void: "Authorized payment voided",
  record_manual: "Manual payment recorded by staff",
};

export const performPaymentAction = async (
  models,
  orderId,
  { action, note, amount, reference } = {},
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  const target = PAYMENT_ACTION_TARGETS[action];
  if (!target) {
    throw new APIError(
      `Unknown payment action "${action}". Allowed: ${Object.keys(PAYMENT_ACTION_TARGETS).join(", ")}`,
      400
    );
  }

  if (action === "record_manual") {
    if (!(typeof amount === "number" && amount > 0)) {
      throw new APIError("record_manual requires a positive amount", 400);
    }
  }

  return withVersionRetry(async () => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await models.Order.findOne({ _id: orderId }).session(session);
    if (!order) throw new APIError("Order not found", 404);

    const previousStatus = order.paymentStatus;

    // Guard the transition — throws APIError 400 on illegal moves.
    const transition = guardTransition("payment", previousStatus, target);
    if (transition.noop) {
      await session.commitTransaction();
      await session.endSession();
      return {
        success: true,
        statusCode: 200,
        message: `Payment already in ${target} state`,
        responseObject: formatOrderForDashboard(order),
      };
    }

    const now = new Date();

    // For record_manual, persist a Payment row so the refund cap and
    // the "Payments & refunds" timeline see the manual payment.
    if (action === "record_manual" && models.Payment) {
      await models.Payment.create(
        [
          {
            tenantId: order.tenantId,
            order: order._id,
            provider: "manual",
            amount,
            currency: order.baseCurrency || "SDG",
            status: "completed",
            paymentMethod: order.paymentMethod || "manual",
            metadata: {
              reference: reference || undefined,
              recordedBy: userId || null,
              note: note || undefined,
            },
          },
        ],
        { session }
      );
    }

    order.paymentStatus = target;
    order.updatedAt = now;
    order.history.push({
      event: "payment_status_changed",
      status: target,
      previousStatus,
      note: note || PAYMENT_ACTION_DEFAULT_NOTE[action],
      by: userId || null,
      at: now,
    });

    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();

    // Post-write audit trail — fire-and-forget.
    logStateChange(models, {
      entity: "payment",
      resourceId: orderId,
      from: previousStatus,
      to: target,
      actor: userId || null,
      reason: action,
    });

    return {
      success: true,
      statusCode: 200,
      message: `Payment ${action}`,
      responseObject: formatOrderForDashboard(order),
    };
  } catch (error) {
    try { await session.abortTransaction(); } catch { /* already aborted */ }
    await session.endSession();
    throw error;
  }
  });
};

// ─── Customer context (§8) ────────────────────────────────────────
//
// Sidebar card on the order details page. Rolls up lifetime stats for
// the order's buyer — works for registered users (aggregate by user id)
// and guests (aggregate by guestCustomer.email). All counts are
// tenant-scoped via the Order model (tenantScope middleware).
//
// Accessible to anyone with orders.read OR the order's owner (a customer
// viewing their own order should be able to see their own stats).
export const getCustomerContextService = async (
  models,
  orderId,
  permissions,
  userId
) => {
  const order = await models.Order.findOne({ _id: orderId })
    .select("user guestCustomer tenantId createdAt")
    .lean();
  if (!order) throw new APIError("Order not found", 404);

  // Authorization: staff with orders.read, or the owner themselves.
  const isOwner =
    userId && order.user && String(order.user) === String(userId);
  if (!canReadAllOrders(permissions) && !isOwner) {
    throw new APIError("Access denied to this order", 403);
  }

  const tenantId = order.tenantId;
  let match;
  let type;
  let customerId = null;
  let email = null;
  if (order.user) {
    type = "customer";
    customerId = String(order.user);
    match = { tenantId, user: order.user };
  } else if (order.guestCustomer?.email) {
    type = "guest";
    email = String(order.guestCustomer.email).toLowerCase();
    match = {
      tenantId,
      user: { $in: [null, undefined] },
      "guestCustomer.email": order.guestCustomer.email,
    };
  } else {
    return {
      success: true,
      statusCode: 200,
      message: "No customer context available",
      responseObject: {
        type: "guest",
        customerId: null,
        email: null,
        lifetimeOrderCount: 0,
        lifetimeSpend: 0,
        previousRefunds: 0,
        previousCancellations: 0,
        lastOrderDate: null,
        customerSince: null,
        marketingConsent: null,
      },
    };
  }

  // Pull the minimum fields for all the buyer's orders and roll them up
  // in JS — order volume per customer is low enough that this stays fast.
  const orders = await models.Order.find(match)
    .select("status paymentStatus totalAmount createdAt")
    .lean();

  const PAID_STATUSES = new Set([
    "Paid",
    "Partially Refunded",
    "Refunded",
    "Authorized",
  ]);
  const REFUNDED_STATUSES = new Set(["Refunded", "Partially Refunded"]);

  let lifetimeOrderCount = 0;
  let lifetimeSpend = 0;
  let previousRefunds = 0;
  let previousCancellations = 0;
  let lastOrderDate = null;
  let customerSince = null;

  for (const o of orders) {
    if (!customerSince || new Date(o.createdAt) < new Date(customerSince)) {
      customerSince = o.createdAt;
    }
    if (!lastOrderDate || new Date(o.createdAt) > new Date(lastOrderDate)) {
      lastOrderDate = o.createdAt;
    }
    if (o.status === "Cancelled") {
      previousCancellations += 1;
      continue;
    }
    lifetimeOrderCount += 1;
    if (PAID_STATUSES.has(o.paymentStatus)) {
      lifetimeSpend += o.totalAmount || 0;
    }
    if (REFUNDED_STATUSES.has(o.paymentStatus)) {
      previousRefunds += 1;
    }
  }

  // Enrich with the User record when we have one (marketing consent,
  // earliest createdAt as customerSince fallback).
  let marketingConsent = null;
  if (type === "customer" && models.User) {
    try {
      const user = await models.User
        .findById(order.user)
        .select("acceptsMarketing marketingConsent createdAt")
        .lean();
      if (user) {
        // Prefer `marketingConsent` if a tenant ever adds the field;
        // fall back to `acceptsMarketing` (what the current schema uses).
        if (typeof user.marketingConsent === "boolean") {
          marketingConsent = user.marketingConsent;
        } else if (typeof user.acceptsMarketing === "boolean") {
          marketingConsent = user.acceptsMarketing;
        }
        if (
          user.createdAt &&
          (!customerSince ||
            new Date(user.createdAt) < new Date(customerSince))
        ) {
          customerSince = user.createdAt;
        }
      }
    } catch {
      // Non-fatal — consent is nice-to-have, not required.
    }
  }

  return {
    success: true,
    statusCode: 200,
    message: "Customer context retrieved",
    responseObject: {
      type,
      customerId,
      email,
      lifetimeOrderCount,
      lifetimeSpend,
      previousRefunds,
      previousCancellations,
      lastOrderDate,
      customerSince,
      marketingConsent,
    },
  };
};

// ─── Address editing (§9) ─────────────────────────────────────────
//
// Replace nested shipping/billing address sub-documents wholesale. The
// edit dialog sends the full address so any field omitted from the
// payload is cleared (rather than silently preserved). Gated by
// orders.write at the route layer; no fulfillment-state blocking here
// because the spec says staff with the permission can always edit (the
// UI shows a warning banner post-fulfillment).
const ADDRESS_EDITABLE_FIELDS = [
  "firstName",
  "lastName",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "postalCode",
  "country",
  "phone",
  "deliveryInstructions",
];

const sanitiseAddressPayload = (input) => {
  if (!input || typeof input !== "object") return null;
  const out = {};
  for (const key of ADDRESS_EDITABLE_FIELDS) {
    const v = input[key];
    if (v == null) {
      out[key] = undefined;
    } else if (typeof v === "string") {
      const trimmed = v.trim();
      out[key] = trimmed.length ? trimmed : undefined;
    } else {
      out[key] = String(v);
    }
  }
  return out;
};

export const updateOrderAddressesService = async (
  models,
  orderId,
  payload,
  userId,
  permissions
) => {
  requireOrderWrite(permissions);

  const { shippingAddress, billingAddress } = payload || {};
  if (!shippingAddress && !billingAddress) {
    throw new APIError(
      "Provide shippingAddress and/or billingAddress to update",
      400
    );
  }

  const order = await models.Order.findOne({ _id: orderId });
  if (!order) throw new APIError("Order not found", 404);

  const changed = [];
  const setOps = {};
  if (shippingAddress) {
    const clean = sanitiseAddressPayload(shippingAddress);
    if (!clean) throw new APIError("Invalid shippingAddress", 400);
    setOps.shippingAddress = clean;
    changed.push("Shipping");
  }
  if (billingAddress) {
    const clean = sanitiseAddressPayload(billingAddress);
    if (!clean) throw new APIError("Invalid billingAddress", 400);
    setOps.billingAddress = clean;
    changed.push("Billing");
  }

  // Apply with `$set` so nested keys are wholly replaced rather than
  // merged with stale defaults still on the in-memory doc.
  if (setOps.shippingAddress) order.shippingAddress = setOps.shippingAddress;
  if (setOps.billingAddress) order.billingAddress = setOps.billingAddress;

  const now = new Date();
  const byName = await resolveUserName(models, userId);
  const label = `${changed.join(" & ")} address updated`;
  order.history.push({
    event: "address_edited",
    note: label,
    by: userId || null,
    byName: byName || undefined,
    at: now,
  });
  order.updatedAt = now;
  await order.save();

  return {
    success: true,
    statusCode: 200,
    message: "Addresses updated",
    responseObject: formatOrderForDashboard(order),
  };
};
