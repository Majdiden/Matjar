import mongoose from "mongoose";
import config from "./config/index.js";
import tenantSchema from "./schemas/tenant.js";

const debugTenants = async () => {
  try {
    await mongoose.connect(config.adminDbUri);
    console.log("Connected to Admin DB");

    const Tenant = mongoose.model("Tenant", tenantSchema);
    const tenants = await Tenant.find({});

    console.log(`Found ${tenants.length} tenants:`);
    tenants.forEach((t) => {
      console.log({
        name: t.name,
        slug: t.slug,
        domain: t.domain,
        subdomain: t.domains?.subdomain,
        customDomain: t.domains?.customDomain,
      });
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

debugTenants();
