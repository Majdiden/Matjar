#!/usr/bin/env node

/* =========================================================================
 * MIGRATED TO migrations/004_shared_db_baseline_marker.js on 2026-04-18
 * — kept for reference, do NOT run directly.
 *
 * This is the historical per-tenant-DB → shared-DB cutover. It ran once
 * against the legacy `OLD_ADMIN_DB_URI` during the platform migration
 * window and is no longer executable on modern environments — the old
 * admin DB and tenant DBs it sourced from are gone.
 *
 * The tracked migration (004) is a no-op marker whose only job is to
 * record in the `_migrations` collection that this environment has
 * cleared the cutover. Use:
 *
 *     npm run migrate:status
 *     npm run migrate
 *
 * This file is retained for historical context only.
 * ========================================================================= */

/**
 * Migration Script: Per-Tenant Databases → Shared Database
 *
 * This script migrates data from the old database-per-tenant architecture
 * to the new shared database with tenantId discriminator field.
 *
 * Usage:
 *   node scripts/migrate-to-shared-db.js
 *
 * Environment variables:
 *   OLD_ADMIN_DB_URI  - URI of the old admin database (contains tenant records with dbUri)
 *   DB_URI            - URI of the new shared database (target)
 *   DRY_RUN           - Set to "true" to preview without writing (default: true)
 *
 * What it does:
 *   1. Connects to the old admin DB, reads all tenants (which have dbUri fields)
 *   2. For each tenant, connects to their individual database
 *   3. Copies all collections into the shared DB, injecting tenantId on every document
 *   4. Migrates tenant records (stripping dbUri field)
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const OLD_ADMIN_DB_URI = process.env.OLD_ADMIN_DB_URI;
const NEW_DB_URI = process.env.DB_URI;
const DRY_RUN = process.env.DRY_RUN !== "false"; // default true

// Collections that exist in each tenant database
const TENANT_COLLECTIONS = [
  "users",
  "products",
  "categories",
  "orders",
  "carts",
  "reviews",
  "wishlists",
  "discounts",
  "payments",
  "inventories",
  "promotions",
  "taxes",
  "shippings",
  "supporttickets",
  "currencies",
  "producti18ns",
  "analytics",
  "webhooks",
];

async function migrate() {
  console.log("=== Shared DB Migration ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log();

  if (!OLD_ADMIN_DB_URI) {
    console.error("Error: OLD_ADMIN_DB_URI environment variable is required.");
    console.error("This should point to the old admin database that contains tenant records with dbUri fields.");
    process.exit(1);
  }

  if (!NEW_DB_URI) {
    console.error("Error: DB_URI environment variable is required.");
    process.exit(1);
  }

  // Connect to old admin DB
  console.log("Connecting to old admin database...");
  const oldAdminConn = await mongoose.createConnection(OLD_ADMIN_DB_URI).asPromise();
  console.log("Connected to old admin DB.");

  // Connect to new shared DB
  console.log("Connecting to new shared database...");
  const newConn = await mongoose.createConnection(NEW_DB_URI).asPromise();
  console.log("Connected to new shared DB.");

  // Fetch all tenants from old admin DB
  const oldTenants = await oldAdminConn.db.collection("tenants").find({}).toArray();
  console.log(`Found ${oldTenants.length} tenants to migrate.\n`);

  const stats = {
    tenants: 0,
    totalDocuments: 0,
    errors: [],
    collectionCounts: {},
  };

  for (const tenant of oldTenants) {
    console.log(`\n--- Migrating tenant: ${tenant.companyName || tenant.name || tenant._id} ---`);

    const tenantId = tenant._id;
    const tenantDbUri = tenant.dbUri;

    if (!tenantDbUri) {
      console.log(`  Skipping: no dbUri found (may already be migrated).`);
      continue;
    }

    let tenantConn;
    try {
      tenantConn = await mongoose.createConnection(tenantDbUri).asPromise();
    } catch (err) {
      console.error(`  Error connecting to tenant DB: ${err.message}`);
      stats.errors.push({ tenant: tenantId.toString(), error: err.message });
      continue;
    }

    // Migrate each collection
    for (const collName of TENANT_COLLECTIONS) {
      try {
        const sourceCollection = tenantConn.db.collection(collName);
        const count = await sourceCollection.countDocuments();

        if (count === 0) {
          continue;
        }

        console.log(`  ${collName}: ${count} documents`);

        if (!DRY_RUN) {
          const targetCollection = newConn.db.collection(collName);
          const cursor = sourceCollection.find({});
          const batch = [];
          const BATCH_SIZE = 500;

          while (await cursor.hasNext()) {
            const doc = await cursor.next();
            // Inject tenantId into every document
            doc.tenantId = tenantId;
            batch.push(doc);

            if (batch.length >= BATCH_SIZE) {
              await targetCollection.insertMany(batch, { ordered: false });
              batch.length = 0;
            }
          }

          // Insert remaining
          if (batch.length > 0) {
            await targetCollection.insertMany(batch, { ordered: false });
          }
        }

        stats.totalDocuments += count;
        stats.collectionCounts[collName] = (stats.collectionCounts[collName] || 0) + count;
      } catch (err) {
        console.error(`  Error migrating ${collName}: ${err.message}`);
        stats.errors.push({ tenant: tenantId.toString(), collection: collName, error: err.message });
      }
    }

    // Migrate the tenant record itself (without dbUri)
    if (!DRY_RUN) {
      const { dbUri, ...tenantWithoutDbUri } = tenant;
      try {
        await newConn.db.collection("tenants").replaceOne(
          { _id: tenantId },
          tenantWithoutDbUri,
          { upsert: true }
        );
      } catch (err) {
        console.error(`  Error migrating tenant record: ${err.message}`);
        stats.errors.push({ tenant: tenantId.toString(), collection: "tenants", error: err.message });
      }
    }

    stats.tenants++;

    // Close tenant connection
    await tenantConn.close();
  }

  // Print summary
  console.log("\n\n=== Migration Summary ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Tenants processed: ${stats.tenants}`);
  console.log(`Total documents: ${stats.totalDocuments}`);
  console.log("\nPer-collection counts:");
  for (const [coll, count] of Object.entries(stats.collectionCounts)) {
    console.log(`  ${coll}: ${count}`);
  }

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.forEach((e) => console.log(`  - ${JSON.stringify(e)}`));
  } else {
    console.log("\nNo errors.");
  }

  if (DRY_RUN) {
    console.log("\nThis was a DRY RUN. To execute for real, set DRY_RUN=false:");
    console.log("  DRY_RUN=false node scripts/migrate-to-shared-db.js");
  }

  // Cleanup
  await oldAdminConn.close();
  await newConn.close();
  console.log("\nDone.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
