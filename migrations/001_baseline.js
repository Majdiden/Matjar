/**
 * 001_baseline
 *
 * No-op baseline migration.
 *
 * This migration exists solely so that new environments don't try to
 * retro-apply pre-migration-era schema changes. Every environment created
 * before 2026-04-18 was hand-maintained; any backfill that was required
 * by that date has either already been run as an ad-hoc script
 * (see scripts/migrate-*.js, scripts/fix-*.js) or is encoded in the
 * current Mongoose schemas.
 *
 * From here forward, any new schema evolution lands as a numbered
 * migration file and is tracked in `_migrations`.
 *
 * `up` writes a marker row (that's what the runner already does with the
 * migration record, so there's no extra work here) — the function is
 * intentionally empty.
 * `down` is likewise empty: reverting the baseline should only remove
 * the tracking row, which the runner handles.
 */

export const description = "Baseline marker — schema as of 2026-04-18";

export async function up(_db, { logger } = {}) {
  logger?.info?.("migrate: baseline applied (no schema changes)");
}

export async function down(_db, { logger } = {}) {
  logger?.info?.("migrate: baseline reverted (no schema changes)");
}
