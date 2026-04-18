/**
 * 003_backfill_order_fulfillment_status
 *
 * Backfill `order.fulfillmentStatus` for existing orders by rolling up
 * their `fulfillments[]` and `returns[]` sub-documents. Introduced when
 * the schema gained an order-level fulfillment enum decoupled from
 * `status` and `paymentStatus`.
 *
 * Ported from scripts/migrate-order-fulfillment-status.js. The original
 * imported the live `recomputeOrderFulfillmentStatus` helper; we inline
 * the same logic here so the migration is self-contained and keeps
 * working even if the service helper later changes shape.
 *
 * Idempotent:
 *   - Only sets `fulfillmentStatus` on documents where it's missing or
 *     differs from the freshly computed value. Re-running is safe and,
 *     in steady state, writes nothing.
 *
 * Reversibility:
 *   `down()` $unsets the field on every order. This is safe because
 *   the field is a computed roll-up — nothing is lost that can't be
 *   recomputed by re-running `up()`.
 */

export const description =
  "Backfill order.fulfillmentStatus from fulfillments[] / returns[] roll-up";

// --------------------------------------------------------------------------
// Inlined compute (copy of services/order.js::recomputeOrderFulfillmentStatus
// as of 2026-04-18). Intentionally duplicated — a migration should not
// follow the service through future refactors.
// --------------------------------------------------------------------------
function computeFulfillmentStatus(order) {
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
      (sum, f) => sum + (f.items || []).reduce((s, i) => s + (i.quantity || 0), 0),
      0
    );

  const refundedReturnQty = (order.returns || [])
    .filter((r) => r.status === "Refunded")
    .reduce(
      (sum, r) => sum + (r.items || []).reduce((s, i) => s + (i.quantity || 0), 0),
      0
    );
  if (refundedReturnQty >= totalQuantity && shippedOrBeyondQty >= totalQuantity) {
    return "Returned";
  }

  if (shippedOrBeyondQty <= 0) return "Unfulfilled";
  if (shippedOrBeyondQty >= totalQuantity) return "Fulfilled";
  return "Partially Fulfilled";
}

export async function up(db, { logger, session } = {}) {
  const sessionOpt = session ? { session } : undefined;

  const cursor = db.collection("orders").find({}, sessionOpt);

  let scanned = 0;
  let updated = 0;

  while (await cursor.hasNext()) {
    const order = await cursor.next();
    scanned += 1;

    const next = computeFulfillmentStatus(order);

    // Idempotent: only write when the field is actually wrong/missing.
    if (order.fulfillmentStatus !== next) {
      await db.collection("orders").updateOne(
        { _id: order._id },
        { $set: { fulfillmentStatus: next } },
        sessionOpt
      );
      updated += 1;
    }

    if (scanned % 500 === 0) {
      logger?.info?.(`migrate 003: scanned=${scanned} updated=${updated}`);
    }
  }

  logger?.info?.(`migrate 003: done — scanned=${scanned} updated=${updated}`);
}

export async function down(db, { logger, session } = {}) {
  const sessionOpt = session ? { session } : undefined;

  // Safe: fulfillmentStatus is a derived roll-up; removing it destroys
  // no authoritative data. Re-running up() repopulates it exactly.
  const result = await db.collection("orders").updateMany(
    { fulfillmentStatus: { $exists: true } },
    { $unset: { fulfillmentStatus: "" } },
    sessionOpt
  );

  logger?.info?.(`migrate 003 down: unset fulfillmentStatus on ${result.modifiedCount} order(s)`);
}
