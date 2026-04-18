import "dotenv/config";
import { connectAllDb, getAdminConnection } from "../utils/connectionManager.js";

/**
 * Verify theme switching properly deactivates previous theme
 */
async function verifyThemeSwitch() {
  console.log("=".repeat(60));
  console.log("Verifying Theme Switch Logic");
  console.log("=".repeat(60));

  try {
    // Initialize database connections
    console.log("\nInitializing database connections...");
    await connectAllDb();

    // Get admin database connection
    const adminDb = getAdminConnection();
    console.log("✓ Admin database connection ready\n");

    // Get models
    const Theme = adminDb.model("Theme");
    const Tenant = adminDb.model("Tenant");

    // Get themes
    const techStore = await Theme.findOne({ slug: "tech-store" });
    const eleganceJewelry = await Theme.findOne({ slug: "elegance-jewelry" });

    console.log("📊 Theme Statistics BEFORE:");
    console.log(`   Tech Store:`);
    console.log(`     - Total Installs: ${techStore.statistics.installCount}`);
    console.log(`     - Active Installs: ${techStore.statistics.activeInstalls}`);
    console.log(`   Elegance Jewelry:`);
    console.log(`     - Total Installs: ${eleganceJewelry.statistics.installCount}`);
    console.log(`     - Active Installs: ${eleganceJewelry.statistics.activeInstalls}`);

    // Count actual active installations
    const techStoreActive = await Tenant.countDocuments({
      "settings.activeTheme": "tech-store",
    });
    const eleganceActive = await Tenant.countDocuments({
      "settings.activeTheme": "elegance-jewelry",
    });

    console.log("\n📊 Actual Active Installations:");
    console.log(`   Tech Store: ${techStoreActive} tenants`);
    console.log(`   Elegance Jewelry: ${eleganceActive} tenants`);

    // Find discrepancies
    console.log("\n🔍 Discrepancy Check:");
    const techDiscrepancy = techStore.statistics.activeInstalls - techStoreActive;
    const eleganceDiscrepancy = eleganceJewelry.statistics.activeInstalls - eleganceActive;

    if (techDiscrepancy !== 0) {
      console.log(`   ⚠️  Tech Store: DB shows ${techStore.statistics.activeInstalls} active, but only ${techStoreActive} tenants have it active (diff: ${techDiscrepancy})`);
    } else {
      console.log(`   ✓ Tech Store: Counts match (${techStoreActive})`);
    }

    if (eleganceDiscrepancy !== 0) {
      console.log(`   ⚠️  Elegance Jewelry: DB shows ${eleganceJewelry.statistics.activeInstalls} active, but only ${eleganceActive} tenants have it active (diff: ${eleganceDiscrepancy})`);
    } else {
      console.log(`   ✓ Elegance Jewelry: Counts match (${eleganceActive})`);
    }

    // List tenants with their active themes
    console.log("\n🏪 Tenant Theme Status:");
    const tenants = await Tenant.find({}).select("name slug settings.activeTheme themeCustomization.themeId");

    for (const tenant of tenants) {
      const activeTheme = tenant.settings?.activeTheme || "None";
      const hasThemeId = !!tenant.themeCustomization?.themeId;
      const status = hasThemeId ? "✓" : "⚠️";
      console.log(`   ${status} ${tenant.name}: ${activeTheme}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("Verification Complete");
    console.log("=".repeat(60));
    console.log("\n💡 To fix discrepancies:");
    console.log("   1. Restart your server to load the updated code");
    console.log("   2. Try switching themes via the API");
    console.log("   3. Run this script again to verify\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Verification failed:");
    console.error("   ", error.message);
    if (error.stack) {
      console.error("\n", error.stack);
    }
    process.exit(1);
  }
}

// Run the verification
verifyThemeSwitch();
