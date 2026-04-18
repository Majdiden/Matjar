/**
 * Unit tests for the order state machine transition guards.
 *
 * Pure logic — no DB, no HTTP. These run fast and exhaustively cover
 * every legal and illegal transition so regressions are caught before
 * integration tests even start.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  guardTransition,
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  FULFILLMENT_TRANSITIONS,
  ORDER_FULFILLMENT_TRANSITIONS,
  RETURN_TRANSITIONS,
} from "../../utils/orderStateMachine.js";

// ─── Helpers ──────────────────────────────────────────────────────

/** Assert every entry in `allowed` succeeds and everything else throws. */
function assertGraph(entity, graph) {
  const allStatuses = Object.keys(graph);
  for (const from of allStatuses) {
    for (const to of allStatuses) {
      if (from === to) {
        // Same-state is always a noop, never an error.
        const result = guardTransition(entity, from, to);
        assert.equal(result.noop, true, `${entity}: ${from} → ${to} should be noop`);
        continue;
      }
      const isAllowed = graph[from].includes(to);
      if (isAllowed) {
        const result = guardTransition(entity, from, to);
        assert.equal(result.noop, false, `${entity}: ${from} → ${to} should succeed`);
        assert.equal(result.from, from);
        assert.equal(result.to, to);
      } else {
        assert.throws(
          () => guardTransition(entity, from, to),
          (err) => err.message.includes("Cannot transition"),
          `${entity}: ${from} → ${to} should throw`
        );
      }
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────

describe("Order state machine", () => {
  it("enforces order status transitions", () => {
    assertGraph("order", ORDER_TRANSITIONS);
  });

  it("enforces payment status transitions", () => {
    assertGraph("payment", PAYMENT_TRANSITIONS);
  });

  it("enforces fulfillment status transitions", () => {
    assertGraph("fulfillment", FULFILLMENT_TRANSITIONS);
  });

  it("enforces order-level fulfillment transitions", () => {
    assertGraph("orderFulfillment", ORDER_FULFILLMENT_TRANSITIONS);
  });

  it("enforces return status transitions", () => {
    assertGraph("return", RETURN_TRANSITIONS);
  });

  it("terminal states reject all transitions", () => {
    const terminals = [
      { entity: "order", statuses: ["Archived"] },
      { entity: "payment", statuses: ["Refunded", "Voided"] },
      { entity: "fulfillment", statuses: ["Delivered", "Cancelled"] },
      { entity: "orderFulfillment", statuses: ["Returned", "Cancelled"] },
      { entity: "return", statuses: ["Rejected", "Refunded"] },
    ];
    for (const { entity, statuses } of terminals) {
      for (const from of statuses) {
        const graph = { order: ORDER_TRANSITIONS, payment: PAYMENT_TRANSITIONS, fulfillment: FULFILLMENT_TRANSITIONS, orderFulfillment: ORDER_FULFILLMENT_TRANSITIONS, return: RETURN_TRANSITIONS }[entity];
        for (const to of Object.keys(graph)) {
          if (to === from) continue;
          assert.throws(
            () => guardTransition(entity, from, to),
            (err) => err.message.includes("terminal state") || err.message.includes("Cannot transition"),
            `${entity}: terminal ${from} → ${to} must be rejected`
          );
        }
      }
    }
  });

  it("rejects unknown entity", () => {
    assert.throws(
      () => guardTransition("widget", "A", "B"),
      (err) => err.message.includes("Unknown state machine entity")
    );
  });

  it("rejects unknown status for a known entity", () => {
    assert.throws(
      () => guardTransition("order", "Bogus", "Processing"),
      (err) => err.message.includes("Unknown order status")
    );
  });

  // Specific high-value transitions
  it("allows Pending → Processing → Shipped → Delivered", () => {
    guardTransition("order", "Pending", "Processing");
    guardTransition("order", "Processing", "Shipped");
    guardTransition("order", "Shipped", "Delivered");
  });

  it("allows cancellation from Pending and Processing only", () => {
    guardTransition("order", "Pending", "Cancelled");
    guardTransition("order", "Processing", "Cancelled");
    assert.throws(() => guardTransition("order", "Shipped", "Cancelled"));
    assert.throws(() => guardTransition("order", "Delivered", "Cancelled"));
  });

  it("allows refund only from Delivered", () => {
    guardTransition("order", "Delivered", "Refunded");
    assert.throws(() => guardTransition("order", "Pending", "Refunded"));
    assert.throws(() => guardTransition("order", "Processing", "Refunded"));
    assert.throws(() => guardTransition("order", "Shipped", "Refunded"));
  });

  it("payment: Not Paid → Paid → Partially Refunded → Refunded", () => {
    guardTransition("payment", "Not Paid", "Paid");
    guardTransition("payment", "Paid", "Partially Refunded");
    guardTransition("payment", "Partially Refunded", "Refunded");
  });

  it("payment: Failed → Paid (retry)", () => {
    guardTransition("payment", "Not Paid", "Failed");
    guardTransition("payment", "Failed", "Paid");
  });

  it("payment: Not Paid → Authorized → Paid", () => {
    guardTransition("payment", "Not Paid", "Authorized");
    guardTransition("payment", "Authorized", "Paid");
  });

  it("payment: Authorized → Voided is allowed, Voided is terminal", () => {
    guardTransition("payment", "Authorized", "Voided");
    assert.throws(() => guardTransition("payment", "Voided", "Paid"));
    assert.throws(() => guardTransition("payment", "Paid", "Voided"));
  });

  it("order: Pending → Confirmed → Processing", () => {
    guardTransition("order", "Pending", "Confirmed");
    guardTransition("order", "Confirmed", "Processing");
    guardTransition("order", "Confirmed", "Cancelled");
  });

  it("order: terminal Cancelled/Refunded/Delivered can archive; Archived is terminal", () => {
    guardTransition("order", "Delivered", "Archived");
    guardTransition("order", "Cancelled", "Archived");
    guardTransition("order", "Refunded", "Archived");
    assert.throws(() => guardTransition("order", "Archived", "Pending"));
  });

  it("orderFulfillment: Unfulfilled → Partially Fulfilled → Fulfilled → Returned", () => {
    guardTransition("orderFulfillment", "Unfulfilled", "Partially Fulfilled");
    guardTransition("orderFulfillment", "Partially Fulfilled", "Fulfilled");
    guardTransition("orderFulfillment", "Fulfilled", "Returned");
    assert.throws(() => guardTransition("orderFulfillment", "Returned", "Unfulfilled"));
  });
});
