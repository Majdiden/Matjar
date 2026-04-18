/**
 * Backup processor.
 *
 * Invoked by the daily BullMQ repeatable cron (03:00 UTC). Delegates to
 * `services/backups.js::runBackup`, then runs the retention pruner in
 * the same job so we don't accumulate old archives.
 *
 * If BACKUP_ENABLED is not "true" the underlying service short-circuits
 * cleanly — the job completes successfully with `{ skipped: true }` so
 * the cron keeps ticking without spamming the failure queue.
 *
 * Throwing from this function triggers BullMQ's retry policy (configured
 * at the queue level). The default exponential backoff is appropriate
 * here — if mongodump or R2 is transiently unreachable a retry in a few
 * minutes is the right call; if it's still broken 5 attempts later,
 * on-call needs to see it.
 */

import logger from "../../utils/logger.js";
import { runBackup, pruneOldBackups } from "../../services/backups.js";

export async function processBackup(job) {
  const startedAt = Date.now();
  logger.info("Backup job starting", { jobId: job.id, attempt: job.attemptsMade + 1 });

  const result = await runBackup({});

  // Only prune on a successful backup — we don't want a misconfigured
  // pruner wiping archives when the upload side is broken.
  let pruneResult = null;
  if (!result?.skipped) {
    try {
      pruneResult = await pruneOldBackups({});
    } catch (err) {
      // Prune failure doesn't invalidate the backup we just took.
      logger.warn("Backup prune failed (backup itself succeeded)", { error: err.message });
    }
  }

  logger.info("Backup job finished", {
    jobId: job.id,
    durationMs: Date.now() - startedAt,
    skipped: !!result?.skipped,
    reason: result?.reason || null,
    deleted: pruneResult?.deleted?.length || 0,
  });

  return { backup: result, prune: pruneResult };
}
