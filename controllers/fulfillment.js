import { asyncHandler, APIError } from "../middlewares/errorHandler.js";
import {
  createFulfillmentService,
  updateFulfillmentStatusService,
} from "../services/order.js";

/**
 * Fulfillments are stored as embedded subdocuments on `Order.fulfillments`.
 * The endpoints in this file are the *global*, cross-order surface used by
 * the dashboard's Fulfillments page. Per-order CRUD lives under
 * `/orders/:id/fulfillments` and goes straight to the order service.
 *
 * The legacy `Fulfillment` collection (one doc derived from one order)
 * has been retired — it duplicated state and the user explicitly asked
 * for fulfillments to be a real, first-class feature.
 */

/**
 * Map dashboard's lowercase status taxonomy to the embedded fulfillment
 * status enum and back. Kept here so the global list page can keep using
 * its existing filter UI without churn.
 */
const STATUS_TO_DASHBOARD = {
  Pending: "pending",
  Shipped: "shipped",
  Delivered: "delivered",
  Cancelled: "cancelled",
};
const DASHBOARD_TO_STATUS = {
  pending: "Pending",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * GET /fulfillments — flatten every order's embedded fulfillments into a
 * single paginated list. Each row carries enough context (order number,
 * line summary, tracking) for the dashboard table without an extra round-
 * trip per row.
 */
export const getFulfillments = asyncHandler(async (req, res) => {
  const { orderId, status, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (orderId) filter._id = orderId;

  // We can't filter on embedded fulfillment status with a top-level
  // query because each order may carry many fulfillments — we filter in
  // memory after the fetch. To keep that bounded we still cap by page.
  const all = await req.models.Order.find(filter)
    .select("orderNumber status products fulfillments createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const flat = [];
  for (const o of all) {
    for (const f of o.fulfillments || []) {
      const dash = STATUS_TO_DASHBOARD[f.status] || "pending";
      if (status && dash !== status) continue;
      // Map line items to a name-rich shape using the order's product
      // snapshot. The fulfillment item only stores quantity and an
      // orderLineId, so we look the line up here.
      const items = (f.items || []).map((it) => {
        const line = (o.products || []).find(
          (p) => String(p._id) === String(it.orderLineId)
        );
        return {
          product: line?.product,
          name: line?.name,
          quantity: it.quantity,
        };
      });
      flat.push({
        _id: f._id,
        orderId: o._id,
        order: { _id: o._id, orderNumber: o.orderNumber },
        status: dash,
        lineItems: items,
        trackingNumber: f.trackingNumber || null,
        carrier: f.trackingCarrier || null,
        shippedAt: f.shippedAt || null,
        deliveredAt: f.deliveredAt || null,
        createdAt: f.createdAt,
      });
    }
  }

  // Sort newest first across all orders
  flat.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = flat.length;
  const pages = Math.max(1, Math.ceil(total / parseInt(limit)));
  const start = (parseInt(page) - 1) * parseInt(limit);
  const fulfillments = flat.slice(start, start + parseInt(limit));

  res.json({
    success: true,
    data: {
      fulfillments,
      pagination: { total, page: parseInt(page), pages, limit: parseInt(limit) },
    },
  });
});

/**
 * POST /fulfillments — create a fulfillment on an order. Body must
 * include `orderId` plus the new-service payload (items + tracking).
 * Wraps `createFulfillmentService` so the global endpoint shares the
 * same validation and order-status rollup as the per-order route.
 */
export const createFulfillment = asyncHandler(async (req, res) => {
  const { orderId, ...payload } = req.body || {};
  if (!orderId) throw new APIError("orderId is required", 400);
  const result = await createFulfillmentService(
    req.models,
    orderId,
    payload,
    req.user.userId,
    req.user.roles
  );
  res.status(result.statusCode).json(result);
});

/**
 * PATCH /fulfillments/:id/status — global-list status update. The dashboard
 * passes the embedded fulfillment id but not the order id, so we resolve
 * the parent order with a containment query before delegating.
 */
export const updateFulfillment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, trackingNumber, carrier } = req.body || {};

  const parent = await req.models.Order.findOne({ "fulfillments._id": id }).select("_id");
  if (!parent) throw new APIError("Fulfillment not found", 404);

  const result = await updateFulfillmentStatusService(
    req.models,
    parent._id,
    id,
    {
      status: DASHBOARD_TO_STATUS[status] || status,
      trackingNumber,
      trackingCarrier: carrier,
    },
    req.user.userId,
    req.user.roles
  );
  res.status(result.statusCode).json(result);
});
