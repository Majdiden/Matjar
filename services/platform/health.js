/**
 * System health + integration status for the platform console.
 *
 * Every probe is bounded (timeouts) and fail-soft: one dead dependency
 * degrades its own row, never the whole response. Nothing here ever returns
 * a configuration VALUE — only whether something is configured, which
 * environment/provider is selected, and the last known outcome.
 *
 * Cached in-process for CACHE_TTL_MS: the page is refreshed often from a
 * phone and the probes touch Mongo + Redis.
 */
import mongoose from "mongoose";
import config from "../../config/index.js";
import { getQueue, getQueueConnection, hasQueueConnection, QUEUE_NAMES } from "../jobs/queues.js";
import { PaymentFactory } from "../payment/PaymentFactory.js";
import logger from "../../utils/logger.js";

export const CACHE_TTL_MS = 15_000;
const PROBE_TIMEOUT_MS = 2_000;

let cache = { data: null, at: 0 };
// Forced refreshes are honoured at most once per this window per process.
const REFRESH_MIN_INTERVAL_MS = 5_000;
let lastForcedAt = 0;

// Last-outcome trackers fed by the providers' callers (best effort, in-process).
const lastOutcome = {
  email: { lastSuccessAt: null, lastErrorAt: null, lastError: null },
};

/**
 * Called by services/providers/email.js after each real send. In-process only:
 * the worker process sends most email, so the API's view reflects sends made
 * from the API process (invites, resets) — the worker is blind to it.
 */
export function noteEmailOutcome(ok, error) {
  if (ok) lastOutcome.email.lastSuccessAt = new Date();
  else {
    lastOutcome.email.lastErrorAt = new Date();
    lastOutcome.email.lastError = error ? String(error).slice(0, 200) : "send failed";
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Severity ordering for the overall roll-up.
const RANK = { ok: 0, degraded: 1, down: 2, unknown: 1 };
export function worstStatus(statuses) {
  return statuses.reduce((worst, s) => (RANK[s] > RANK[worst] ? s : worst), "ok");
}

async function probe(name, fn) {
  const started = Date.now();
  try {
    const detail = await withTimeout(fn(), PROBE_TIMEOUT_MS, name);
    return { name, status: detail?.status || "ok", latencyMs: Date.now() - started, ...detail };
  } catch (err) {
    logger.warn("health probe failed", { probe: name, error: err?.message || String(err) });
    return { name, status: "down", latencyMs: Date.now() - started, error: "unavailable" };
  }
}

async function probeMongo() {
  const db = mongoose.connection?.db;
  if (!db || mongoose.connection.readyState !== 1) return { status: "down" };
  await db.admin().ping();
  let replica = null;
  try {
    const hello = await db.admin().command({ hello: 1 });
    replica = { isReplicaSet: !!hello.setName, isPrimary: !!hello.isWritablePrimary };
  } catch {
    replica = null;
  }
  return { status: "ok", replica };
}

// ioredis keeps the shared connection in "connecting"/"connect" until the
// first command completes; a PING (bounded by the probe timeout) is the
// truthful check. A down broker rejects or times out.
async function probeRedis() {
  if (!hasQueueConnection()) return { status: "down", error: "not connected" };
  const conn = getQueueConnection();
  const pong = await conn.ping();
  return { status: pong === "PONG" ? "ok" : "degraded", connectionState: conn.status };
}

async function probeQueues() {
  if (!hasQueueConnection()) {
    return { status: "down", error: "not connected", queues: Object.values(QUEUE_NAMES).map((name) => ({ name, error: "unavailable" })) };
  }
  const conn = getQueueConnection();
  try {
    await withTimeout(conn.ping(), PROBE_TIMEOUT_MS, "redis");
  } catch {
    return { status: "down", queues: Object.values(QUEUE_NAMES).map((name) => ({ name, error: "unavailable" })) };
  }
  const queues = await Promise.all(
    Object.values(QUEUE_NAMES).map(async (name) => {
      try {
        const q = getQueue(name);
        const [counts, paused] = await Promise.all([
          withTimeout(q.getJobCounts("waiting", "active", "delayed", "failed", "completed"), PROBE_TIMEOUT_MS, name),
          withTimeout(q.isPaused(), PROBE_TIMEOUT_MS, name),
        ]);
        return { name, paused, ...counts };
      } catch {
        return { name, error: "unavailable" };
      }
    })
  );
  const anyUnavailable = queues.some((q) => q.error);
  const anyFailed = queues.some((q) => (q.failed || 0) > 0);
  const anyPaused = queues.some((q) => q.paused);
  return { status: anyUnavailable ? "down" : anyFailed || anyPaused ? "degraded" : "ok", queues };
}

function apiInfo() {
  const mem = process.memoryUsage();
  return {
    status: "ok",
    uptimeSec: Math.round(process.uptime()),
    nodeVersion: process.version,
    environment: config.nodeEnv,
    memory: { rssMb: Math.round(mem.rss / 1048576), heapUsedMb: Math.round(mem.heapUsed / 1048576) },
  };
}

/**
 * Integration rows — one per external provider. `configured` is derived
 * from config presence only; values are never read into the response.
 */
export function listIntegrations() {
  const env = config.nodeEnv;
  // Mirrors services/providers/email.js → isEmailConfigured() (not imported:
  // that module imports this one for noteEmailOutcome, so avoid the cycle).
  const emailConfigured = !!config.emailEnabled && !!config.resendApiKey;
  const rows = [
    {
      name: "Email (Resend)",
      kind: "email",
      environment: env,
      configured: emailConfigured,
      enabled: !!config.emailEnabled,
      health: emailConfigured ? (lastOutcome.email.lastError && !lastOutcome.email.lastSuccessAt ? "degraded" : "ok") : "not_configured",
      lastSuccessAt: lastOutcome.email.lastSuccessAt,
      lastErrorAt: lastOutcome.email.lastErrorAt,
      lastError: lastOutcome.email.lastError,
      note: config.emailEnabled ? null : "EMAIL_ENABLED is off — sends are logged, not delivered.",
    },
    {
      name: config.uploadProvider === "cloudinary" ? "Storage (Cloudinary)" : "Storage (local disk)",
      kind: "storage",
      environment: env,
      configured: config.uploadProvider === "cloudinary" ? !!(config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret) : true,
      enabled: true,
      health: config.uploadProvider === "cloudinary" ? (config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret ? "ok" : "not_configured") : config.isProduction ? "degraded" : "ok",
      note: config.uploadProvider !== "cloudinary" && config.isProduction ? "Local-disk uploads are not durable in production." : null,
    },
    {
      name: `SSL provider (${config.sslProvider || "stub"})`,
      kind: "ssl",
      environment: env,
      configured: config.sslProvider === "cloudflare" ? !!(config.cloudflareApiToken && config.cloudflareZoneId) : true,
      enabled: true,
      health: config.sslProvider === "cloudflare" ? (config.cloudflareApiToken && config.cloudflareZoneId ? "ok" : "not_configured") : config.isProduction ? "degraded" : "ok",
      note: (config.sslProvider || "stub") === "stub" ? "Stub provider fakes certificate issuance (dev only)." : null,
    },
    {
      name: "Payments (Stripe)",
      kind: "payment",
      environment: env,
      configured: !!config.stripeSecretKey,
      enabled: !!config.stripeEnabled,
      health: config.stripeEnabled ? (config.stripeSecretKey && config.stripeWebhookSecret ? "ok" : "degraded") : "not_configured",
      providers: PaymentFactory.getAvailableProviders(),
      note: config.stripeEnabled && !config.stripeWebhookSecret ? "STRIPE_WEBHOOK_SECRET missing — webhook signatures cannot be verified." : null,
    },
    {
      name: "Backups (S3)",
      kind: "backup",
      environment: env,
      configured: !!(config.backupS3Endpoint && config.backupS3Bucket && config.backupS3AccessKeyId && config.backupS3SecretAccessKey),
      enabled: !!config.backupEnabled,
      health: config.backupEnabled ? (config.backupS3Bucket && config.backupS3AccessKeyId ? "ok" : "degraded") : "not_configured",
    },
    {
      name: "Error tracking (Sentry)",
      kind: "observability",
      environment: config.sentryEnvironment || env,
      configured: !!config.sentryDsn,
      enabled: !!config.sentryDsn,
      health: config.sentryDsn ? "ok" : "not_configured",
    },
    {
      name: "Redis (queues, sessions, rate limits)",
      kind: "infrastructure",
      environment: env,
      configured: !!config.redisUrl,
      enabled: true,
      // Read-only: never open a connection just to report on it.
      health: hasQueueConnection() ? (["ready", "connect", "connecting"].includes(getQueueConnection().status) ? "ok" : "down") : "not_configured",
    },
  ];
  return rows;
}

export async function getSystemHealth({ force = false } = {}) {
  const now = Date.now();
  const forced = force && now - lastForcedAt >= REFRESH_MIN_INTERVAL_MS;
  if (forced) lastForcedAt = now;
  if (!forced && cache.data && now - cache.at < CACHE_TTL_MS) return cache.data;
  const [mongo, redis, queues] = await Promise.all([probe("mongo", probeMongo), probe("redis", probeRedis), probe("queues", probeQueues)]);
  const api = { name: "api", ...apiInfo() };
  const integrations = listIntegrations();
  const integrationStatus = worstStatus(
    integrations.map((i) => (i.health === "down" ? "down" : i.health === "degraded" ? "degraded" : "ok"))
  );
  const checks = [api, mongo, redis, queues];
  const overall = worstStatus([...checks.map((c) => c.status), integrationStatus]);
  const data = { overall, checks, integrations, generatedAt: new Date().toISOString() };
  cache = { data, at: Date.now() };
  return data;
}
