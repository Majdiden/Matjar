/**
 * 014_restore_cleared_setup_status
 *
 * Until now the merchant dashboard's post-setup "clear status" call
 * $unset the whole `setupStatus` subdocument, so the platform console's
 * Setup card showed dashes for every store that finished setup normally.
 * The call only ever fired after status === "completed", so a live store
 * with no setupStatus.status is a completed one: restore the marker.
 * Timestamps are unknown; use createdAt for both so the card is truthful
 * about "when" only to the day the store was created.
 * Idempotent: only touches rows with no status.
 */
export const description = "Restore setupStatus.status=completed for stores whose record was cleared after setup";

export async function up(db, { logger } = {}) {
  const res = await db.collection("tenants").updateMany(
    { "setupStatus.status": { $exists: false }, deletedAt: null },
    [{ $set: { "setupStatus.status": "completed", "setupStatus.startedAt": "$createdAt", "setupStatus.completedAt": "$createdAt" } }]
  );
  logger?.info?.(`014: restored setup status on ${res.modifiedCount} tenant(s)`);
  return { modified: res.modifiedCount };
}

export async function down() {
  // The pre-migration state was "no record at all"; nothing worth restoring.
}
