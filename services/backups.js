/**
 * Automated backups service.
 *
 * Strategy: `mongodump --archive --gzip` streams the full cluster dump to
 * stdout; we pipe it straight into a Cloudflare R2 multipart upload (R2
 * is S3-compatible, so `@aws-sdk/client-s3` + `@aws-sdk/lib-storage`
 * just work). Nothing is buffered to local disk — important for Render,
 * where ephemeral filesystems are small and backups can exceed a few GB.
 *
 * Retention policy (enforced by `pruneOldBackups`):
 *   - Keep the 30 most recent daily snapshots.
 *   - Keep 12 monthly snapshots (first backup of each month).
 *   - Everything else older than the 30-day daily window is deleted.
 *
 * Metadata is written to a `_backups` collection in the shared DB so the
 * dashboard (and operator scripts) can list backups without round-tripping
 * to S3 for every read.
 *
 * Required env vars when BACKUP_ENABLED=true:
 *   - BACKUP_S3_ENDPOINT            R2 endpoint (https://ACCOUNT.r2.cloudflarestorage.com)
 *   - BACKUP_S3_ACCESS_KEY_ID
 *   - BACKUP_S3_SECRET_ACCESS_KEY
 *   - BACKUP_S3_BUCKET
 *   - BACKUP_S3_REGION              defaults to "auto" (R2's recommended value)
 *
 * If BACKUP_ENABLED !== "true" → `runBackup` short-circuits and logs.
 * If any required env var is missing → logs loud error, does NOT throw
 * (we don't want a misconfigured backups setup to crash the worker loop).
 *
 * mongodump availability: the CLI ships with the MongoDB Database Tools,
 * NOT with the server or the node driver. Render's default Node image
 * does NOT include it. Two supported fallbacks, both documented in
 * render.yaml:
 *   (1) Install via apt in a custom Dockerfile layer (preferred).
 *   (2) Run backups from a separate Render cron-job service built on
 *       a `mongo/mongodb-atlas-cli` or `mongo/mongo-tools` image and
 *       have it invoke `scripts/verify-backup.js` restoration only.
 *
 * The service detects missing mongodump at runtime and fails the job
 * with a descriptive error so the operator sees it in Sentry/logs.
 */

import { spawn } from "child_process";
import { PassThrough } from "stream";
import mongoose from "mongoose";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import logger from "../utils/logger.js";
import config from "../config/index.js";

const REQUIRED_CONFIG_KEYS = [
  ["backupS3Endpoint", "BACKUP_S3_ENDPOINT"],
  ["backupS3AccessKeyId", "BACKUP_S3_ACCESS_KEY_ID"],
  ["backupS3SecretAccessKey", "BACKUP_S3_SECRET_ACCESS_KEY"],
  ["backupS3Bucket", "BACKUP_S3_BUCKET"],
];

const BACKUP_PREFIX = "backups/";
const DAILY_KEEP = 30;
const MONTHLY_KEEP = 12;

// ---------------------------------------------------------------------------
// Env + client helpers
// ---------------------------------------------------------------------------

function isEnabled() {
  return config.backupEnabled;
}

function validateEnv() {
  const missing = REQUIRED_CONFIG_KEYS
    .filter(([key]) => !config[key])
    .map(([, envName]) => envName);
  if (missing.length) {
    logger.error("Backups misconfigured — required env vars missing", { missing });
    return false;
  }
  return true;
}

let s3Client = null;
function getS3() {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: config.backupS3Region,
    endpoint: config.backupS3Endpoint,
    credentials: {
      accessKeyId: config.backupS3AccessKeyId,
      secretAccessKey: config.backupS3SecretAccessKey,
    },
    // R2 requires path-style addressing; virtual-hosted style is not
    // supported for the S3-compatible endpoint.
    forcePathStyle: true,
  });
  return s3Client;
}

function getBucket() {
  return config.backupS3Bucket;
}

// ---------------------------------------------------------------------------
// Filename + parsing helpers
// ---------------------------------------------------------------------------

function buildFilename(now = new Date()) {
  const env = config.nodeEnv;
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${pad(now.getUTCSeconds())}`;
  return `matjar-${env}-${date}-${time}.archive.gz`;
}

// Extract the YYYY-MM-DD from a backup filename — used for retention bucketing.
// Returns null if the filename doesn't match the expected pattern (so the
// prune logic leaves unrecognized objects alone rather than nuking them).
function parseBackupDate(filename) {
  const m = /(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.archive\.gz$/.exec(filename);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Run a full cluster dump and stream it to R2. Returns the metadata doc.
 * Short-circuits cleanly (returns `{ skipped: true, reason }`) when
 * backups are disabled or misconfigured — never throws for those cases
 * so the BullMQ retry loop doesn't hammer a broken config.
 */
export async function runBackup({ dryRun = false } = {}) {
  if (!isEnabled()) {
    logger.info("Backups disabled (BACKUP_ENABLED != 'true') — skipping");
    return { skipped: true, reason: "disabled" };
  }
  if (!validateEnv()) {
    return { skipped: true, reason: "misconfigured" };
  }
  // `DB_URI` is a required env (enforced at config boot); treating it as
  // optional here would mask a misconfigured worker. If a future fallback
  // is needed, add a typed getter rather than reintroducing a raw read.
  const mongoUri = config.dbUri;

  const filename = buildFilename();
  const key = `${BACKUP_PREFIX}${filename}`;
  const startedAt = new Date();

  logger.info("Backup starting", { filename, dryRun });

  if (dryRun) {
    return {
      dryRun: true,
      filename,
      key,
      bucket: getBucket(),
    };
  }

  // Spawn mongodump. Stdout is the gzipped archive stream; stderr
  // carries progress messages (we log them at debug level and surface
  // the last ~4KB on failure for diagnosis).
  const child = spawn(
    "mongodump",
    [`--uri=${mongoUri}`, "--archive", "--gzip"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  let stderrTail = "";
  child.stderr.on("data", (chunk) => {
    const str = chunk.toString("utf8");
    // Keep the last ~4KB so we can include it in error reports.
    stderrTail = (stderrTail + str).slice(-4096);
  });

  // PassThrough lets us count bytes as they flow through to S3.
  const passthrough = new PassThrough();
  let size = 0;
  passthrough.on("data", (chunk) => { size += chunk.length; });
  child.stdout.pipe(passthrough);

  // Surface spawn failures (e.g. mongodump not on PATH) as a clean error.
  const spawnError = new Promise((_, reject) => {
    child.on("error", (err) => reject(new Error(`mongodump spawn failed: ${err.message}`)));
  });

  // Wait for mongodump to exit. A non-zero code means the dump failed;
  // we must abort the S3 upload in that case so partial archives don't
  // land in the bucket.
  const mongodumpExit = new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mongodump exited with code ${code}: ${stderrTail.slice(-512)}`));
    });
  });

  // 5MB parts × up to 10k parts = ~50GB headroom per backup, which is
  // well above any realistic Atlas-cluster dump for this product.
  const upload = new Upload({
    client: getS3(),
    params: {
      Bucket: getBucket(),
      Key: key,
      Body: passthrough,
      ContentType: "application/gzip",
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024,
    leavePartsOnError: false,
  });

  try {
    await Promise.race([
      Promise.all([mongodumpExit, upload.done()]),
      spawnError,
    ]);
  } catch (err) {
    // Best-effort cleanup — abort the S3 upload and kill the dump.
    try { await upload.abort(); } catch { /* ignore */ }
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
    logger.error("Backup failed", { filename, error: err.message });
    throw err;
  }

  const durationMs = Date.now() - startedAt.getTime();
  const metadata = {
    filename,
    key,
    bucket: getBucket(),
    size,
    createdAt: startedAt,
    durationMs,
  };

  // Record metadata in Mongo so the dashboard can list backups cheaply.
  // Failure here is non-fatal — the backup itself succeeded.
  try {
    const conn = mongoose.connection;
    if (conn && conn.readyState === 1) {
      await conn.db.collection("_backups").insertOne({ ...metadata });
    }
  } catch (err) {
    logger.warn("Backup metadata write failed (backup itself succeeded)", {
      filename,
      error: err.message,
    });
  }

  logger.info("Backup completed", {
    filename,
    size,
    durationMs,
  });
  return metadata;
}

/**
 * List backup objects in the R2 bucket, newest first. Returns a compact
 * shape suitable for the dashboard/operator tooling.
 */
export async function listBackups() {
  if (!validateEnv()) return [];
  const client = getS3();
  const results = [];
  let ContinuationToken;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix: BACKUP_PREFIX,
        ContinuationToken,
      })
    );
    for (const obj of page.Contents || []) {
      const filename = (obj.Key || "").slice(BACKUP_PREFIX.length);
      if (!filename) continue;
      results.push({
        key: obj.Key,
        filename,
        size: obj.Size || 0,
        lastModified: obj.LastModified || null,
        parsedDate: parseBackupDate(filename),
      });
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);

  results.sort((a, b) => {
    const ad = a.parsedDate?.getTime() || a.lastModified?.getTime() || 0;
    const bd = b.parsedDate?.getTime() || b.lastModified?.getTime() || 0;
    return bd - ad;
  });
  return results;
}

/**
 * Decide which backups to keep given the 30-daily + 12-monthly policy.
 * Pure function — exported for tests. Inputs must be sorted newest first.
 *
 * Rule set:
 *   1. Keep at most one backup per calendar day (UTC). The most recent
 *      backup for each day wins; later backups of the same day are
 *      treated as candidates for deletion.
 *   2. Keep at most one backup per calendar month (the earliest backup
 *      of that month — "first of month" semantics). Kept regardless of
 *      age, up to MONTHLY_KEEP months.
 *   3. Within the daily window, keep the most recent DAILY_KEEP distinct
 *      days. Older dailies roll off unless they also satisfy rule 2.
 */
export function decideRetention(backups, { dailyKeep = DAILY_KEEP, monthlyKeep = MONTHLY_KEEP } = {}) {
  // Group by YYYY-MM-DD, picking the newest per day.
  const byDay = new Map();
  const byMonth = new Map(); // YYYY-MM -> list of backups (ascending)

  for (const b of backups) {
    const d = b.parsedDate || b.lastModified;
    if (!d) continue;
    const dayKey = d.toISOString().slice(0, 10);
    const monthKey = d.toISOString().slice(0, 7);
    // Most recent per day.
    const existing = byDay.get(dayKey);
    if (!existing || (b.parsedDate || b.lastModified) > (existing.parsedDate || existing.lastModified)) {
      byDay.set(dayKey, b);
    }
    // Collect per-month for first-of-month pick.
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey).push(b);
  }

  // Daily set: most recent N distinct days (newest first).
  const dailyKeys = [...byDay.keys()].sort().reverse().slice(0, dailyKeep);
  const keep = new Set(dailyKeys.map((k) => byDay.get(k).key));

  // Monthly set: earliest backup per month, most recent N months.
  const monthlyKeys = [...byMonth.keys()].sort().reverse().slice(0, monthlyKeep);
  for (const mk of monthlyKeys) {
    const list = byMonth.get(mk);
    // Sort ascending, take the first (earliest) — that's the "first of month".
    list.sort((a, b) => {
      const ad = (a.parsedDate || a.lastModified)?.getTime() || 0;
      const bd = (b.parsedDate || b.lastModified)?.getTime() || 0;
      return ad - bd;
    });
    if (list[0]) keep.add(list[0].key);
  }

  const toDelete = backups.filter((b) => b.key && !keep.has(b.key));
  return {
    keep: backups.filter((b) => keep.has(b.key)),
    delete: toDelete,
  };
}

/**
 * Apply the retention policy to the bucket. Returns the list of deleted keys.
 */
export async function pruneOldBackups({ dryRun = false } = {}) {
  if (!isEnabled()) {
    logger.info("Backups disabled — skipping prune");
    return { skipped: true, reason: "disabled" };
  }
  if (!validateEnv()) return { skipped: true, reason: "misconfigured" };

  const backups = await listBackups();
  const { keep, delete: toDelete } = decideRetention(backups);

  logger.info("Backup prune plan", {
    total: backups.length,
    keep: keep.length,
    delete: toDelete.length,
    dryRun,
  });

  if (dryRun || toDelete.length === 0) {
    return {
      deleted: [],
      kept: keep.map((b) => b.filename),
      candidates: toDelete.map((b) => b.filename),
      dryRun,
    };
  }

  // S3 DeleteObjects accepts up to 1000 keys per call.
  const client = getS3();
  const bucket = getBucket();
  const deletedKeys = [];
  for (let i = 0; i < toDelete.length; i += 1000) {
    const chunk = toDelete.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((b) => ({ Key: b.key })),
          Quiet: true,
        },
      })
    );
    for (const b of chunk) deletedKeys.push(b.filename);
  }

  // Also remove the metadata rows for pruned backups so the dashboard
  // stays in sync with the bucket.
  try {
    const conn = mongoose.connection;
    if (conn && conn.readyState === 1 && deletedKeys.length) {
      await conn.db.collection("_backups").deleteMany({ filename: { $in: deletedKeys } });
    }
  } catch (err) {
    logger.warn("Backup metadata cleanup failed after prune", { error: err.message });
  }

  logger.info("Backup prune completed", { deletedCount: deletedKeys.length });
  return { deleted: deletedKeys, kept: keep.map((b) => b.filename) };
}
