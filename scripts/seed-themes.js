import "dotenv/config";
import mongoose from "mongoose";

/**
 * Seed / re-sync the theme catalog from the built theme manifests.
 *
 * Usage:  node scripts/seed-themes.js
 *
 * This script no longer carries a hand-written theme array (audit 2.4).
 * The single source of truth for catalog metadata is each theme's built
 * manifest (`storefront-themes/<slug>/dist/manifest.json`); this script
 * is a thin trigger of the same `syncThemeCatalog()` that runs at server
 * boot (see index.js / services/themeCatalogSync.js). Run it after
 * `scripts/build-themes.sh` when you want to refresh the catalog without
 * restarting the server. Idempotent — safe to run repeatedly.
 *
 * DB-owned fields (status, isDefault, statistics, pricing) are preserved
 * on existing rows; identity + presentation come from the manifests.
 *
 * For a destructive reset use `scripts/clear-themes.js` first.
 */

const MONGO_URI =
  process.env.DB_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/matjar";

async function main() {
  console.log("=".repeat(50));
  console.log("Syncing theme catalog from built manifests");
  console.log("=".repeat(50));

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB\n");

    // Register models the sync's repository layer resolves via
    // mongoose.model(...) — same registration path the server uses.
    const { registerAllModels } = await import("../utils/initDbConnection.js");
    registerAllModels(mongoose.connection);

    // Importing the sync service loads the manifest registry, which
    // scans storefront-themes/*/dist/manifest.json at module init.
    const { syncThemeCatalog } = await import("../services/themeCatalogSync.js");
    const { synced, deactivated } = await syncThemeCatalog();

    for (const slug of synced) console.log(`  ✓ ${slug}`);
    if (deactivated > 0) {
      console.log(`\n  Marked ${deactivated} theme(s) inactive (manifest missing)`);
    }
    console.log(`\n✅ Synced ${synced.length} theme(s) from manifests.`);
  } catch (err) {
    console.error("Error syncing themes:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
