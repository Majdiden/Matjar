import "dotenv/config";
import mongoose from "mongoose";
import { registerAllModels } from "../utils/initDbConnection.js";
import { createScopedModels } from "../utils/scopedModel.js";

/**
 * Backfill default PaymentMethod docs for every existing tenant.
 *
 * Idempotent: skips any tenant that already has at least one PaymentMethod
 * configured. Safe to run repeatedly.
 *
 * Usage:  node scripts/seed-payment-methods.js
 */

const MONGO_URI =
  process.env.DB_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/matjar";

// Soft-launch default: COD only. Gateway methods (Stripe) are parked
// behind STRIPE_ENABLED at the platform level and aren't installable
// via the merchant dashboard. The canonical runtime seed
// (`services/storeSetup.js::seedDefaultPaymentMethods`) also seeds
// "manual-transfer" with the Bankak/Fawry/OCash provider templates —
// this legacy script stays minimal on purpose so the runtime
// self-healer remains the single source of truth.
const DEFAULTS = [
  {
    code: "cod",
    type: "cod",
    label: "Cash on Delivery",
    description: "Pay when your order arrives.",
    providerLogos: ["cod"],
    icon: "cod",
    enabled: true,
    order: 1,
    customerFields: [],
  },
];

async function seedPaymentMethods() {
  console.log("=".repeat(50));
  console.log("Backfilling default PaymentMethods per tenant");
  console.log("=".repeat(50));

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB\n");

    // Ensure all schemas are registered on the default connection before
    // we start building scoped models.
    registerAllModels(mongoose.connection);

    const Tenant = mongoose.connection.model("Tenant");
    const tenants = await Tenant.find({}, "_id name slug").lean();
    console.log(`Found ${tenants.length} tenant(s)\n`);

    let seededCount = 0;
    let skippedCount = 0;

    for (const tenant of tenants) {
      const models = createScopedModels(mongoose.connection, tenant._id);
      const existing = await models.PaymentMethod.countDocuments({});
      if (existing > 0) {
        console.log(`  - ${tenant.name || tenant.slug}: skipped (${existing} method(s) already)`);
        skippedCount++;
        continue;
      }
      for (const method of DEFAULTS) {
        await models.PaymentMethod.create(method);
      }
      console.log(`  ✓ ${tenant.name || tenant.slug}: seeded ${DEFAULTS.length} defaults`);
      seededCount++;
    }

    console.log(`\n✅ Done. Seeded ${seededCount}, skipped ${skippedCount}.`);
  } catch (err) {
    console.error("Error seeding payment methods:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedPaymentMethods();
