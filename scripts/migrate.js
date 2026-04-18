#!/usr/bin/env node
/**
 * Lightweight migration runner for MongoDB.
 *
 * Design choices:
 *   - No dependency on migrate-mongo or similar. The runner is ~200 lines
 *     and matches the rest of this repo's hand-rolled style.
 *   - State lives in a `_migrations` collection in the same DB the app
 *     uses (config.dbUri). Each row is { _id, name, appliedAt, checksum }.
 *     `_id` is the numeric prefix ("001", "002") so ordering is naturally
 *     lexicographic and a re-named file can be detected via checksum.
 *   - Each migration file exports { up, down, description }. `up` and `down`
 *     receive (db, { logger, session }) where `db` is the native Mongo
 *     driver database handle (mongoose.connection.db). We prefer the raw
 *     driver because migrations should not care about Mongoose model state
 *     at the time the migration was written.
 *   - On MongoDB 7 we wrap each migration in a multi-doc transaction when
 *     the connection supports it (replica set). On a standalone Mongo
 *     (local dev laptop without a replica set) transactions are unavailable,
 *     so we fall through and run without one — a one-line warning is
 *     emitted so the operator knows the migration was not atomic.
 *
 * Commands:
 *   up              Apply every pending migration in order.
 *   down            Revert the most recently applied migration.
 *   status          List applied + pending migrations.
 *   create <name>   Scaffold a new migration file with the next number.
 *
 * Safety:
 *   In NODE_ENV=production the runner refuses to apply or revert unless
 *   `--production` is passed. `status` is always safe.
 */

import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";
import config from "../config/index.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");
const COLLECTION = "_migrations";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * A migration filename is `<digits>_<snake_name>.js`. We sort by the numeric
 * prefix, which also doubles as the `_id` in the `_migrations` collection.
 */
function parseFilename(filename) {
  const match = filename.match(/^(\d+)_([a-z0-9_]+)\.js$/i);
  if (!match) return null;
  return { id: match[1], name: match[2], filename };
}

async function listMigrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  const entries = await readdir(MIGRATIONS_DIR);
  const parsed = entries
    .map((f) => parseFilename(f))
    .filter((x) => x !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
  return parsed;
}

async function loadMigration(entry) {
  const full = path.join(MIGRATIONS_DIR, entry.filename);
  const mod = await import(pathToFileURL(full).href);
  if (typeof mod.up !== "function" || typeof mod.down !== "function") {
    throw new Error(
      `Migration ${entry.filename} must export async up() and async down() functions.`
    );
  }
  const source = await readFile(full, "utf8");
  const checksum = createHash("sha256").update(source).digest("hex").slice(0, 16);
  return { ...entry, up: mod.up, down: mod.down, description: mod.description || "", checksum };
}

/**
 * Try to start a multi-doc transaction. On standalone Mongo this throws,
 * and we fall back to running the migration without a session so dev
 * laptops aren't forced to boot a replica set.
 */
async function runWithOptionalTransaction(fn) {
  const session = await mongoose.connection.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await fn(session);
      });
    } catch (err) {
      // Error code 20 / message "Transaction numbers are only allowed on a replica set member or mongos"
      // signals a standalone Mongo. Fall back to non-transactional run.
      const msg = String(err && err.message ? err.message : err);
      if (/Transaction numbers are only allowed/i.test(msg) || err?.codeName === "IllegalOperation") {
        logger.warn("migrate: transactions unavailable on this MongoDB deployment, running without atomicity", {
          error: msg,
        });
        result = await fn(null);
      } else {
        throw err;
      }
    }
    return result;
  } finally {
    await session.endSession();
  }
}

async function connect() {
  if (!config.dbUri) {
    throw new Error("DB_URI is not set. Migrations cannot run without a database URI.");
  }
  await mongoose.connect(config.dbUri);
  return mongoose.connection.db;
}

async function disconnect() {
  await mongoose.disconnect();
}

function productionGuard(args) {
  if (config.isProduction && !args.includes("--production")) {
    logger.error(
      "Refusing to run migrations in NODE_ENV=production without the --production flag."
    );
    logger.error(
      "If you really mean to do this, re-run with: node scripts/migrate.js <cmd> --production"
    );
    process.exit(2);
  }
}

// --------------------------------------------------------------------------
// Commands
// --------------------------------------------------------------------------

async function cmdStatus() {
  const db = await connect();
  try {
    const files = await listMigrationFiles();
    const applied = await db.collection(COLLECTION).find({}).sort({ _id: 1 }).toArray();
    const appliedIds = new Set(applied.map((r) => r._id));

    logger.info(`Migrations directory: ${MIGRATIONS_DIR}`);
    logger.info(`Database: ${config.dbUri.replace(/\/\/[^@]+@/, "//***@")}`);
    logger.info(`Applied: ${applied.length}   Pending: ${files.filter((f) => !appliedIds.has(f.id)).length}`);

    console.log("");
    console.log("  ID   STATUS   NAME");
    console.log("  ---- -------- ----------------------------------------");
    for (const f of files) {
      const status = appliedIds.has(f.id) ? "applied" : "pending";
      console.log(`  ${f.id}  ${status.padEnd(8)} ${f.name}`);
    }
    // Also show applied rows that no longer have a file — orphans.
    const fileIds = new Set(files.map((f) => f.id));
    const orphans = applied.filter((r) => !fileIds.has(r._id));
    if (orphans.length) {
      console.log("");
      logger.warn(`${orphans.length} applied migration(s) have no corresponding file:`);
      for (const o of orphans) {
        console.log(`  ${o._id}  orphan   ${o.name}`);
      }
    }
  } finally {
    await disconnect();
  }
}

async function cmdUp(args) {
  productionGuard(args);
  const db = await connect();
  try {
    const files = await listMigrationFiles();
    const applied = await db.collection(COLLECTION).find({}).toArray();
    const appliedIds = new Set(applied.map((r) => r._id));
    const pending = files.filter((f) => !appliedIds.has(f.id));

    if (pending.length === 0) {
      logger.info("No pending migrations.");
      return;
    }

    for (const entry of pending) {
      const migration = await loadMigration(entry);
      logger.info(`Applying ${entry.id}_${entry.name} — ${migration.description || "(no description)"}`);
      await runWithOptionalTransaction(async (session) => {
        await migration.up(db, { logger, session });
        await db.collection(COLLECTION).insertOne(
          {
            _id: entry.id,
            name: entry.name,
            appliedAt: new Date(),
            checksum: migration.checksum,
          },
          session ? { session } : undefined
        );
      });
      logger.info(`  → applied ${entry.id}_${entry.name}`);
    }
    logger.info(`Applied ${pending.length} migration(s).`);
  } finally {
    await disconnect();
  }
}

async function cmdDown(args) {
  productionGuard(args);
  const db = await connect();
  try {
    const applied = await db.collection(COLLECTION).find({}).sort({ _id: -1 }).limit(1).toArray();
    if (applied.length === 0) {
      logger.info("Nothing to revert.");
      return;
    }
    const last = applied[0];
    const files = await listMigrationFiles();
    const entry = files.find((f) => f.id === last._id);
    if (!entry) {
      throw new Error(
        `Applied migration ${last._id}_${last.name} has no corresponding file; cannot revert. ` +
          "Restore the file or manually delete the row from _migrations."
      );
    }
    const migration = await loadMigration(entry);
    logger.info(`Reverting ${entry.id}_${entry.name}`);
    await runWithOptionalTransaction(async (session) => {
      await migration.down(db, { logger, session });
      await db.collection(COLLECTION).deleteOne({ _id: entry.id }, session ? { session } : undefined);
    });
    logger.info(`Reverted ${entry.id}_${entry.name}.`);
  } finally {
    await disconnect();
  }
}

async function cmdCreate(rawName) {
  if (!rawName) {
    logger.error("Usage: node scripts/migrate.js create <name_in_snake_case>");
    process.exit(2);
  }
  const name = rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!name) {
    logger.error("Invalid migration name.");
    process.exit(2);
  }
  if (!existsSync(MIGRATIONS_DIR)) {
    await mkdir(MIGRATIONS_DIR, { recursive: true });
  }
  const existing = await listMigrationFiles();
  const nextId = String(
    existing.length === 0 ? 1 : parseInt(existing[existing.length - 1].id, 10) + 1
  ).padStart(3, "0");
  const filename = `${nextId}_${name}.js`;
  const full = path.join(MIGRATIONS_DIR, filename);

  const template = `/**
 * ${nextId}_${name}
 *
 * Write a one-line description below and fill in up()/down().
 *
 *   up(db, { logger, session })   — apply the change
 *   down(db, { logger, session }) — revert the change
 *
 * \`db\`      is a native MongoDB driver database handle.
 * \`session\` is a transaction session (may be null on standalone Mongo).
 *           Pass it into driver calls via { session } when present.
 */
export const description = "TODO: describe this migration";

export async function up(db, { logger, session } = {}) {
  // Example:
  // await db.collection("products").updateMany(
  //   { myNewField: { $exists: false } },
  //   { $set: { myNewField: null } },
  //   session ? { session } : undefined,
  // );
}

export async function down(db, { logger, session } = {}) {
  // Example:
  // await db.collection("products").updateMany(
  //   {},
  //   { $unset: { myNewField: "" } },
  //   session ? { session } : undefined,
  // );
}
`;
  await writeFile(full, template, "utf8");
  logger.info(`Created ${path.relative(process.cwd(), full)}`);
}

// --------------------------------------------------------------------------
// Entry point
// --------------------------------------------------------------------------

async function main() {
  const [, , cmd, ...rest] = process.argv;
  try {
    switch (cmd) {
      case "up":
      case undefined:
        await cmdUp(rest);
        break;
      case "down":
        await cmdDown(rest);
        break;
      case "status":
        await cmdStatus();
        break;
      case "create":
        await cmdCreate(rest[0]);
        break;
      default:
        logger.error(`Unknown command: ${cmd}`);
        logger.error("Usage: node scripts/migrate.js <up|down|status|create <name>> [--production]");
        process.exit(2);
    }
  } catch (err) {
    logger.error("Migration runner failed", { error: err?.message || String(err), stack: err?.stack });
    process.exit(1);
  }
}

main();
