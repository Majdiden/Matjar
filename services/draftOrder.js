import mongoose from "mongoose";
import { APIError } from "../middlewares/errorHandler.js";
import { deleteOrderWhereRepo, getOrderRepo } from "../repositories/order.js";
import {
  decrementStockRepo,
  decrementVariantStockRepo,
} from "../repositories/product.js";
import { calculateTax } from "./tax.js";
import { CALCULATION_VERSION } from "./checkout.js";
import {
  resolveOrderLine,
  computeLineAllocations,
  resolveProductImage,
  createOrderWithUniqueNumber,
  formatOrderForDashboard,
  requireOrderWrite,
} from "./order.js";
import { guardTransition } from "../utils/orderStateMachine.js";
import { logStateChange } from "../utils/auditLog.js";
import {
  notifyOrderStatusChange,
  recordOrderNotified,
  notifyMerchantNewOrder,
} from "./orderNotifications.js";
import { emit as emitNotification } from "./notification.js";

/**
 * Draft / manual order creation (audit 5.2).
 *
 * Drafts are dashboard-composed orders that do NOT go through the cart:
 * a merchant picks products (with optional per-line price overrides), a
 * customer (existing user OR guest contact), optional addresses, a
 * shipping method (configured or custom {name, price}) and an optional
 * MANUAL discount (fixed amount or percentage — deliberately NOT routed
 * through discount-code validation).
 *
 * Invariants:
 *   - Drafts never touch stock and never send notifications.
 *   - Stock is allocated and notifications fire only on "Complete order"
 *     (Draft → Pending), inside a transaction, via the same repos and
 *     notifiers as the storefront checkout path.
 *   - Drafts are excluded from every storefront-facing order query and
 *     from order stats (see services/order.js + repositories/order.js).
 *   - Hard delete is allowed only while the order is still a Draft.
 */

// Limits mirrored from services/order.js tag handling.
const MAX_TAG_LEN = 32;
const MAX_TAGS = 30;

const round2 = (n) => Math.round(n * 100) / 100;

// ─── Payload sanitisers ────────────────────────────────────────────────

const sanitizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new APIError("A draft order needs at least one line item", 400);
  }
  return items.map((raw, idx) => {
    const productId = raw?.productId || raw?.product;
    if (!productId) {
      throw new APIError(`Line ${idx + 1}: productId is required`, 400);
    }
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new APIError(`Line ${idx + 1}: quantity must be a positive integer`, 400);
    }
    let priceOverride;
    if (raw.price !== undefined && raw.price !== null && raw.price !== "") {
      priceOverride = Number(raw.price);
      if (!Number.isFinite(priceOverride) || priceOverride < 0) {
        throw new APIError(`Line ${idx + 1}: price override must be a non-negative number`, 400);
      }
    }
    return {
      productId,
      variantId: raw.variantId || undefined,
      quantity,
      priceOverride,
    };
  });
};

const sanitizeShippingMethod = (shippingMethod) => {
  if (!shippingMethod) return null;
  const name = typeof shippingMethod.name === "string" ? shippingMethod.name.trim() : "";
  const price = Number(shippingMethod.price);
  if (!name) throw new APIError("Shipping method needs a name", 400);
  if (!Number.isFinite(price) || price < 0) {
    throw new APIError("Shipping method price must be a non-negative number", 400);
  }
  return {
    id: shippingMethod.id ? String(shippingMethod.id) : undefined,
    name,
    price: round2(price),
  };
};

const sanitizeDiscount = (discount) => {
  if (!discount) return null;
  const type = discount.type;
  const value = Number(discount.value);
  if (!["amount", "percentage"].includes(type)) {
    throw new APIError('Discount type must be "amount" or "percentage"', 400);
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new APIError("Discount value must be a positive number", 400);
  }
  if (type === "percentage" && value > 100) {
    throw new APIError("Percentage discount cannot exceed 100%", 400);
  }
  return { type, value };
};

const sanitizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const clean = [];
  const seen = new Set();
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_TAG_LEN) {
      throw new APIError(`Tag exceeds ${MAX_TAG_LEN} characters`, 400);
    }
    const lc = trimmed.toLowerCase();
    if (seen.has(lc)) continue;
    seen.add(lc);
    clean.push(trimmed);
    if (clean.length >= MAX_TAGS) break;
  }
  return clean;
};

// ─── Customer resolution ───────────────────────────────────────────────
// Existing user id → snapshot from the User document (with name-splitting
// fallback, mirroring createOrderService). Guest → snapshot from the
// provided contact object. One of the two is required.
const resolveCustomer = async (models, { customerId, guestCustomer }, session) => {
  if (customerId) {
    const query = models.User
      .findById(customerId)
      .select("email firstName lastName phone name language");
    if (session) query.session(session);
    const u = await query.lean();
    if (!u) throw new APIError("Customer not found", 404);
    let firstName = u.firstName;
    let lastName = u.lastName;
    if ((!firstName || !lastName) && u.name) {
      const parts = String(u.name).trim().split(/\s+/);
      firstName = firstName || parts[0];
      lastName = lastName || parts.slice(1).join(" ") || undefined;
    }
    return {
      userId: customerId,
      language: u.language || null,
      guest: null,
      snapshot: {
        email: u.email,
        firstName,
        lastName,
        phone: u.phone,
      },
    };
  }

  const g = guestCustomer || {};
  const email = typeof g.email === "string" ? g.email.trim() : "";
  if (!email) {
    throw new APIError(
      "A customer is required: pass customerId or guestCustomer with an email",
      400
    );
  }
  const guest = {
    email,
    firstName: g.firstName || undefined,
    lastName: g.lastName || undefined,
    phone: g.phone || undefined,
  };
  return { userId: null, language: null, guest, snapshot: { ...guest } };
};

// Store-language fallback for guests / users without a language, mirroring
// createOrderService.
const resolveOrderLanguage = async (tenantId, customerLanguage) => {
  if (customerLanguage) return customerLanguage;
  try {
    const t = await mongoose.model("Tenant").findById(tenantId).select("settings.language").lean();
    return t?.settings?.language || "en";
  } catch {
    return "en";
  }
};

// ─── Pricing ───────────────────────────────────────────────────────────
// priceCheckout (services/checkout.js) accepts a synthetic line set, but
// it is coupled to rate-card shipping and discount-CODE validation — a
// draft instead carries an explicit shipping method and a manual discount.
// So we mirror its line-pricing / tax / rounding semantics exactly and
// route tax through the SAME calculateTax service it uses (audit 5.2.2).
const priceDraft = async ({ resolvedLines, shippingMethod, discount, shippingAddress, tenantId }) => {
  const pricedLines = resolvedLines.map((l) => {
    const variant = l.variant || null;
    // Variant price (when set) overrides the product price; a per-line
    // merchant override beats both (audit 5.2.1: "optional price override").
    const baseUnit =
      variant && typeof variant.price === "number" && variant.price >= 0
        ? variant.price
        : l.product.price;
    const unitPrice =
      typeof l.priceOverride === "number" && l.priceOverride >= 0
        ? l.priceOverride
        : baseUnit;
    return {
      product: l.product._id,
      name: l.product.name,
      sku: variant?.sku || l.product.sku,
      quantity: l.quantity,
      unitPrice,
      lineTotal: unitPrice * l.quantity,
      variant: variant
        ? { id: variant._id, sku: variant.sku, optionValues: variant.optionValues || [] }
        : null,
      taxClass: l.product.taxClass || "standard",
      taxExempt: !!l.product.taxExempt,
    };
  });

  const subtotal = pricedLines.reduce((sum, l) => sum + l.lineTotal, 0);

  // Manual discount — order-level, applied to the goods subtotal. NOT a
  // discount code: no usage counters, no combination validation.
  let discountAmount = 0;
  if (discount) {
    discountAmount =
      discount.type === "percentage"
        ? (subtotal * discount.value) / 100
        : Math.min(discount.value, subtotal);
    discountAmount = round2(Math.max(0, discountAmount));
  }
  const afterDiscount = Math.max(0, subtotal - discountAmount);

  const shippingCost = shippingMethod ? shippingMethod.price : 0;

  // Tax — same per-line classification path as priceCheckout: distribute
  // the discount pro-rata so the taxable amount matches post-discount
  // line totals, and let calculateTax apply class rates / shipping tax /
  // inclusive-price semantics.
  const discountFactor = subtotal > 0 ? afterDiscount / subtotal : 1;
  const linesForTax = pricedLines.map((l) => ({
    lineTotal: l.lineTotal * discountFactor,
    taxClass: l.taxClass,
    taxExempt: l.taxExempt,
  }));
  const taxResult = await calculateTax(
    { subtotal: afterDiscount, lines: linesForTax, shippingCost },
    shippingAddress || {},
    tenantId
  );
  const taxAmount = taxResult.amount || 0;

  // Total — inclusive tax is already inside afterDiscount (see
  // priceCheckout step 5) and must not be added on top.
  const totalAmount = taxResult.included
    ? round2(afterDiscount + shippingCost)
    : round2(afterDiscount + shippingCost + taxAmount);

  return {
    lines: pricedLines,
    subtotal: round2(subtotal),
    discount: discountAmount,
    shippingCost: round2(shippingCost),
    tax: round2(taxAmount),
    taxIncluded: taxResult.included || false,
    taxBreakdown: taxResult.breakdown || [],
    totalAmount,
  };
};

// Build the order.products[] snapshot array from the quote + resolved
// product docs (image, variant options, per-line allocations).
const buildOrderProducts = (quote, resolvedLines) => {
  const allocations = computeLineAllocations(quote.lines, quote.discount, quote.tax);
  return quote.lines.map((l, idx) => {
    const src = resolvedLines[idx];
    const imageUrl = src ? resolveProductImage(src.product) : undefined;
    const alloc = allocations[idx] || { discount: 0, tax: 0 };
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
        ? { variantId: l.variant.id, variantOptions: l.variant.optionValues || [] }
        : {}),
    };
  });
};

// Shared assembly for create + wholesale update: resolve customer + line
// snapshots (NO stock allocation), price the draft, and return the field
// set to persist.
const assembleDraftFields = async (models, tenantId, payload, session) => {
  const items = sanitizeItems(payload.items);
  const shippingMethod = sanitizeShippingMethod(payload.shippingMethod);
  const discount = sanitizeDiscount(payload.discount);
  const tags = sanitizeTags(payload.tags);
  const customer = await resolveCustomer(models, payload, session);

  const resolvedLines = [];
  for (const item of items) {
    // Snapshot-only resolution — drafts must NOT decrement stock or
    // reserve pre-order capacity (audit 5.2.3).
    const resolved = await resolveOrderLine(
      models,
      { productId: item.productId, variantId: item.variantId, quantity: item.quantity },
      session,
      { allocateStock: false }
    );
    resolvedLines.push({
      product: resolved.product,
      variant: resolved.variant,
      quantity: item.quantity,
      priceOverride: item.priceOverride,
    });
  }

  const quote = await priceDraft({
    resolvedLines,
    shippingMethod,
    discount,
    shippingAddress: payload.shippingAddress,
    tenantId,
  });

  const language = await resolveOrderLanguage(tenantId, customer.language);

  return {
    customer,
    quote,
    fields: {
      calculationVersion: CALCULATION_VERSION,
      user: customer.userId || undefined,
      ...(customer.guest ? { guestCustomer: customer.guest } : {}),
      language,
      customerSnapshot: customer.snapshot,
      products: buildOrderProducts(quote, resolvedLines),
      subtotal: quote.subtotal,
      discount: quote.discount,
      shippingCost: quote.shippingCost,
      ...(shippingMethod ? { shippingMethod } : {}),
      tax: quote.tax,
      taxBreakdown: quote.taxBreakdown,
      taxIncluded: quote.taxIncluded,
      totalAmount: quote.totalAmount,
      shippingAddress: payload.shippingAddress || undefined,
      billingAddress: payload.billingAddress || payload.shippingAddress || undefined,
      notes: payload.note || undefined,
      tags,
    },
  };
};

// ─── Create draft ─────────────────────────────────────────────────────

export const createDraftOrderService = async (models, tenantId, payload, userId, permissions) => {
  requireOrderWrite(permissions);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { fields } = await assembleDraftFields(models, tenantId, payload, session);

    const now = new Date();
    const order = await createOrderWithUniqueNumber(
      models,
      {
        ...fields,
        // Drafts have no payment attempt yet — the label is settled when
        // the merchant records payment after completion.
        paymentMethod: "Manual",
        status: "Draft",
        paymentStatus: "Not Paid",
        history: [
          {
            event: "created",
            status: "Draft",
            note: "draft",
            by: userId || null,
            at: now,
          },
        ],
      },
      session
    );

    await session.commitTransaction();
    await session.endSession();

    // Audit log — post-commit, fire-and-forget. NO notifications for
    // drafts (audit 5.2.3).
    logStateChange(models, {
      entity: "order",
      resourceId: order._id,
      from: null,
      to: "Draft",
      actor: userId || null,
      reason: "Draft order created from dashboard",
      metadata: { orderNumber: order.orderNumber, totalAmount: order.totalAmount },
    });

    return {
      success: true,
      statusCode: 201,
      message: "Draft order created",
      responseObject: formatOrderForDashboard(order),
    };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// ─── Edit draft (wholesale replace) ───────────────────────────────────
// PUT /orders/:id/draft — replaces lines / customer / addresses /
// shipping / discount / note / tags wholesale while the order is still a
// Draft. Guarded findOneAndUpdate so a concurrent complete/delete makes
// this a clean 409 instead of resurrecting the draft.

export const updateDraftOrderService = async (models, orderId, payload, userId, permissions) => {
  requireOrderWrite(permissions);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const existing = await models.Order.findOne({ _id: orderId }).session(session);
    if (!existing) throw new APIError("Order not found", 404);
    if (existing.status !== "Draft") {
      throw new APIError("Only draft orders can be edited", 409);
    }

    const { fields } = await assembleDraftFields(models, existing.tenantId, payload, session);

    const now = new Date();
    // `user`/`guestCustomer` are replaced wholesale — switching an
    // existing-customer draft to a guest must clear the stale user ref.
    const order = await models.Order.findOneAndUpdate(
      { _id: orderId, status: "Draft" },
      {
        $set: {
          ...fields,
          // Wholesale-replace semantics: omitted optional blocks must be
          // CLEARED, not silently preserved (Mongoose strips `undefined`
          // from $set), so coerce them to explicit nulls.
          user: fields.user || null,
          guestCustomer: fields.guestCustomer || null,
          shippingMethod: fields.shippingMethod || null,
          shippingAddress: fields.shippingAddress || null,
          billingAddress: fields.billingAddress || null,
          notes: fields.notes || null,
          updatedAt: now,
        },
        $push: {
          history: {
            event: "draft_updated",
            note: "Draft order updated",
            by: userId || null,
            at: now,
          },
        },
      },
      { new: true, runValidators: true, session }
    )
      .populate("user", "name email")
      .populate("products.product", "name price images");

    if (!order) throw new APIError("Draft is no longer editable", 409);

    await session.commitTransaction();
    await session.endSession();

    return {
      success: true,
      statusCode: 200,
      message: "Draft order updated",
      responseObject: formatOrderForDashboard(order),
    };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// ─── Complete draft (Draft → Pending) ─────────────────────────────────
// Inside one transaction: decrement stock for every line via the same
// repos the checkout path uses (an insufficient-stock error aborts the
// whole completion), flip the status, stamp history. Notifications and
// audit entries fire post-commit exactly like the create-order flow.

export const completeDraftOrderService = async (models, orderId, userId, permissions, tenantId) => {
  requireOrderWrite(permissions);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await models.Order.findOne({ _id: orderId }).session(session);
    if (!order) throw new APIError("Order not found", 404);
    if (order.status !== "Draft") {
      throw new APIError("Only draft orders can be completed", 400);
    }
    // State-machine guard (Draft → Pending is legal, but keep the single
    // source of truth involved).
    guardTransition("order", order.status, "Pending");

    if (!Array.isArray(order.products) || order.products.length === 0) {
      throw new APIError("Draft has no line items to complete", 400);
    }
    // Addresses are optional while drafting but required to complete —
    // the order becomes fulfillable from this point on.
    const ship = order.shippingAddress || {};
    if (!ship.addressLine1 && !ship.city) {
      throw new APIError("Add a shipping address before completing this draft", 400);
    }

    // Allocate stock now — atomic conditional decrements; a null result
    // means insufficient stock and fails the whole completion.
    for (const line of order.products) {
      if (line.variantId) {
        const result = await decrementVariantStockRepo(
          models,
          line.product,
          line.variantId,
          line.quantity,
          session
        );
        if (!result) {
          throw new APIError(`Insufficient stock for ${line.name || "item"}`, 400);
        }
      } else {
        const result = await decrementStockRepo(models, line.product, line.quantity, session);
        if (!result) {
          throw new APIError(`Insufficient stock for ${line.name || "item"}`, 400);
        }
      }
    }

    const now = new Date();
    // Guarded flip — if another request completed/cancelled the draft
    // between our read and this write, abort so the decrements roll back.
    const updated = await models.Order.findOneAndUpdate(
      { _id: orderId, status: "Draft" },
      {
        $set: { status: "Pending", updatedAt: now },
        $push: {
          history: {
            event: "status_changed",
            status: "Pending",
            previousStatus: "Draft",
            note: "Draft completed — order is awaiting processing",
            by: userId || null,
            at: now,
          },
        },
      },
      { new: true, runValidators: true, session }
    )
      .populate("user", "name email")
      .populate("products.product", "name price images");

    if (!updated) throw new APIError("Draft is no longer completable", 409);

    await session.commitTransaction();
    await session.endSession();

    const resolvedTenantId = tenantId || updated.tenantId;

    // Audit log — post-commit, fire-and-forget.
    logStateChange(models, {
      entity: "order",
      resourceId: orderId,
      from: "Draft",
      to: "Pending",
      actor: userId || null,
      reason: "Draft order completed",
      metadata: { orderNumber: updated.orderNumber, totalAmount: updated.totalAmount },
    });

    // Notifications — same fire-and-forget pattern as the create flow:
    // merchant new-order email + customer confirmation email + in-app.
    notifyMerchantNewOrder(updated, resolvedTenantId).catch((err) =>
      console.error("notifyMerchantNewOrder failed", err)
    );
    notifyOrderStatusChange(updated, "Pending")
      .then((r) => recordOrderNotified(updated, "Pending", r, { userId }).catch(() => {}))
      .catch((err) => console.error("draft completion customer email failed", err));

    try {
      const customerName =
        [updated.customerSnapshot?.firstName, updated.customerSnapshot?.lastName]
          .filter(Boolean)
          .join(" ") || updated.customerSnapshot?.email || "Guest";
      emitNotification(models, resolvedTenantId, {
        type: "order.created",
        severity: "success",
        title: "New order",
        body: `${updated.orderNumber} from ${customerName}`,
        resourceType: "order",
        resourceId: updated._id,
        permission: "orders.read",
        data: {
          orderNumber: updated.orderNumber,
          totalAmount: updated.totalAmount,
          currency: updated.baseCurrency || updated.presentmentCurrency,
          customerName,
        },
      });
    } catch (err) {
      console.warn("emit order.created failed", err?.message);
    }

    return {
      success: true,
      statusCode: 200,
      message: "Draft order completed",
      responseObject: formatOrderForDashboard(updated),
    };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// ─── Delete draft ─────────────────────────────────────────────────────
// Hard delete, allowed ONLY while the order is still a Draft (audit
// 5.2.6). Completed/placed orders must go through cancel/refund flows.

export const deleteDraftOrderService = async (models, orderId, userId, permissions) => {
  requireOrderWrite(permissions);

  const order = await getOrderRepo(models, { _id: orderId });
  if (!order) throw new APIError("Order not found", 404);
  if (order.status !== "Draft") {
    throw new APIError("Only draft orders can be deleted", 400);
  }

  // Guarded delete — races with a concurrent complete lose cleanly.
  const deleted = await deleteOrderWhereRepo(models, { _id: orderId, status: "Draft" });
  if (!deleted) throw new APIError("Draft is no longer deletable", 409);

  logStateChange(models, {
    entity: "order",
    resourceId: orderId,
    from: "Draft",
    to: null,
    actor: userId || null,
    reason: "Draft order deleted",
    metadata: { orderNumber: order.orderNumber },
  });

  return { success: true, statusCode: 200, message: "Draft order deleted" };
};
