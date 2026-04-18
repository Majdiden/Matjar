import "dotenv/config";
import { connectAllDb, getAdminConnection } from "../utils/connectionManager.js";

/**
 * Clear all themes from the admin database
 */
async function clearThemes() {
  console.log("=".repeat(60));
  console.log("Clearing All Themes");
  console.log("=".repeat(60));

  try {
    // Initialize all database connections
    console.log("\nInitializing database connections...");
    await connectAllDb();

    // Get admin database connection
    const adminDb = getAdminConnection();
    console.log("✓ Admin database connection ready");

    // Get Theme model
    const Theme = adminDb.model("Theme");

    // Count existing themes
    const count = await Theme.countDocuments();
    console.log(`\nFound ${count} theme(s) to delete`);

    if (count === 0) {
      console.log("\nNo themes to delete.");
      process.exit(0);
    }

    // Delete all themes
    const result = await Theme.deleteMany({});
    console.log(`\n✅ Deleted ${result.deletedCount} theme(s)`);

    console.log("\n" + "=".repeat(60));
    console.log("Themes cleared successfully");
    console.log("=".repeat(60));
    console.log("\nYou can now run: node scripts/seed-themes.js\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Failed to clear themes:");
    console.error("   ", error.message);
    if (error.stack) {
      console.error("\n", error.stack);
    }
    process.exit(1);
  }
}

// Run the script
clearThemes();
