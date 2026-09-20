/**
 * 011_fee_event_reversal_index
 *
 * The first draft of the platform fee ledger declared a unique index on
 * (tenantId, orderId, type), which made a SECOND partial-refund reversal for
 * the same order impossible. The schema now enforces uniqueness only for
 * `commission` rows (`uniq_commission_per_order`). Drop the obsolete index
 * wherever it was auto-created. Idempotent.
 */
export const description = "Drop obsolete unique index on platformfeeevents (tenantId, orderId, type)";

export async function up(db, { logger } = {}) {
  const col = db.collection("platformfeeevents");
  const names = (await col.indexes().catch(() => [])).map((i) => i.name);
  if (names.includes("tenantId_1_orderId_1_type_1")) {
    await col.dropIndex("tenantId_1_orderId_1_type_1");
    logger?.info?.("migrate: dropped platformfeeevents.tenantId_1_orderId_1_type_1");
  } else {
    logger?.info?.("migrate: obsolete fee-event index not present (nothing to do)");
  }
}

export async function down(_db, { logger } = {}) {
  logger?.info?.("migrate: 010 down is a no-op (index intentionally not recreated)");
}
