/**
 * 004_shared_db_baseline_marker
 *
 * Historical marker for the per-tenant-DB → shared-DB cutover that the
 * platform performed pre-2026-04-18. The actual data move was done by
 * scripts/migrate-to-shared-db.js against the legacy `OLD_ADMIN_DB_URI`
 * and can NOT be re-executed on an already-migrated environment — the
 * source admin DB and tenant DBs no longer exist.
 *
 * This migration is therefore a NO-OP that exists purely so every
 * environment records, in its `_migrations` collection, that it has
 * cleared the shared-DB transition. New environments (built after the
 * cutover) satisfy the marker trivially — there was never per-tenant
 * data to move.
 *
 * Idempotent: trivially so — it writes nothing to tenant data. The
 * runner records the `_migrations` row; that IS the marker.
 *
 * Reversibility: `down()` is a no-op with a loud warning. You cannot
 * un-cut-over — the old per-tenant databases are gone.
 */

export const description =
  "Shared-DB cutover baseline marker (historical; the data move ran once via scripts/migrate-to-shared-db.js)";

export async function up(_db, { logger } = {}) {
  logger?.info?.(
    "migrate 004: shared-DB cutover baseline already applied on this environment; recording marker"
  );
}

export async function down(_db, { logger } = {}) {
  logger?.warn?.(
    "migrate 004 down: shared-DB cutover cannot be reverted — the original per-tenant databases no longer exist. No-op."
  );
}
