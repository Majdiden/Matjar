import mongoose from "mongoose";
import config from "../config/index.js";

/**
 * Migration script to fix tenant domains
 * Updates all tenant fullDomain fields to use the correct base domain
 */
async function fixTenantDomains() {
  try {
    console.log("Connecting to admin database...");
    await mongoose.connect(config.adminDbUri);
    console.log("Connected successfully");

    const db = mongoose.connection.db;
    const tenantsCollection = db.collection("tenants");

    console.log("\nFetching all tenants...");
    const tenants = await tenantsCollection.find({}).toArray();
    console.log(`Found ${tenants.length} tenants`);

    if (tenants.length === 0) {
      console.log("No tenants to update");
      process.exit(0);
    }

    console.log(`\nUpdating domains to use base domain: ${config.baseDomain}`);

    let updated = 0;
    for (const tenant of tenants) {
      const subdomainName = tenant.domains?.subdomain?.name;

      if (!subdomainName) {
        console.log(`⚠ Tenant "${tenant.name}" has no subdomain name, skipping`);
        continue;
      }

      const newFullDomain = `${subdomainName}.${config.baseDomain}`;
      const oldFullDomain = tenant.domains?.subdomain?.fullDomain;

      if (oldFullDomain === newFullDomain) {
        console.log(`✓ Tenant "${tenant.name}" already has correct domain: ${newFullDomain}`);
        continue;
      }

      console.log(`Updating "${tenant.name}":`);
      console.log(`  Old: ${oldFullDomain || 'not set'}`);
      console.log(`  New: ${newFullDomain}`);

      await tenantsCollection.updateOne(
        { _id: tenant._id },
        {
          $set: {
            "domains.subdomain.fullDomain": newFullDomain,
            domain: newFullDomain, // Update legacy field too
            updatedAt: new Date(),
          },
        }
      );

      updated++;
    }

    console.log(`\n✅ Successfully updated ${updated} tenant(s)`);

    // Show final state
    console.log("\nFinal tenant domains:");
    const updatedTenants = await tenantsCollection.find({}).toArray();
    updatedTenants.forEach(t => {
      console.log(`  - ${t.name}: ${t.domains?.subdomain?.fullDomain}`);
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
    process.exit(0);
  }
}

fixTenantDomains();
