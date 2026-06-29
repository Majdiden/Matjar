import "dotenv/config";
import mongoose from "mongoose";
import subscriptionPlanSchema from "../schemas/subscriptionPlan.js";

/**
 * Seed the default subscription plans into the admin database.
 *
 * Usage:  node scripts/seed-plans.js
 *
 * Connects via DB_URI / MONGODB_URI / MONGO_URI (falls back to localhost).
 * Upserts by `key` so it's safe to run repeatedly.
 */

const MONGO_URI =
  process.env.DB_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/matjar";

export const plans = [
  {
    key: "trial",
    name: "Trial",
    description: "Kick the tyres free for 14 days. Everything you need to launch a first store.",
    price: 0,
    currency: "SDG",
    interval: "month",
    features: ["1 staff account", "Up to 50 products", "Subdomain storefront", "Email support"],
    limits: { maxProducts: 50, maxStaff: 1 },
    isActive: true,
    sortOrder: 0,
  },
  {
    key: "starter",
    name: "Starter",
    description: "For new merchants finding their feet. Sensible limits at a friendly price.",
    price: 4900,
    currency: "SDG",
    interval: "month",
    features: ["3 staff accounts", "Up to 500 products", "Subdomain storefront", "Standard support"],
    limits: { maxProducts: 500, maxStaff: 3 },
    isActive: true,
    sortOrder: 1,
  },
  {
    key: "pro",
    name: "Pro",
    description: "For growing stores that need custom domains and room to scale.",
    price: 14900,
    currency: "SDG",
    interval: "month",
    features: [
      "10 staff accounts",
      "Up to 10,000 products",
      "Custom domain",
      "Priority support",
      "Advanced analytics",
    ],
    limits: { maxProducts: 10000, maxStaff: 10 },
    isActive: true,
    sortOrder: 2,
  },
];

async function seedPlans() {
  console.log("=".repeat(50));
  console.log("Seeding Subscription Plans");
  console.log("=".repeat(50));

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB\n");

    const SubscriptionPlan =
      mongoose.connection.models.SubscriptionPlan ||
      mongoose.connection.model("SubscriptionPlan", subscriptionPlanSchema);

    for (const planData of plans) {
      const result = await SubscriptionPlan.findOneAndUpdate(
        { key: planData.key },
        { $set: planData },
        { upsert: true, new: true }
      );
      console.log(`  ✓ ${result.name} — ${result.key} (${result.currency} ${result.price}/${result.interval})`);
    }

    console.log(`\n✅ Seeded ${plans.length} plans successfully.`);
  } catch (err) {
    console.error("Error seeding plans:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedPlans();
