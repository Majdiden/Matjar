/**
 * Job enqueue helpers — the thin API that controllers and services use
 * to hand work off to the worker process. Each helper:
 *
 *   - Builds a stable `jobId` where idempotency matters (setup per
 *     tenant, webhook delivery per event, domain verification per
 *     hostname). BullMQ deduplicates on jobId — re-enqueueing with
 *     the same id is a no-op until the previous job completes/fails.
 *   - Accepts a `source` tag so logs can attribute enqueues to their
 *     producer (register endpoint, cron, admin retry, webhook handler).
 *   - Keeps the payload minimal (ids, not documents) so the job can
 *     re-read fresh state when it runs — critical for retries, since
 *     a 2-hour-old snapshot would apply stale data on re-execution.
 */

import { QUEUE_NAMES, enqueue } from "./queues.js";

export async function enqueueStoreSetup(tenantId, { force = false, source = "unknown" } = {}) {
  return enqueue(
    QUEUE_NAMES.STORE_SETUP,
    "initialize",
    { tenantId: String(tenantId), force },
    {
      // One setup per tenant at a time. Re-enqueuing while a setup is
      // in-flight is a no-op; once the previous job finishes we allow
      // a fresh attempt. The `:force` suffix lets admin retries bypass
      // the lock explicitly.
      jobId: force ? `setup-${tenantId}-force-${Date.now()}` : `setup-${tenantId}`,
      _source: source,
    }
  );
}

export async function enqueueEmail({ to, subject, template, data, tenantId, source = "unknown" }) {
  if (!to || !template) throw new Error("enqueueEmail requires { to, template }");
  return enqueue(
    QUEUE_NAMES.EMAIL,
    "send",
    { to, subject, template, data: data || {}, tenantId: tenantId ? String(tenantId) : null },
    { _source: source }
  );
}

export async function enqueueWebhookDelivery({ tenantId, event, payload, targetUrl, secret, source = "unknown" }) {
  if (!targetUrl || !event) throw new Error("enqueueWebhookDelivery requires { targetUrl, event }");
  return enqueue(
    QUEUE_NAMES.WEBHOOK_DELIVERY,
    "deliver",
    { tenantId: tenantId ? String(tenantId) : null, event, payload, targetUrl, secret },
    {
      // Idempotency key so a retried producer doesn't fan out duplicate
      // deliveries to the merchant's endpoint.
      jobId: `webhook-${tenantId || "global"}-${event}-${payload?.id || Date.now()}`,
      _source: source,
    }
  );
}

/**
 * DNS propagation can take hours (some TLDs + resolvers cache for the
 * full 48h TTL), so the default 5-attempt/~80s total retry budget is
 * dramatically too short. We override it here:
 *
 *   attempts: 10
 *   backoff: exponential, base 60s → 60s, 2m, 4m, 8m, 16m, 32m, ~1h,
 *            ~2h, ~4h, ~8h = total window of roughly 8 hours before
 *            BullMQ gives up and moves the job to the failed set.
 *
 * Exponential with a 60s base is preferred over a hand-rolled fixed
 * schedule because BullMQ computes it natively (no custom backoff
 * strategy required) and the doubling pattern covers the realistic
 * propagation window without over-polling.
 */
const DOMAIN_VERIFY_OPTS = {
  attempts: 10,
  backoff: { type: "exponential", delay: 60_000 },
};

export async function enqueueDomainVerification(tenantId, domain, { source = "unknown" } = {}) {
  return enqueue(
    QUEUE_NAMES.DOMAIN_VERIFICATION,
    "verify",
    { tenantId: String(tenantId), domain },
    {
      jobId: `domain-verify-${tenantId}-${domain}`,
      ...DOMAIN_VERIFY_OPTS,
      _source: source,
    }
  );
}

export async function enqueueThemeBuild(themeSlug, { source = "unknown" } = {}) {
  return enqueue(
    QUEUE_NAMES.THEME_BUILD,
    "build",
    { themeSlug },
    { jobId: `theme-build-${themeSlug}`, _source: source }
  );
}

export async function enqueueDataSeed(tenantId, { source = "unknown" } = {}) {
  return enqueue(
    QUEUE_NAMES.DATA_SEED,
    "seed",
    { tenantId: String(tenantId) },
    { jobId: `seed-${tenantId}`, _source: source }
  );
}

export async function enqueuePaymentReconciliation(tenantId, { source = "unknown" } = {}) {
  return enqueue(
    QUEUE_NAMES.PAYMENT_RECONCILIATION,
    "reconcile",
    { tenantId: String(tenantId) },
    { jobId: `reconcile-${tenantId}-${new Date().toISOString().slice(0, 10)}`, _source: source }
  );
}

export async function enqueueTenantExport(tenantId, exportId, { source = "unknown" } = {}) {
  return enqueue(
    QUEUE_NAMES.TENANT_EXPORT,
    "export",
    { tenantId: String(tenantId), exportId: String(exportId) },
    { jobId: `export-${exportId}`, _source: source }
  );
}

/**
 * Repeatable sweep job — scans for tenants whose deletionScheduledAt
 * has passed and purges them. Scheduled once at worker boot. The
 * deterministic jobId means re-scheduling across deploys doesn't
 * fan out duplicate cron entries.
 */
export async function scheduleTenantLifecycleSweep({ cron = "*/15 * * * *", source = "boot" } = {}) {
  return enqueue(
    QUEUE_NAMES.TENANT_LIFECYCLE,
    "sweep",
    {},
    {
      jobId: "tenant-lifecycle-sweep",
      repeat: { pattern: cron },
      _source: source,
    }
  );
}

/**
 * Repeatable daily backup cron — runs at 03:00 UTC. Scheduled once at
 * worker boot. BullMQ deduplicates repeatable jobs by pattern + jobId,
 * so re-enqueueing on every restart is a no-op (not a duplicate cron).
 *
 * 03:00 UTC is off-peak for all target markets (MENA, EU, NA) — the
 * tradeoff is that Egypt (UTC+2) sees it at 05:00 local which is fine
 * for an ops job that stays well under an hour even on a multi-GB dump.
 */
export async function enqueueDailyBackupCron({ cron = "0 3 * * *", source = "boot" } = {}) {
  return enqueue(
    QUEUE_NAMES.BACKUPS,
    "run-backup",
    {},
    {
      jobId: "backups-daily",
      repeat: { pattern: cron },
      _source: source,
    }
  );
}

export { QUEUE_NAMES, closeAllQueues } from "./queues.js";
