import { asyncHandler, APIError } from "../middlewares/errorHandler.js";
import {
  createFulfillmentService,
  getGlobalFulfillmentsService,
  updateGlobalFulfillmentStatusService,
} from "../services/order.js";
import { getEffectivePermissions } from "../middlewares/authorize.js";
import { logAudit } from "../utils/audit.js";

/**
 * Fulfillments are stored as embedded subdocuments on `Order.fulfillments`.
 * The endpoints in this file are the *global*, cross-order surface used by
 * the dashboard's Fulfillments page. Per-order CRUD lives under
 * `/orders/:id/fulfillments` and goes straight to the order service.
 *
 * The legacy `Fulfillment` collection (one doc derived from one order)
 * has been retired — it duplicated state and the user explicitly asked
 * for fulfillments to be a real, first-class feature.
 *
 * Audit 5.5: the global list is a single DB aggregation (pagination pushed
 * into Mongo) and speaks the CANONICAL capitalized status enum. The old
 * lowercase dashboard taxonomy + in-memory flatten/slice are gone.
 */

/**
 * GET /fulfillments — one aggregation through the repository that unwinds
 * every order's embedded fulfillments into a DB-paginated list. Optional
 * `status` (canonical enum), `search` (order number / tracking) and
 * `orderId` filters.
 */
export const getFulfillments = asyncHandler(async (req, res) => {
  const { orderId, status, search, page, limit } = req.query;
  const permissions = await getEffectivePermissions(req);
  const result = await getGlobalFulfillmentsService(
    req.models,
    { orderId, status, search, page, limit },
    permissions
  );
  res.status(result.statusCode).json(result);
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
  const permissions = await getEffectivePermissions(req);
  const result = await createFulfillmentService(
    req.models,
    orderId,
    payload,
    req.user.userId,
    permissions
  );
  res.status(result.statusCode).json(result);
});

/**
 * PATCH /fulfillments/:id/status — global-list status update. The dashboard
 * passes the embedded fulfillment id but not the order id; the service
 * resolves the parent order through the repository before delegating.
 * Statuses are the canonical enum ("Shipped" | "Delivered" | "Cancelled").
 */
export const updateFulfillment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, trackingNumber, carrier } = req.body || {};
  const permissions = await getEffectivePermissions(req);
  const result = await updateGlobalFulfillmentStatusService(
    req.models,
    id,
    { status, trackingNumber, trackingCarrier: carrier },
    req.user.userId,
    permissions
  );
  if (result.success) {
    logAudit(req.models, {
      action: "fulfillment.status_updated",
      resource: "Order",
      resourceId: result.responseObject?._id,
      changes: { status: { to: status } },
      req,
    });
  }
  res.status(result.statusCode).json(result);
});
