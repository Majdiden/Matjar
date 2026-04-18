import {
  createOrderService,
  getOrderService,
  getOrdersService,
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
} from "../services/order.js";
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
export const getOrdersController = asyncHandler(async (req, res) => {
  const { page, limit, sort, status, search, paymentStatus, from, to } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (paymentStatus) filters.paymentStatus = paymentStatus;
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
  const options = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    sort,
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
