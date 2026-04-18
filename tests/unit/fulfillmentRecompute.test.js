/**
 * Pure-logic tests for the partial-fulfillment status machine.
 *
 * Exercises `recomputeOrderStatusFromFulfillments` and
 * `computeUnfulfilledByLine` — the two pieces the real fulfillment
 * service drops through on every create/update. Keeping these isolated
 * means we can prove the partial→shipped→delivered ramp works without
 * booting Mongo.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  recomputeOrderStatusFromFulfillments,
  recomputeOrderFulfillmentStatus,
  computeUnfulfilledByLine,
} from "../../services/order.js";

const mkOrder = (overrides = {}) => ({
  status: "Pending",
  products: [
    { _id: "l1", quantity: 3 },
    { _id: "l2", quantity: 2 },
  ],
  fulfillments: [],
  ...overrides,
});

describe("recomputeOrderStatusFromFulfillments", () => {
  it("no fulfillments → Pending", () => {
    assert.equal(recomputeOrderStatusFromFulfillments(mkOrder()), "Pending");
  });

  it("any live fulfillment → Processing", () => {
    const o = mkOrder({
      fulfillments: [{ status: "Processing", items: [{ orderLineId: "l1", quantity: 1 }] }],
    });
    assert.equal(recomputeOrderStatusFromFulfillments(o), "Processing");
  });

  it("shipped qty < total → still Processing (partial)", () => {
    const o = mkOrder({
      fulfillments: [{ status: "Shipped", items: [{ orderLineId: "l1", quantity: 2 }] }],
    });
    assert.equal(recomputeOrderStatusFromFulfillments(o), "Processing");
  });

  it("shipped qty covers all lines → Shipped", () => {
    const o = mkOrder({
      fulfillments: [
        { status: "Shipped", items: [{ orderLineId: "l1", quantity: 3 }, { orderLineId: "l2", quantity: 2 }] },
      ],
    });
    assert.equal(recomputeOrderStatusFromFulfillments(o), "Shipped");
  });

  it("delivered covers all lines → Delivered", () => {
    const o = mkOrder({
      fulfillments: [
        { status: "Delivered", items: [{ orderLineId: "l1", quantity: 3 }, { orderLineId: "l2", quantity: 2 }] },
      ],
    });
    assert.equal(recomputeOrderStatusFromFulfillments(o), "Delivered");
  });

  it("cancelled fulfillment doesn't count toward shipped total", () => {
    const o = mkOrder({
      fulfillments: [
        { status: "Cancelled", items: [{ orderLineId: "l1", quantity: 3 }, { orderLineId: "l2", quantity: 2 }] },
      ],
    });
    assert.equal(recomputeOrderStatusFromFulfillments(o), "Pending");
  });

  it("Cancelled order remains Cancelled regardless", () => {
    const o = mkOrder({
      status: "Cancelled",
      fulfillments: [
        { status: "Delivered", items: [{ orderLineId: "l1", quantity: 3 }, { orderLineId: "l2", quantity: 2 }] },
      ],
    });
    assert.equal(recomputeOrderStatusFromFulfillments(o), "Cancelled");
  });

  it("partially shipped + partially delivered → Shipped only if union covers all", () => {
    const o = mkOrder({
      fulfillments: [
        { status: "Shipped", items: [{ orderLineId: "l1", quantity: 3 }] },
        { status: "Delivered", items: [{ orderLineId: "l2", quantity: 2 }] },
      ],
    });
    // 3 + 2 = 5 total; shippedOrBeyond = 5 ≥ 5 → Shipped
    assert.equal(recomputeOrderStatusFromFulfillments(o), "Shipped");
  });

  it("mixed delivered and shipped but only partial → Processing", () => {
    const o = mkOrder({
      fulfillments: [
        { status: "Delivered", items: [{ orderLineId: "l1", quantity: 1 }] },
        { status: "Shipped", items: [{ orderLineId: "l1", quantity: 1 }] },
      ],
    });
    // shippedOrBeyond = 2, total = 5 → Processing
    assert.equal(recomputeOrderStatusFromFulfillments(o), "Processing");
  });
});

describe("computeUnfulfilledByLine", () => {
  it("returns full quantity when no fulfillments", () => {
    const map = computeUnfulfilledByLine(mkOrder());
    assert.equal(map.get("l1"), 3);
    assert.equal(map.get("l2"), 2);
  });

  it("subtracts active fulfillment quantities", () => {
    const o = mkOrder({
      fulfillments: [
        { status: "Shipped", items: [{ orderLineId: "l1", quantity: 2 }] },
      ],
    });
    const map = computeUnfulfilledByLine(o);
    assert.equal(map.get("l1"), 1);
    assert.equal(map.get("l2"), 2);
  });

  it("ignores cancelled fulfillments", () => {
    const o = mkOrder({
      fulfillments: [
        { status: "Cancelled", items: [{ orderLineId: "l1", quantity: 2 }] },
        { status: "Shipped", items: [{ orderLineId: "l1", quantity: 1 }] },
      ],
    });
    assert.equal(computeUnfulfilledByLine(o).get("l1"), 2);
  });

  it("allows overdraft to show as negative (caller validates)", () => {
    const o = mkOrder({
      fulfillments: [
        { status: "Shipped", items: [{ orderLineId: "l1", quantity: 5 }] },
      ],
    });
    assert.equal(computeUnfulfilledByLine(o).get("l1"), -2);
  });
});

describe("recomputeOrderFulfillmentStatus", () => {
  const mk = (overrides = {}) => ({
    status: "Pending",
    products: [
      { _id: "l1", quantity: 3 },
      { _id: "l2", quantity: 2 },
    ],
    fulfillments: [],
    returns: [],
    ...overrides,
  });

  it("no fulfillments → Unfulfilled", () => {
    assert.equal(recomputeOrderFulfillmentStatus(mk()), "Unfulfilled");
  });

  it("partial shipped → Partially Fulfilled", () => {
    const o = mk({
      fulfillments: [{ status: "Shipped", items: [{ orderLineId: "l1", quantity: 2 }] }],
    });
    assert.equal(recomputeOrderFulfillmentStatus(o), "Partially Fulfilled");
  });

  it("all units shipped or delivered → Fulfilled", () => {
    const o = mk({
      fulfillments: [
        { status: "Shipped", items: [{ orderLineId: "l1", quantity: 3 }] },
        { status: "Delivered", items: [{ orderLineId: "l2", quantity: 2 }] },
      ],
    });
    assert.equal(recomputeOrderFulfillmentStatus(o), "Fulfilled");
  });

  it("cancelled order short-circuits to Cancelled", () => {
    const o = mk({ status: "Cancelled" });
    assert.equal(recomputeOrderFulfillmentStatus(o), "Cancelled");
  });

  it("all units shipped AND all units in refunded returns → Returned", () => {
    const o = mk({
      fulfillments: [
        { status: "Delivered", items: [{ orderLineId: "l1", quantity: 3 }] },
        { status: "Delivered", items: [{ orderLineId: "l2", quantity: 2 }] },
      ],
      returns: [
        {
          status: "Refunded",
          items: [
            { orderLineId: "l1", quantity: 3 },
            { orderLineId: "l2", quantity: 2 },
          ],
        },
      ],
    });
    assert.equal(recomputeOrderFulfillmentStatus(o), "Returned");
  });

  it("cancelled fulfillments don't count toward shipped totals", () => {
    const o = mk({
      fulfillments: [
        { status: "Cancelled", items: [{ orderLineId: "l1", quantity: 3 }, { orderLineId: "l2", quantity: 2 }] },
      ],
    });
    assert.equal(recomputeOrderFulfillmentStatus(o), "Unfulfilled");
  });
});
