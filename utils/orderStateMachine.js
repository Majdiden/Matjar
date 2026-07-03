/**
 * Order, payment, and fulfillment state machines.
 *
 * Every status transition in the system MUST go through guardTransition()
 * so illegal moves are rejected loudly. No endpoint should freely set
 * statuses — the transition graph is the contract.
 */

import { APIError } from "../middlewares/errorHandler.js";

// ─── Order status ──────────────────────────────────────────────────
//
// Draft → Pending (merchant completes a manually-composed order)
// Pending → Processing → Shipped → Delivered
//                ↘ Cancelled    ↗ Refunded
// Pending → Cancelled
//
// Cancelled and Refunded are terminal.
//
// Draft is the pre-order state for dashboard-composed orders (audit 5.2):
// no stock is allocated and no notifications fire until the draft is
// completed (Draft → Pending) or it is cancelled/deleted.
const ORDER_TRANSITIONS = {
  Draft: ["Pending", "Cancelled"],
  Pending: ["Confirmed", "Processing", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: ["Refunded", "Archived"],
  Cancelled: ["Archived"],
  Refunded: ["Archived"],
  Archived: [],
};

// ─── Payment status ───────────────────────────────────────────────
//
// Not Paid → Paid (payment succeeds)
// Not Paid → Failed (payment fails)
// Failed → Paid (retry succeeds)
// Paid → Partially Refunded → Refunded
// Paid → Refunded
// Not Paid → Paid can also happen via COD on delivery
const PAYMENT_TRANSITIONS = {
  "Not Paid": ["Authorized", "Paid", "Failed"],
  Authorized: ["Paid", "Voided", "Failed"],
  Failed: ["Authorized", "Paid"],
  Paid: ["Partially Refunded", "Refunded"],
  "Partially Refunded": ["Refunded"],
  Refunded: [],
  Voided: [],
};

// ─── Fulfillment status ───────────────────────────────────────────
// (already enforced in order.js updateFulfillmentStatusService,
//  exported here for consistency and test access)
const FULFILLMENT_TRANSITIONS = {
  Pending: ["Shipped", "Cancelled"],
  Shipped: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};

// ─── Order-level fulfillment status ───────────────────────────────
// Rolled up from fulfillments[] by recomputeOrderFulfillmentStatus.
// Stored on the order so the list view can filter/sort without loading
// every shipment.
const ORDER_FULFILLMENT_TRANSITIONS = {
  Unfulfilled: ["Partially Fulfilled", "Fulfilled", "Cancelled"],
  "Partially Fulfilled": ["Fulfilled", "Unfulfilled", "Cancelled"],
  Fulfilled: ["Returned", "Partially Fulfilled"],
  Returned: [],
  Cancelled: [],
};

// ─── Return status ────────────────────────────────────────────────
const RETURN_TRANSITIONS = {
  Requested: ["Approved", "Rejected"],
  Approved: ["Received", "Refunded"],
  Received: ["Refunded"],
  Rejected: [],
  Refunded: [],
};

/**
 * Guard a state transition. Throws APIError if the transition is illegal.
 *
 * @param {string} entity - "order" | "payment" | "fulfillment" | "return"
 * @param {string} from - Current status
 * @param {string} to - Requested status
 * @returns {{ from, to }} The validated transition (for chaining)
 */
export function guardTransition(entity, from, to) {
  const graph = TRANSITION_GRAPHS[entity];
  if (!graph) {
    throw new APIError(`Unknown state machine entity: ${entity}`, 500);
  }

  if (from === to) return { from, to, noop: true };

  const allowed = graph[from];
  if (!allowed) {
    throw new APIError(
      `Unknown ${entity} status: ${from}`,
      400
    );
  }

  if (!allowed.includes(to)) {
    throw new APIError(
      `Cannot transition ${entity} from "${from}" to "${to}". ` +
        `Allowed: ${allowed.length ? allowed.join(", ") : "(terminal state)"}`,
      400
    );
  }

  return { from, to, noop: false };
}

const TRANSITION_GRAPHS = {
  order: ORDER_TRANSITIONS,
  payment: PAYMENT_TRANSITIONS,
  fulfillment: FULFILLMENT_TRANSITIONS,
  orderFulfillment: ORDER_FULFILLMENT_TRANSITIONS,
  return: RETURN_TRANSITIONS,
};

export {
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  FULFILLMENT_TRANSITIONS,
  ORDER_FULFILLMENT_TRANSITIONS,
  RETURN_TRANSITIONS,
  TRANSITION_GRAPHS,
};
