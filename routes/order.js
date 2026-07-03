import { Router } from "express";
import {
  createOrderController,
  createDraftOrderController,
  updateDraftOrderController,
  completeDraftOrderController,
  deleteDraftOrderController,
  getOrderController,
  getOrdersController,
  getOrderStatsController,
  updateOrderStatusController,
  updateOrderTrackingController,
  cancelOrderController,
  getUserOrdersController,
  getFulfillmentsController,
  createFulfillmentController,
  updateFulfillmentStatusController,
  createReplacementOrderController,
  createReturnController,
  updateReturnStatusController,
  performPaymentActionController,
  addOrderNoteController,
  deleteOrderNoteController,
  addOrderTagsController,
  removeOrderTagController,
  getCustomerContextController,
  updateOrderAddressesController,
} from "../controllers/order.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { checkPlanLimit } from "../middlewares/planLimits.js";
import { createOrderSchema, updateOrderStatusSchema } from "../validations/index.js";
import { checkoutLimiter, orderLookupLimiter } from "../middlewares/rateLimiters.js";
import { idempotency } from "../middlewares/idempotency.js";

const orderRoutes = Router();
// Shared middleware instance reused across the mutating endpoints that
// accept `Idempotency-Key`. Cheap to construct; exported symbol keeps
// each endpoint's intent self-documenting.
const idem = idempotency();

// All order routes require authentication
orderRoutes.use(authenticate);

// Customer routes — checkout path throttled against quote/order spam.
orderRoutes.post("/", checkoutLimiter, checkPlanLimit("orders"), validate(createOrderSchema), createOrderController);
orderRoutes.get("/my-orders", orderLookupLimiter, getUserOrdersController);

// Order-list stats (audit 5.4.3) — MUST stay above "/:id" so the literal
// "stats" segment isn't captured as an order id.
orderRoutes.get("/stats", requirePermission("orders.read"), getOrderStatsController);

// Draft / manual orders (audit 5.2) — staff tooling, so deliberately NOT
// behind checkoutLimiter or plan limits. POST /draft sits above "/:id"
// routes so the literal segment can never be captured as an order id.
// Idempotency-Key support via the shared middleware (dashboard sends the
// header through idempotentConfig()).
orderRoutes.post("/draft", requirePermission("orders.write"), idem, createDraftOrderController);
orderRoutes.put("/:id/draft", requirePermission("orders.write"), updateDraftOrderController);
orderRoutes.post("/:id/complete", requirePermission("orders.write"), idem, completeDraftOrderController);
// Hard delete — service layer restricts it to status === "Draft".
orderRoutes.delete("/:id", requirePermission("orders.write"), deleteDraftOrderController);

orderRoutes.get("/:id", orderLookupLimiter, getOrderController);
orderRoutes.post("/:id/cancel", cancelOrderController);

// Admin/Manager routes
orderRoutes.get("/", requirePermission("orders.read"), getOrdersController);
orderRoutes.patch("/:id/status", requirePermission("orders.write"), validate(updateOrderStatusSchema), updateOrderStatusController);
orderRoutes.patch("/:id/tracking", requirePermission("orders.write"), updateOrderTrackingController);

// Manual payment-status actions (mark paid / failed, capture / void an
// authorization, record manual payment). All routed through the payment
// state machine inside services/order.js so illegal moves are rejected.
orderRoutes.post("/:id/payment/action", requirePermission("orders.write"), idem, performPaymentActionController);

// Per-order fulfillments — list is readable by the order owner (storefront
// tracking page) and managers; mutations require manager role.
orderRoutes.get("/:id/fulfillments", getFulfillmentsController);
orderRoutes.post("/:id/fulfillments", requirePermission("orders.write"), idem, createFulfillmentController);
orderRoutes.patch(
  "/:id/fulfillments/:fulfillmentId/status",
  requirePermission("orders.write"),
  updateFulfillmentStatusController
);

// Replacement orders — create a $0 duplicate of some or all lines,
// linked to the original. Manager-only.
orderRoutes.post("/:id/replacements", requirePermission("orders.write"), createReplacementOrderController);

// Returns (RMA) — create and transition return requests. Manager-only.
orderRoutes.post("/:id/returns", requirePermission("orders.write"), idem, createReturnController);
orderRoutes.patch(
  "/:id/returns/:returnId/status",
  requirePermission("orders.write"),
  updateReturnStatusController
);

// Internal notes & workflow tags — staff-only, all gated by orders.write.
orderRoutes.post("/:id/notes", requirePermission("orders.write"), addOrderNoteController);
orderRoutes.delete("/:id/notes/:noteId", requirePermission("orders.write"), deleteOrderNoteController);
orderRoutes.post("/:id/tags", requirePermission("orders.write"), addOrderTagsController);
orderRoutes.delete("/:id/tags/:tag", requirePermission("orders.write"), removeOrderTagController);

// Customer context (§8) — lifetime stats sidebar on order details.
orderRoutes.get("/:id/customer-context", requirePermission("orders.read"), getCustomerContextController);

// Address editing (§9) — shipping / billing address cards.
orderRoutes.patch("/:id/addresses", requirePermission("orders.write"), updateOrderAddressesController);

export default orderRoutes;
