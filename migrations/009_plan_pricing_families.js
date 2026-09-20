/**
 * 009_plan_pricing_families
 *
 * Copy the legacy flat `price/currency/interval` on subscription plans into
 * `pricing.baseFee` and stamp `family` ("subscription"; a plan that already
 * references a commission policy becomes "commission"). Idempotent — rows
 * that already carry `pricing.baseFee.amount` are left alone.
 */
export const description = "Plan families + pricing.baseFee backfill (billing Phase A)";

export async function up(db, { logger } = {}) {
  const col = db.collection("subscriptionplans");
  const rows = await col.find({ "pricing.baseFee.amount": { $exists: false } }).toArray();
  let n = 0;
  for (const p of rows) {
    const policy = p.pricing?.commissionPolicyKey || null;
    await col.updateOne(
      { _id: p._id },
      {
        $set: {
          family: p.family || (policy ? "commission" : "subscription"),
          "pricing.baseFee": { amount: Number(p.price) || 0, currency: p.currency || "SDG", interval: p.interval || "month" },
          "pricing.trialDays": Number(p.pricing?.trialDays) || 0,
          "pricing.commissionPolicyKey": policy,
          "switching": p.switching || { allowSelfService: true, minimumTermDays: 0 },
        },
      }
    );
    n += 1;
  }
  logger?.info?.(`migrate: plan pricing backfilled for ${n} plan(s)`);
}

export async function down(db, { logger } = {}) {
  await db.collection("subscriptionplans").updateMany({}, { $unset: { family: "", pricing: "", switching: "", entitlements: "" } });
  logger?.info?.("migrate: plan pricing fields removed");
}
