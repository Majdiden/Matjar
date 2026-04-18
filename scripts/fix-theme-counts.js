import "dotenv/config";
import { connectAllDb, getAdminConnection } from "../utils/connectionManager.js";

/**
 * Fix theme install counts to match actual active installations
 */
async function fixThemeCounts() {
  console.log("=".repeat(60));
  console.log("Fixing Theme Install Counts");
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

    // Get all themes
    const themes = await Theme.find({});

    console.log("🔧 Fixing theme counts...\n");

    for (const theme of themes) {
      // Count actual active installations
      const actualActiveCount = await Tenant.countDocuments({
        "settings.activeTheme": theme.slug,
      });

      const currentActiveCount = theme.statistics.activeInstalls;
      const difference = currentActiveCount - actualActiveCount;

      console.log(`📊 ${theme.name} (${theme.slug}):`);
      console.log(`   - Current active installs in DB: ${currentActiveCount}`);
      console.log(`   - Actual active tenants: ${actualActiveCount}`);

      if (difference !== 0) {
        console.log(`   ⚠️  Discrepancy: ${difference} (fixing...)`);

        // Update the theme's activeInstalls to match reality
        await Theme.findByIdAndUpdate(theme._id, {
          $set: {
            "statistics.activeInstalls": actualActiveCount,
          },
        });

        console.log(`   ✓ Fixed! Set activeInstalls to ${actualActiveCount}`);
      } else {
        console.log(`   ✓ Already correct (${actualActiveCount})`);
      }

      console.log("");
    }

    // Verify the fix
    console.log("=".repeat(60));
    console.log("Verification - After Fix:");
    console.log("=".repeat(60));

    const techStore = await Theme.findOne({ slug: "tech-store" });
    const eleganceJewelry = await Theme.findOne({ slug: "elegance-jewelry" });

    const techStoreActive = await Tenant.countDocuments({
      "settings.activeTheme": "tech-store",
    });
    const eleganceActive = await Tenant.countDocuments({
      "settings.activeTheme": "elegance-jewelry",
    });

    console.log("\n📊 Theme Statistics AFTER FIX:");
    console.log(`   Tech Store:`);
    console.log(`     - Active Installs: ${techStore.statistics.activeInstalls} (actual: ${techStoreActive})`);
    console.log(`   Elegance Jewelry:`);
    console.log(`     - Active Installs: ${eleganceJewelry.statistics.activeInstalls} (actual: ${eleganceActive})`);

    const allMatch =
      techStore.statistics.activeInstalls === techStoreActive &&
      eleganceJewelry.statistics.activeInstalls === eleganceActive;

    if (allMatch) {
      console.log("\n✅ All theme counts are now accurate!");
    } else {
      console.log("\n⚠️  Some discrepancies remain - please investigate");
    }

    console.log("\n" + "=".repeat(60));
    console.log("Fix Complete");
    console.log("=".repeat(60));
    console.log("\n💡 Next steps:");
    console.log("   1. Restart your server");
    console.log("   2. Theme switching will now work correctly");
    console.log("   3. Old theme will be deactivated when new theme is activated\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fix failed:");
    console.error("   ", error.message);
    if (error.stack) {
      console.error("\n", error.stack);
    }
    process.exit(1);
  }
}

// Run the fix
fixThemeCounts();
