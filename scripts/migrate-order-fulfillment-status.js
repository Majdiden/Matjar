/* =========================================================================
 * MIGRATED TO migrations/003_backfill_order_fulfillment_status.js on 2026-04-18
 * — kept for reference, do NOT run directly.
 *
 * The logic here has been ported to the tracked migration runner
 * (scripts/migrate.js). Running this script directly will bypass the
 * `_migrations` bookkeeping and can cause the tracked migration to
 * re-run or skip incorrectly on a future deploy. Use:
 *
 *     npm run migrate:status
 *     npm run migrate
 *
 * instead. This file is retained for historical context and to make
 * the origin of migration 003 traceable.
 * ========================================================================= */

import mongoose from "mongoose";
import config from "../config/index.js";
import { registerAllModels } from "../utils/initDbConnection.js";
import { recomputeOrderFulfillmentStatus } from "../services/order.js";

/**
 * Backfill `order.fulfillmentStatus` for every existing order by rolling
 * up its `fulfillments[]` and `returns[]` via the same service helper the
 * live code path uses. Idempotent — safe to re-run. Does not mutate
 * `status` or `paymentStatus`.
 *
 * Run once after deploying the PR1 schema changes:
 *   node scripts/migrate-order-fulfillment-status.js
 */
async function main() {
  console.log("Connecting to database…");
  await mongoose.connect(config.dbUri);
  registerAllModels(mongoose.connection);

  const Order = mongoose.model("Order");

  const cursor = Order.find({}).cursor();
  let scanned = 0;
  let updated = 0;

  for (let order = await cursor.next(); order != null; order = await cursor.next()) {
    scanned += 1;
    const next = recomputeOrderFulfillmentStatus(order);
    if (order.fulfillmentStatus !== next) {
      order.fulfillmentStatus = next;
      await order.save();
      updated += 1;
    }
    if (scanned % 500 === 0) {
      console.log(`  scanned=${scanned} updated=${updated}`);
    }
  }

  console.log(`Done. scanned=${scanned} updated=${updated}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
