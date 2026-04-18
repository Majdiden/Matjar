/**
 * Worker entry point.
 *
 * One long-lived Node process that consumes every queue declared in
 * services/jobs/queues.js. In production this runs as a separate
 * "worker" service (see render.yaml) so web dynos can be recycled for
 * deploys without draining in-flight jobs.
 *
 *   npm run worker
 *
 * Concurrency is set per-queue: CPU-bound work (theme builds) gets
 * single-threaded so two builds don't thrash; network-bound work
 * (webhooks, email) gets higher concurrency to keep throughput up.
 *
 * Shutdown: SIGTERM closes workers sequentially, waiting for in-flight
 * jobs to finish before closing the Redis connection. The platform
 * (Render/Fly) gives us up to 30s of grace; we lean on BullMQ's
 * built-in `close()` for that.
 */

import "dotenv/config";
// Sentry MUST be initialized before any other module so its instrumentation
// can wrap Mongoose / BullMQ / http at import time. Mirrors the web server's
// ordering in index.js. When SENTRY_DSN is unset this is a no-op.
import { initSentry, captureException } from "../utils/sentry.js";
initSentry();

import mongoose from "mongoose";
import { Worker } from "bullmq";
import config from "../config/index.js";
import { connectDb } from "../utils/connectionManager.js";
import { QUEUE_NAMES, getQueueConnection, closeAllQueues, observeQueue } from "../services/jobs/queues.js";
import { scheduleTenantLifecycleSweep, enqueueDailyBackupCron } from "../services/jobs/index.js";
import logger from "../utils/logger.js";

import { processStoreSetup } from "./processors/storeSetup.js";
import { processEmail } from "./processors/email.js";
import { processWebhookDelivery } from "./processors/webhook.js";
import { processDomainVerification } from "./processors/domain.js";
import { processThemeBuild } from "./processors/themeBuild.js";
import { processTenantExport } from "./processors/dataExport.js";
import { processTenantLifecycle } from "./processors/tenantLifecycle.js";
import { processBackup } from "./processors/backup.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { emit as emitNotification } from "../services/notification.js";

const PROCESSORS = [
  { queue: QUEUE_NAMES.STORE_SETUP, fn: processStoreSetup, concurrency: 4 },
  { queue: QUEUE_NAMES.EMAIL, fn: processEmail, concurrency: 20 },
  { queue: QUEUE_NAMES.WEBHOOK_DELIVERY, fn: processWebhookDelivery, concurrency: 20 },
  { queue: QUEUE_NAMES.DOMAIN_VERIFICATION, fn: processDomainVerification, concurrency: 8 },
  { queue: QUEUE_NAMES.THEME_BUILD, fn: processThemeBuild, concurrency: 1 },
  { queue: QUEUE_NAMES.TENANT_EXPORT, fn: processTenantExport, concurrency: 2 },
  { queue: QUEUE_NAMES.TENANT_LIFECYCLE, fn: processTenantLifecycle, concurrency: 1 },
  // Backups run one at a time — mongodump + a multipart upload is
  // IO/network-heavy and overlapping runs would double-upload the same
  // archive into R2.
  { queue: QUEUE_NAMES.BACKUPS, fn: processBackup, concurrency: 1 },
];

const workers = [];
const queueEventsHandles = [];

async function main() {
  // Mongo is the source of truth for every job — a worker that can't
  // read tenants/orders/etc. is worse than useless. Connect before
  // spinning up consumers.
  await connectDb();

  // Fail fast if Redis is unreachable. The shared ioredis client is
  // built with `enableOfflineQueue: false`, so a PING here either
  // succeeds or throws immediately — it will not hang retrying.
  // Without this, a misconfigured REDIS_URL produced a worker process
  // that looked "healthy" (it booted, ran scheduling, logged "Workers
  // started") but couldn't actually consume jobs.
  try {
    const conn = getQueueConnection();
    await conn.ping();
    logger.info("Worker Redis connection ready");
  } catch (err) {
    logger.error("Worker Redis unreachable — aborting startup", {
      error: err?.message,
      url: process.env.REDIS_URL ? "<configured>" : "redis://localhost:6379",
    });
    throw err;
  }

  for (const { queue, fn, concurrency } of PROCESSORS) {
    const worker = new Worker(queue, fn, {
      connection: getQueueConnection(),
      concurrency,
    });
    worker.on("completed", (job) => {
      logger.info("Job completed", { queue, jobId: job.id, name: job.name, attempt: job.attemptsMade });
    });
    worker.on("failed", async (job, err) => {
      logger.error("Job failed (worker)", {
        queue,
        jobId: job?.id,
        name: job?.name,
        attempt: job?.attemptsMade,
        maxAttempts: job?.opts?.attempts,
        error: err?.message,
      });
      // Only escalate to Sentry once retries are exhausted — every
      // intermediate attempt would otherwise fire N times for a single
      // logical failure and drown real problems in noise. `tenantId`
      // (and any other job payload fields) are scrubbed by the shared
      // redactPII in utils/sentry.js before the event is sent.
      const attempts = job?.attemptsMade || 0;
      const maxAttempts = job?.opts?.attempts || 0;
      if (!maxAttempts || attempts >= maxAttempts) {
        captureException(err, {
          tenantId: job?.data?.tenantId,
          extra: {
            queue,
            jobId: job?.id,
            jobName: job?.name,
            attempt: attempts,
            maxAttempts,
          },
        });
      }

      // Webhook delivery: after the retry budget is burnt, surface the
      // failure to the merchant's notification inbox. Best-effort —
      // never throw back into the worker.
      if (queue === QUEUE_NAMES.WEBHOOK_DELIVERY) {
        const attempts = job?.attemptsMade || 0;
        const maxAttempts = job?.opts?.attempts || 0;
        if (maxAttempts && attempts >= maxAttempts) {
          try {
            const tenantId = job?.data?.tenantId;
            if (tenantId) {
              const models = createScopedModels(mongoose.connection, tenantId);
              emitNotification(models, tenantId, {
                type: "webhook.failed",
                severity: "error",
                title: "Webhook delivery failed",
                body: `Webhook ${job.data?.event || "delivery"} to ${job.data?.targetUrl || "merchant URL"} failed after ${attempts} attempts`,
                resourceType: "webhook",
                permission: "settings.read",
                data: {
                  event: job.data?.event,
                  targetUrl: job.data?.targetUrl,
                  attempts,
                  error: err?.message,
                },
              });
            }
          } catch (e) {
            logger.warn("emit webhook.failed failed", { error: e?.message });
          }
        }
      }
    });
    worker.on("error", (err) => {
      // Worker-level error (not per-job) — usually a Redis disconnect.
      // BullMQ will self-heal when Redis returns; we just log. We still
      // send to Sentry so a sustained outage paging on-call doesn't
      // depend on someone reading the logs.
      logger.error("Worker error", { queue, error: err.message });
      captureException(err, { extra: { queue, scope: "worker.error" } });
    });
    workers.push(worker);
    queueEventsHandles.push(observeQueue(queue));
  }

  // Register the repeatable tenant-lifecycle sweep. Idempotent —
  // re-enqueueing the same jobId on restart just replaces the prior
  // schedule. Tests/dev skip scheduling so the suite doesn't try to
  // reach a live Redis.
  if (!config.isTest) {
    await scheduleTenantLifecycleSweep().catch((err) =>
      logger.warn("Failed to schedule tenant-lifecycle sweep", { error: err.message })
    );
    // Daily backup cron @ 03:00 UTC. Always scheduled — the processor
    // short-circuits cleanly when BACKUP_ENABLED !== "true", so the
    // cron is free to tick in every environment without side effects.
    await enqueueDailyBackupCron().catch((err) =>
      logger.warn("Failed to schedule daily backup cron", { error: err.message })
    );
  }

  logger.info("Workers started", {
    env: config.nodeEnv,
    queues: PROCESSORS.map((p) => `${p.queue}(${p.concurrency})`),
  });
}

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down workers`);
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled(queueEventsHandles.map((e) => e.close()));
  await closeAllQueues();
  await mongoose.connection.close().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => {
  logger.error("Worker unhandledRejection", { error: err?.message, stack: err?.stack });
  captureException(err instanceof Error ? err : new Error(String(err)), {
    extra: { scope: "worker.unhandledRejection" },
  });
});

main().catch((err) => {
  logger.error("Worker failed to start", { error: err.message, stack: err.stack });
  captureException(err, { extra: { scope: "worker.startup" } });
  process.exit(1);
});
