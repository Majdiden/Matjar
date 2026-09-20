/**
 * 012_backfill_trials
 *
 * Tenants created before trials were tracked per tenant (N5) have no
 * `billing.trialUsedAt`. For tenants whose CURRENT plan carries trialDays > 0
 * and who have never been stamped, treat the subscription start as the trial
 * start: trialUsedAt = subscriptionStartDate, trialEndsAt = + trialDays.
 * Tenants on plans without a trial are left untouched (they get a trial the
 * first time they move to a trial plan). Idempotent.
 */
export const description = "Backfill tenant.billing.trialUsedAt/trialEndsAt from subscriptionStartDate";

export async function up(db, { logger } = {}) {
  const plans = await db.collection("subscriptionplans").find({ "pricing.trialDays": { $gt: 0 } }).project({ key: 1, "pricing.trialDays": 1, family: 1 }).toArray();
  let n = 0;
  for (const p of plans) {
    if (p.family === "commission") continue;
    const days = Number(p.pricing?.trialDays) || 0;
    const tenants = await db.collection("tenants").find({ subscriptionPlan: p.key, "billing.trialUsedAt": { $in: [null, undefined] } }).project({ subscriptionStartDate: 1, createdAt: 1 }).toArray();
    for (const t of tenants) {
      const start = t.subscriptionStartDate || t.createdAt || new Date();
      await db.collection("tenants").updateOne(
        { _id: t._id },
        { $set: { "billing.trialUsedAt": start, "billing.trialEndsAt": new Date(new Date(start).getTime() + days * 86400000) } }
      );
      n += 1;
    }
  }
  logger?.info?.(`migrate: trial stamps backfilled for ${n} tenant(s)`);
}

export async function down(db, { logger } = {}) {
  await db.collection("tenants").updateMany({}, { $unset: { "billing.trialUsedAt": "", "billing.trialEndsAt": "" } });
  logger?.info?.("migrate: trial stamps removed");
}
