import {
  createOrderService,
  getOrderService,
  getOrdersService,
  getOrderStatsService,
  updateOrderStatusService,
  updateOrderTrackingService,
  cancelOrderService,
  getUserOrdersService,
  createFulfillmentService,
  updateFulfillmentStatusService,
  getFulfillmentsService,
  createReplacementOrderService,
  createReturnService,
  updateReturnStatusService,
  performPaymentAction,
  addOrderNoteService,
  deleteOrderNoteService,
  addOrderTagsService,
  removeOrderTagService,
  getCustomerContextService,
  updateOrderAddressesService,
  getOrdersExportCursorService,
  resendOrderNotificationService,
  editOrderLinesService,
} from "../services/order.js";
import {
  createDraftOrderService,
  updateDraftOrderService,
  completeDraftOrderService,
  deleteDraftOrderService,
} from "../services/draftOrder.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { logAudit } from "../utils/audit.js";
import { signOrderAccessToken } from "../utils/misc.js";
import { getEffectivePermissions } from "../middlewares/authorize.js";

/**
 * Create order from cart
 */
export const createOrderController = asyncHandler(async (req, res) => {
  const result = await createOrderService(
    req.models,
    req.user.userId,
    req.body,
    req.tenantId
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.created",
      resource: "Order",
      resourceId: result.responseObject?.order?._id,
      metadata: { total: result.responseObject?.order?.total },
      req,
    });

    // Mint a per-order tracking token and return it alongside the
    // order. For guests, this token is the ONLY way to open the
    // storefront tracking page — raw email is no longer sufficient.
    // Logged-in customers don't technically need it (cookie/JWT owns
    // the auth path) but we still surface it so the confirmation
    // page and emails can build a shareable tracking URL uniformly.
    const order = result.responseObject?.order;
    if (order && order._id) {
      const email =
        order.guestCustomer?.email ||
        order.user?.email ||
        req.body?.email ||
        "";
      result.responseObject.trackingToken = signOrderAccessToken({
        tenantId: req.tenantId,
        orderId: order._id,
        email,
      });
    }
  }
  res.status(result.statusCode).json(result);
});

// ─── Draft / manual orders (audit 5.2) ────────────────────────────
// Admin-composed orders that skip the cart. All four endpoints require
// orders.write (enforced at the route AND in the service layer) and are
// NOT behind checkoutLimiter / plan limits — they're staff tooling, not
// shopper endpoints.

/**
 * Create a draft order (no stock allocation, no notifications).
 */
export const createDraftOrderController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await createDraftOrderService(
    req.models,
    req.tenantId,
    req.body,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.draft_created",
      resource: "Order",
      resourceId: result.responseObject?._id,
      metadata: {
        orderNumber: result.responseObject?.orderNumber,
        total: result.responseObject?.totalAmount,
      },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Wholesale-edit a draft (lines / customer / addresses / shipping /
 * discount / note / tags) while the order is still a Draft.
 */
export const updateDraftOrderController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await updateDraftOrderService(
    req.models,
    req.params.id,
    req.body,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.draft_updated",
      resource: "Order",
      resourceId: req.params.id,
      metadata: { total: result.responseObject?.totalAmount },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Complete a draft (Draft → Pending): decrements stock in a transaction
 * and fires the merchant/customer notifications of the create flow.
 */
export const completeDraftOrderController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await completeDraftOrderService(
    req.models,
    req.params.id,
    req.user.userId,
    permissions,
    req.tenantId
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.draft_completed",
      resource: "Order",
      resourceId: req.params.id,
      changes: { status: { from: "Draft", to: "Pending" } },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Hard-delete a draft. Allowed only while status === "Draft".
 */
export const deleteDraftOrderController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await deleteDraftOrderService(
    req.models,
    req.params.id,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.draft_deleted",
      resource: "Order",
      resourceId: req.params.id,
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Get order by ID
 */
export const getOrderController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await getOrderService(
    req.models,
    req.params.id,
    req.user.userId,
    permissions
  );
  res.status(result.statusCode).json(result);
});

/**
 * Get all orders (filtered)
 */
// Sort keys the list endpoint accepts (audit 5.4.2). Anything else is
// dropped so callers can't sort on unindexed/internal fields; the
// repository then falls back to its "-createdAt" default.
const ORDER_SORT_WHITELIST = new Set([
  "createdAt",
  "-createdAt",
  "totalAmount",
  "-totalAmount",
]);

// Shared query-string → Mongo filter mapping for the order list and the
// stats endpoint (audit 5.4) so both always agree on what "the current
// filter window" means.
const buildOrderListFilters = (query) => {
  const { status, search, paymentStatus, fulfillmentStatus, tag, from, to } = query;
  const filters = {};
  if (status) filters.status = status;
  if (paymentStatus) filters.paymentStatus = paymentStatus;
  if (fulfillmentStatus) filters.fulfillmentStatus = fulfillmentStatus;
  // `tags` is a string array — a plain equality match means "array contains".
  if (tag) filters.tags = String(tag).trim();
  if (from || to) {
    filters.createdAt = {};
    if (from) filters.createdAt.$gte = new Date(from);
    if (to) filters.createdAt.$lte = new Date(to);
  }
  if (search) {
    const raw = String(search).trim();
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/^#+/, "");
    const rx = new RegExp(escaped, "i");
    filters.$or = [
      { orderNumber: rx },
      { "shippingAddress.firstName": rx },
      { "shippingAddress.lastName": rx },
      { "shippingAddress.email": rx },
      { "shippingAddress.phone": rx },
    ];
  }
  return filters;
};

export const getOrdersController = asyncHandler(async (req, res) => {
  const { page, limit, sort } = req.query;
  const filters = buildOrderListFilters(req.query);
  const options = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    sort: ORDER_SORT_WHITELIST.has(sort) ? sort : undefined,
  };

  const permissions = await getEffectivePermissions(req);
  const result = await getOrdersService(
    req.models,
    filters,
    options,
    req.user.userId,
    permissions
  );
  res.status(result.statusCode).json(result);
});

/**
 * Order-list stats (audit 5.4.3) — single aggregation, admin/staff only.
 * Accepts the same filter query params as the list endpoint; the 30-day
 * comparison figures ignore filters (fixed rolling windows).
 */
export const getOrderStatsController = asyncHandler(async (req, res) => {
  const filters = buildOrderListFilters(req.query);
  const permissions = await getEffectivePermissions(req);
  const result = await getOrderStatsService(req.models, filters, permissions);
  res.status(result.statusCode).json(result);
});

// ─── Server-side CSV export (audit 5.6.2) ─────────────────────────────
// Streams a cursor over the filtered order list as CSV — same 11+ columns
// the client full-export builds, same list filters, no limit:5000 ceiling.
// Route registered before "/:id" so "export.csv" isn't captured as an id.
const CSV_SORT_WHITELIST = new Set(["createdAt", "-createdAt", "totalAmount", "-totalAmount"]);

const csvCell = (value) => {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const EXPORT_COLUMNS = [
  { label: "Order #", get: (o) => o.orderNumber || "" },
  { label: "Date", get: (o) => (o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : "") },
  {
    label: "Customer",
    get: (o) =>
      o.user?.name ||
      [o.customerSnapshot?.firstName, o.customerSnapshot?.lastName].filter(Boolean).join(" ") ||
      [o.guestCustomer?.firstName, o.guestCustomer?.lastName].filter(Boolean).join(" ") ||
      "Guest",
  },
  {
    label: "Email",
    get: (o) => o.user?.email || o.customerSnapshot?.email || o.guestCustomer?.email || "",
  },
  { label: "Status", get: (o) => o.status || "" },
  { label: "Payment status", get: (o) => o.paymentStatus || "" },
  { label: "Payment method", get: (o) => o.paymentMethod || "" },
  {
    label: "Items",
    get: (o) => (o.products || []).reduce((s, p) => s + (Number(p.quantity) || 0), 0),
  },
  { label: "Subtotal", get: (o) => (o.subtotal ?? 0).toFixed(2) },
  { label: "Shipping", get: (o) => (o.shippingCost ?? 0).toFixed(2) },
  { label: "Tax", get: (o) => (o.tax ?? 0).toFixed(2) },
  { label: "Discount", get: (o) => (o.discount ?? 0).toFixed(2) },
  { label: "Total", get: (o) => (o.totalAmount ?? 0).toFixed(2) },
];

export const exportOrdersCsvController = asyncHandler(async (req, res) => {
  const filters = buildOrderListFilters(req.query);
  const sort = CSV_SORT_WHITELIST.has(req.query.sort) ? req.query.sort : "-createdAt";
  const permissions = await getEffectivePermissions(req);

  const cursor = getOrdersExportCursorService(req.models, filters, sort, permissions);

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="orders-${date}.csv"`);

  // BOM so Excel opens UTF-8 (Arabic customer names) correctly.
  res.write("﻿");
  res.write(EXPORT_COLUMNS.map((c) => csvCell(c.label)).join(",") + "\n");

  try {
    for await (const order of cursor) {
      res.write(EXPORT_COLUMNS.map((c) => csvCell(c.get(order))).join(",") + "\n");
    }
    res.end();
  } catch (err) {
    // Header/first chunk already sent — can't switch to a JSON error, so
    // close the stream and let the client surface a truncated-download error.
    try { await cursor.close(); } catch { /* already closed */ }
    res.end();
    throw err;
  }
});

/**
 * Resend a customer order notification (audit 5.6.1). Body: { template }.
 * Audit-logged. orders.write.
 */
export const resendOrderNotificationController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await resendOrderNotificationService(
    req.models,
    req.params.id,
    req.body?.template,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.notification_resent",
      resource: "Order",
      resourceId: req.params.id,
      metadata: { template: result.responseObject?.template, to: result.responseObject?.to },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Scoped order line editing (audit 5.3). PUT /orders/:id/lines with
 * { items: [{ productId, variantId?, quantity, price? }] }. orders.write.
 * Guarded server-side to unpaid + unfulfilled + Pending/Confirmed only.
 */
export const editOrderLinesController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await editOrderLinesService(
    req.models,
    req.params.id,
    req.body,
    req.user.userId,
    permissions,
    req.tenantId
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.lines_edited",
      resource: "Order",
      resourceId: req.params.id,
      metadata: { total: result.responseObject?.totalAmount },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Update order status
 */
export const updateOrderStatusController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await updateOrderStatusService(
    req.models,
    req.params.id,
    req.body.status,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.status_updated",
      resource: "Order",
      resourceId: req.params.id,
      changes: { status: { to: req.body.status } },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Update order tracking number / carrier
 */
export const updateOrderTrackingController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await updateOrderTrackingService(
    req.models,
    req.params.id,
    { trackingNumber: req.body.trackingNumber, trackingCarrier: req.body.trackingCarrier },
    req.user.userId,
    permissions
  );
  res.status(result.statusCode).json(result);
});

/**
 * Cancel order
 */
export const cancelOrderController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await cancelOrderService(
    req.models,
    req.params.id,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.cancelled",
      resource: "Order",
      resourceId: req.params.id,
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Get user's order history
 */
export const getUserOrdersController = asyncHandler(async (req, res) => {
  const { page, limit, sort } = req.query;
  const options = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    sort,
  };

  const result = await getUserOrdersService(
    req.models,
    req.user.userId,
    options
  );
  res.status(result.statusCode).json(result);
});

/**
 * List fulfillments + unfulfilled remainders for an order. Used by both
 * the dashboard fulfillments card and the storefront tracking page.
 */
export const getFulfillmentsController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await getFulfillmentsService(
    req.models,
    req.params.id,
    req.user.userId,
    permissions
  );
  res.status(result.statusCode).json(result);
});

/**
 * Create a new shipment on an order. Body shape:
 *   { items: [{ orderLineId, quantity }],
 *     trackingNumber?, trackingCarrier?, shippingCost?, notes?, markShipped? }
 */
export const createFulfillmentController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await createFulfillmentService(
    req.models,
    req.params.id,
    req.body,
    req.user.userId,
    permissions
  );
  res.status(result.statusCode).json(result);
});

/**
 * Update a fulfillment's status (Shipped / Delivered / Cancelled).
 */
export const updateFulfillmentStatusController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await updateFulfillmentStatusService(
    req.models,
    req.params.id,
    req.params.fulfillmentId,
    req.body,
    req.user.userId,
    permissions
  );
  res.status(result.statusCode).json(result);
});

/**
 * Create a replacement order from a subset of an existing order's lines.
 * The replacement is a $0 order that can be fulfilled normally.
 */
export const createReplacementOrderController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await createReplacementOrderService(
    req.models,
    req.params.id,
    req.body,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.replacement_created",
      resource: "Order",
      resourceId: req.params.id,
      metadata: { replacementId: result.responseObject?.replacement?._id },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Create a return (RMA) on an order.
 */
export const createReturnController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await createReturnService(
    req.models,
    req.params.id,
    req.body,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.return_created",
      resource: "Order",
      resourceId: req.params.id,
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Update a return's status (Approved / Rejected / Received / Refunded).
 */
/**
 * Perform a manual payment-status action on an order (mark paid / failed,
 * capture / void an authorization, record a manual payment). Guarded by
 * the payment state machine inside the service.
 */
export const performPaymentActionController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const { action, note, amount, reference } = req.body || {};
  const result = await performPaymentAction(
    req.models,
    req.params.id,
    { action, note, amount, reference },
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: `payment.${action}`,
      resource: "Order",
      resourceId: req.params.id,
      metadata: {
        amount: typeof amount === "number" ? amount : undefined,
        reference: reference || undefined,
      },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

export const updateReturnStatusController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await updateReturnStatusService(
    req.models,
    req.params.id,
    req.params.returnId,
    req.body,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.return_status_updated",
      resource: "Order",
      resourceId: req.params.id,
      changes: { status: { to: req.body.status } },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Add an internal (staff-only) note to an order.
 */
export const addOrderNoteController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await addOrderNoteService(
    req.models,
    req.params.id,
    { body: req.body?.body, pinned: req.body?.pinned },
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.note_added",
      resource: "Order",
      resourceId: req.params.id,
      metadata: { pinned: Boolean(req.body?.pinned) },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Soft-delete an internal note on an order.
 */
export const deleteOrderNoteController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await deleteOrderNoteService(
    req.models,
    req.params.id,
    req.params.noteId,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.note_deleted",
      resource: "Order",
      resourceId: req.params.id,
      metadata: { noteId: req.params.noteId },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Append one or more workflow tags to an order.
 */
export const addOrderTagsController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags
    : req.body?.tag
    ? [req.body.tag]
    : [];
  const result = await addOrderTagsService(
    req.models,
    req.params.id,
    tags,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.tags_added",
      resource: "Order",
      resourceId: req.params.id,
      metadata: { tags },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Remove a single tag from an order.
 */
export const removeOrderTagController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const tag = decodeURIComponent(req.params.tag || "");
  const result = await removeOrderTagService(
    req.models,
    req.params.id,
    tag,
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.tag_removed",
      resource: "Order",
      resourceId: req.params.id,
      metadata: { tag },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

/**
 * Customer context card — lifetime stats + consent for the buyer on
 * this order. Readable by staff with orders.read and by the owner
 * themselves (service enforces).
 */
export const getCustomerContextController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await getCustomerContextService(
    req.models,
    req.params.id,
    permissions,
    req.user.userId
  );
  res.status(result.statusCode).json(result);
});

/**
 * Edit shipping/billing addresses. Permission-gated only — no
 * fulfillment-state blocking; UI surfaces a warning post-fulfillment.
 */
export const updateOrderAddressesController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const result = await updateOrderAddressesService(
    req.models,
    req.params.id,
    {
      shippingAddress: req.body?.shippingAddress,
      billingAddress: req.body?.billingAddress,
    },
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "order.address_edited",
      resource: "Order",
      resourceId: req.params.id,
      metadata: {
        shipping: Boolean(req.body?.shippingAddress),
        billing: Boolean(req.body?.billingAddress),
      },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});
