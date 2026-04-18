#!/usr/bin/env node
/**
 * Restore-verification script.
 *
 * TODO: schedule weekly via BullMQ cron in a future iteration. For now
 * operators run this manually after a backup to prove the archive is
 * restorable — a backup you can't restore is worthless, and the only
 * way to know the pipeline still works is to actually run it through.
 *
 * What it does:
 *   1. Finds the most recent backup in R2 (by listBackups()).
 *   2. Downloads it to a temp file.
 *   3. Runs `mongorestore` into a throwaway database named
 *      `matjar_verify_<timestamp>` against RESTORE_DB_URI.
 *   4. Counts collections + documents in the throwaway DB and compares
 *      to the live DB's counts (live must be >= restored, since the
 *      backup was taken at a point in time and the live DB has moved
 *      forward since).
 *   5. Drops the throwaway DB and reports pass/fail.
 *
 * Usage:
 *   RESTORE_DB_URI=mongodb://localhost:27018 node scripts/verify-backup.js
 *   RESTORE_DB_URI=mongodb://localhost:27018 node scripts/verify-backup.js --backup matjar-production-2026-04-18-03-00-00.archive.gz
 *   RESTORE_DB_URI=mongodb://localhost:27018 node scripts/verify-backup.js --archive-path /tmp/matjar.archive.gz
 *   RESTORE_DB_URI=mongodb://localhost:27018 node scripts/verify-backup.js --source-db matjar
 *
 * Exit codes:
 *   0  verification passed (collections + doc counts within tolerance)
 *   1  verification failed (any check didn't meet expectations)
 *   2  misconfiguration (missing env, backup not found, mongorestore missing)
 *
 * Safety: RESTORE_DB_URI is required and should point at disposable Mongo
 * (for example a Docker container on localhost:27018). The throwaway DB
 * name includes a timestamp so concurrent runs can't collide. We drop it
 * in a finally block — if the process is SIGKILLed mid-run the DB is left
 * behind; that's acceptable for a manual verification script, the operator
 * will notice the leftover.
 */

import "dotenv/config";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { pipeline } from "stream/promises";
import mongoose from "mongoose";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { listBackups } from "../services/backups.js";
import logger from "../utils/logger.js";

// Collections that the backup/restore cycle may or may not include (indexes,
// _migrations metadata, etc.) — excluded from doc-count equality checks to
// keep the comparison meaningful.
const IGNORED_COLLECTIONS = new Set(["_migrations", "_backups", "system.views"]);

function parseArgs(argv) {
  const args = {
    backup: null,
    archivePath: null,
    sourceDb: null,
    restoreUri: process.env.RESTORE_DB_URI || null,
    keepRestoreDb: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--help" || argv[i] === "-h") {
      args.help = true;
    } else if (argv[i] === "--backup" && argv[i + 1]) {
      args.backup = argv[i + 1];
      i++;
    } else if (argv[i] === "--archive-path" && argv[i + 1]) {
      args.archivePath = argv[i + 1];
      i++;
    } else if (argv[i] === "--source-db" && argv[i + 1]) {
      args.sourceDb = argv[i + 1];
      i++;
    } else if (argv[i] === "--restore-uri" && argv[i + 1]) {
      args.restoreUri = argv[i + 1];
      i++;
    } else if (argv[i] === "--keep-restore-db") {
      args.keepRestoreDb = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  RESTORE_DB_URI=mongodb://localhost:27018 npm run backup:verify
  RESTORE_DB_URI=mongodb://localhost:27018 npm run backup:verify -- --backup matjar-production-2026-04-18-03-00-00.archive.gz
  RESTORE_DB_URI=mongodb://localhost:27018 npm run backup:verify -- --archive-path /tmp/matjar.archive.gz
  RESTORE_DB_URI=mongodb://localhost:27018 npm run backup:verify -- --source-db matjar

Required env:
  DB_URI                         Source MongoDB URI, including database name
  RESTORE_DB_URI                 Disposable restore MongoDB URI, e.g. Docker Mongo on localhost:27018
  BACKUP_S3_ENDPOINT             R2/S3 endpoint (not required with --archive-path)
  BACKUP_S3_ACCESS_KEY_ID        R2/S3 access key id (not required with --archive-path)
  BACKUP_S3_SECRET_ACCESS_KEY    R2/S3 secret access key (not required with --archive-path)
  BACKUP_S3_BUCKET               R2/S3 bucket (not required with --archive-path)

Options:
  --backup <filename>            Restore a specific backup filename instead of the latest
  --archive-path <path>          Restore a local mongodump archive instead of downloading from R2/S3
  --source-db <db>               Source DB namespace inside the archive; defaults to DB_URI path
  --restore-uri <uri>            Override RESTORE_DB_URI
  --keep-restore-db              Leave the throwaway DB for manual inspection
  --help                         Show this help
`);
}

function dbNameFromUri(uri) {
  try {
    const parsed = new URL(uri);
    const dbName = decodeURIComponent((parsed.pathname || "").replace(/^\//, ""));
    return dbName || null;
  } catch {
    return null;
  }
}

function safeDbName(name, label) {
  if (!name || !/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error(`${label} must be a simple database name (letters, numbers, underscore, hyphen)`);
  }
  return name;
}

async function downloadBackup(key, destPath) {
  const client = new S3Client({
    region: process.env.BACKUP_S3_REGION || "auto",
    endpoint: process.env.BACKUP_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
  const res = await client.send(
    new GetObjectCommand({
      Bucket: process.env.BACKUP_S3_BUCKET,
      Key: key,
    })
  );
  await pipeline(res.Body, createWriteStream(destPath));
}

function runMongoRestore({ archivePath, sourceDb, targetDb, restoreUri }) {
  return new Promise((resolve, reject) => {
    // --nsFrom / --nsTo rewrites the db name in the archive so we
    // restore into our throwaway DB, not over the source data.
    // Archive format matches what mongodump --archive --gzip produced.
    const args = [
      `--uri=${restoreUri}`,
      `--archive=${archivePath}`,
      "--gzip",
      "--drop",
      `--nsFrom=${sourceDb}.*`,
      `--nsTo=${targetDb}.*`,
    ];
    const child = spawn("mongorestore", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderrTail = "";
    child.stderr.on("data", (c) => {
      stderrTail = (stderrTail + c.toString("utf8")).slice(-4096);
    });
    child.on("error", (err) => reject(new Error(`mongorestore spawn failed: ${err.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mongorestore exited ${code}: ${stderrTail.slice(-512)}`));
    });
  });
}

async function countDb(db) {
  const cols = await db.listCollections().toArray();
  const out = {};
  for (const c of cols) {
    if (IGNORED_COLLECTIONS.has(c.name)) continue;
    try {
      out[c.name] = await db.collection(c.name).countDocuments();
    } catch {
      out[c.name] = -1;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const requiredEnv = [
    "DB_URI",
    "RESTORE_DB_URI",
  ];
  if (!args.archivePath) {
    requiredEnv.push(
      "BACKUP_S3_ENDPOINT",
      "BACKUP_S3_ACCESS_KEY_ID",
      "BACKUP_S3_SECRET_ACCESS_KEY",
      "BACKUP_S3_BUCKET"
    );
  }
  const missing = requiredEnv.filter((k) => !process.env[k] && !(k === "RESTORE_DB_URI" && args.restoreUri));
  if (missing.length) {
    logger.error("verify-backup: missing required env vars", { missing });
    process.exit(2);
  }
  if (args.restoreUri === process.env.DB_URI) {
    logger.error("verify-backup: RESTORE_DB_URI must not equal DB_URI");
    process.exit(2);
  }

  const sourceDb = safeDbName(args.sourceDb || dbNameFromUri(process.env.DB_URI), "source db");
  const restoreUri = args.restoreUri;

  logger.info("verify-backup: starting", {
    sourceDb,
    restoreUri: restoreUri.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:<redacted>@"),
  });

  let target = null;
  let providedArchivePath = null;
  if (args.archivePath) {
    providedArchivePath = path.resolve(args.archivePath);
    try {
      await fs.access(providedArchivePath);
    } catch {
      logger.error("verify-backup: archive path does not exist", { archivePath: providedArchivePath });
      process.exit(2);
    }
    target = {
      filename: path.basename(providedArchivePath),
      key: null,
      size: null,
    };
  } else {
    // Pick backup from R2/S3: explicit filename via --backup, or the latest.
    const backups = await listBackups();
    if (!backups.length) {
      logger.error("verify-backup: no backups found in bucket");
      process.exit(2);
    }
    target = args.backup
      ? backups.find((b) => b.filename === args.backup)
      : backups[0];
    if (!target) {
      logger.error("verify-backup: requested backup not found", { backup: args.backup });
      process.exit(2);
    }
  }
  logger.info("verify-backup: restoring", {
    filename: target.filename,
    size: target.size,
    source: providedArchivePath ? "local-archive" : "r2",
  });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "matjar-verify-"));
  const archivePath = providedArchivePath || path.join(tmpDir, target.filename);
  let throwawayDb = null;
  let liveConn = null;
  let restoreConn = null;
  let passed = false;
  try {
    if (!providedArchivePath) {
      await downloadBackup(target.key, archivePath);
      logger.info("verify-backup: archive downloaded", { archivePath });
    } else {
      logger.info("verify-backup: using local archive", { archivePath });
    }

    throwawayDb = `matjar_verify_${Date.now()}`;
    logger.info("verify-backup: running mongorestore", { throwawayDb });
    await runMongoRestore({
      archivePath,
      sourceDb,
      targetDb: throwawayDb,
      restoreUri,
    });

    // Connect and compare counts.
    liveConn = await mongoose.createConnection(process.env.DB_URI).asPromise();
    restoreConn = await mongoose.createConnection(restoreUri).asPromise();
    const liveDb = liveConn.useDb(sourceDb, { useCache: false });
    const liveDbName = liveDb.db.databaseName;
    const liveCounts = await countDb(liveDb.db);

    // Switch to the throwaway db via useDb on the restore connection.
    const verifyDb = restoreConn.useDb(throwawayDb, { useCache: false });
    const restoredCounts = await countDb(verifyDb.db);

    const restoredNames = Object.keys(restoredCounts);
    const liveNames = Object.keys(liveCounts);

    if (restoredNames.length === 0) {
      logger.error("verify-backup: restored DB has zero collections — restore effectively empty");
      passed = false;
    } else {
      let ok = true;
      const report = [];
      for (const name of restoredNames) {
        const live = liveCounts[name];
        const restored = restoredCounts[name];
        const row = { collection: name, liveDb: liveDbName, live, restored };
        // The backup is a point-in-time snapshot and live has moved
        // forward. We accept restored <= live; anything greater is
        // suspicious (restored more docs than currently exist — missing
        // collection in live, or data loss).
        if (!Number.isFinite(restored) || restored < 0) {
          row.status = "unreadable";
          ok = false;
        } else if (!Number.isFinite(live) || live < 0) {
          // Live collection missing entirely — still a valid restore as
          // long as the restored count is sane. Warn but don't fail.
          row.status = "live-missing";
        } else if (restored > live) {
          row.status = "mismatch";
          ok = false;
        } else {
          row.status = "ok";
        }
        report.push(row);
      }
      // Collections present in live but missing from the backup are
      // noteworthy but not necessarily a failure — they may have been
      // created between the backup and now.
      const liveOnly = liveNames.filter((n) => !(n in restoredCounts));
      passed = ok;
      logger.info("verify-backup: comparison complete", {
        passed,
        restoredCollections: restoredNames.length,
        liveCollections: liveNames.length,
        liveOnly,
        report,
      });
    }
  } catch (err) {
    logger.error("verify-backup: failed", { error: err.message, stack: err.stack });
    passed = false;
  } finally {
    // Clean up throwaway DB + temp files regardless of outcome.
    try {
      if (throwawayDb && restoreConn?.readyState === 1 && !args.keepRestoreDb) {
        const v = restoreConn.useDb(throwawayDb, { useCache: false });
        await v.db.dropDatabase();
        logger.info("verify-backup: throwaway db dropped", { throwawayDb });
      } else if (throwawayDb && args.keepRestoreDb) {
        logger.warn("verify-backup: keeping throwaway db by request", { throwawayDb });
      }
    } catch (err) {
      logger.warn("verify-backup: failed to drop throwaway db", {
        throwawayDb,
        error: err.message,
      });
    }
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    try { await liveConn?.close(); } catch { /* ignore */ }
    try { await restoreConn?.close(); } catch { /* ignore */ }
  }

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  logger.error("verify-backup: unhandled error", { error: err.message, stack: err.stack });
  process.exit(1);
});
