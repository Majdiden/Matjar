import "dotenv/config";
import { connectAllDb, getAdminConnection } from "../utils/connectionManager.js";

/**
 * Test theme activation
 * This script verifies that theme activation is working properly
 */
async function testThemeActivation() {
  console.log("=".repeat(60));
  console.log("Testing Theme Activation");
  console.log("=".repeat(60));

  try {
    // Initialize database connections
    console.log("\nInitializing database connections...");
    await connectAllDb();

    // Get admin database connection
    const adminDb = getAdminConnection();
    console.log("✓ Admin database connection ready");

    // Get models
    const Theme = adminDb.model("Theme");
    const Tenant = adminDb.model("Tenant");

    // List available themes
    console.log("\n📦 Available Themes:");
    const themes = await Theme.find({ status: "active" });
    themes.forEach((theme, index) => {
      console.log(`   ${index + 1}. ${theme.name} (${theme.slug})`);
      console.log(`      - Status: ${theme.status}`);
      console.log(`      - Default: ${theme.isDefault ? "Yes" : "No"}`);
      console.log(`      - Install Count: ${theme.statistics.installCount}`);
    });

    // List tenants and their active themes
    console.log("\n🏪 Tenants and Active Themes:");
    const tenants = await Tenant.find({});
    for (const tenant of tenants) {
      console.log(`\n   Tenant: ${tenant.name} (${tenant.slug})`);
      console.log(`   - Active Theme: ${tenant.settings.activeTheme || "None"}`);
      console.log(`   - Theme ID: ${tenant.themeCustomization?.themeId || "None"}`);
      console.log(`   - Last Published: ${tenant.themeCustomization?.lastPublishedAt || "Never"}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("Test completed successfully");
    console.log("=".repeat(60));

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error("   ", error.message);
    if (error.stack) {
      console.error("\n", error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testThemeActivation();
