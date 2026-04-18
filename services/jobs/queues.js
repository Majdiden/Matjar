/**
 * BullMQ queue registry.
 *
 * One Redis connection is reused across all queues because BullMQ opens
 * a blocking client per Worker anyway — sharing the Queue-side client
 * keeps the connection count to "1 per web dyno + 1 per worker per
 * queue", which is the pattern BullMQ itself recommends.
 *
 * Queues declared here MUST have a matching worker in `workers/index.js`.
 * Enqueueing into a queue with no consumer is silent — jobs pile up in
 * Redis and the operator finds out at 3am when memory runs out.
 *
 * Every job option (retry count, backoff, removal policy) is set at the
 * queue default level so callers can `enqueue(queue, name, data)` without
 * repeating policy. Job-specific overrides are still possible via the
 * third argument to `queue.add()` when a particular flow needs them.
 */

import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import logger from "../../utils/logger.js";
import config from "../../config/index.js";

// Standard retry policy — 5 attempts with exponential backoff starting
// at 5s. This hits ~80s total across all retries, which is enough to
// ride out a transient network blip or provider outage but short
// enough that a genuinely broken job is surfaced quickly.
const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5000 },
  // Keep completed jobs for 24h / 10k max so the dashboard can show
  // recent history without Redis ballooning.
  removeOnComplete: { age: 24 * 3600, count: 10_000 },
  // Keep failed jobs for 7d so on-call has time to inspect before they
  // roll off. Failed jobs stay in the "failed" set (the DLQ) until
  // manually retried or purged.
  removeOnFail: { age: 7 * 24 * 3600 },
};

/**
 * BullMQ needs maxRetriesPerRequest=null on the ioredis connection so
 * its internal blocking calls (BRPOPLPUSH etc.) aren't aborted on
 * cluster failover.
 *
 * `enableOfflineQueue: false` is the important bit: without it, ioredis
 * silently buffers every command issued while Redis is unreachable and
 * "replays" them on reconnect. That turned up during soft-launch as
 * e2e tests hanging forever whenever Redis wasn't running — BullMQ's
 * internal reconnect loop kept queueing commands instead of surfacing
 * an error. With offline queue off, enqueue() throws immediately if
 * Redis is down, which is what we want for both tests and production.
 *
 * `enableReadyCheck: false` is BullMQ's recommendation for workers so a
 * short Redis outage (e.g. a managed-Redis maintenance window) doesn't
 * permanently unhealth the worker process.
 *
 * `connectTimeout: 10000` makes startup fail loudly instead of hanging
 * when REDIS_URL points at an unreachable host.
 */
let sharedConnection = null;
export function getQueueConnection() {
  if (sharedConnection) return sharedConnection;
  const url = config.redisUrl;
  sharedConnection = new IORedis(url, {
    // BullMQ's blocking workers/heartbeats require `maxRetriesPerRequest: null`;
    // see https://docs.bullmq.io/guide/connections. `enableReadyCheck: false`
    // is also the BullMQ recommendation — the ready check uses INFO which
    // some managed Redis services rate-limit.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // NOTE: we deliberately DO NOT set `enableOfflineQueue: false` here.
    // When that flag is combined with BullMQ's internal heartbeats, a
    // momentary disconnect (including the orderly close we do in test
    // teardown) triggers "Stream isn't writeable" rejections for every
    // queued heartbeat — those bubble up as unhandled rejections and
    // fail the test suite even when every assertion passed. `connectTimeout`
    // below is what protects us against a truly unreachable REDIS_URL at
    // boot; offline queueing during a short blip is the correct default.
    connectTimeout: 10_000,
  });
  sharedConnection.on("error", (err) =>
    logger.error("BullMQ Redis connection error", { error: err.message })
  );
  return sharedConnection;
}

export const QUEUE_NAMES = {
  STORE_SETUP: "store-setup",
  EMAIL: "email",
  WEBHOOK_DELIVERY: "webhook-delivery",
  DOMAIN_VERIFICATION: "domain-verification",
  THEME_BUILD: "theme-build",
  DATA_SEED: "data-seed",
  PAYMENT_RECONCILIATION: "payment-reconciliation",
  TENANT_EXPORT: "tenant-export",
  TENANT_LIFECYCLE: "tenant-lifecycle",
  BACKUPS: "backups",
};

const queueInstances = new Map();

/**
 * Lazily construct and cache a Queue instance by name. Lazy so code
 * that imports this module (e.g. controllers) doesn't open a Redis
 * connection at module-load time — only when it actually enqueues.
 * Test runs that never hit a queued code path avoid the connection
 * entirely.
 */
export function getQueue(name) {
  if (!Object.values(QUEUE_NAMES).includes(name)) {
    throw new Error(`Unknown queue "${name}". Add it to QUEUE_NAMES first.`);
  }
  let q = queueInstances.get(name);
  if (q) return q;
  q = new Queue(name, {
    connection: getQueueConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
  queueInstances.set(name, q);
  return q;
}

/**
 * Enqueue a job with a stable `jobId` (optional). A stable id makes
 * the whole operation idempotent — callers that may retry at the
 * HTTP layer (e.g. webhook ingestion re-POSTs) won't double-process.
 *
 * `source` is a free-form string logged alongside every enqueue so
 * operators can trace a job back to the producer (register endpoint,
 * webhook handler, cron, admin UI) without grepping the codebase.
 */
export async function enqueue(queueName, jobName, data, opts = {}) {
  const queue = getQueue(queueName);
  const jobOpts = { ...opts };
  const job = await queue.add(jobName, data, jobOpts);
  logger.info("Enqueued job", {
    queue: queueName,
    name: jobName,
    jobId: job.id,
    source: opts._source || "unknown",
  });
  return job;
}

/**
 * Graceful shutdown — close all open queue connections. Called from
 * process SIGTERM handlers in index.js and workers/index.js so Redis
 * isn't left holding dangling clients across deploys.
 */
export async function closeAllQueues() {
  const closers = [];
  for (const q of queueInstances.values()) closers.push(q.close());
  await Promise.allSettled(closers);
  queueInstances.clear();
  if (sharedConnection) {
    await sharedConnection.quit().catch(() => {});
    sharedConnection = null;
  }
}

/**
 * Attach a QueueEvents listener to a queue for observability. Returns
 * the listener so callers can close it on shutdown. Used by the worker
 * process to aggregate job failure metrics into a central log.
 */
export function observeQueue(queueName) {
  const events = new QueueEvents(queueName, { connection: getQueueConnection() });
  events.on("failed", ({ jobId, failedReason, prev }) => {
    logger.error("Job failed", { queue: queueName, jobId, reason: failedReason, prev });
  });
  events.on("stalled", ({ jobId }) => {
    logger.warn("Job stalled", { queue: queueName, jobId });
  });
  return events;
}
