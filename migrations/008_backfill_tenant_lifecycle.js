/**
 * 008_backfill_tenant_lifecycle
 *
 * Phase A of the platform-admin operating system introduced an explicit
 * `tenant.lifecycle` block (state + reason + history). Existing tenants only
 * carry the legacy flags (subscriptionStatus / isActive / suspendedAt /
 * deletionScheduledAt / deletedAt / setupStatus). Derive the state for every
 * tenant that has no lifecycle.state yet.
 *
 * Idempotent: only touches rows where `lifecycle.state` is missing.
 * Mirrors deriveLifecycleState() in services/tenantLifecycle.js — kept inline
 * (raw driver, no Mongoose) per the migration convention.
 */

export const description = "Backfill tenant.lifecycle.state from legacy status flags";

function derive(t) {
  if (t.deletedAt) return "archived";
  if (t.deletionScheduledAt) return "closed";
  if (t.subscriptionStatus === "suspended" || t.suspendedAt) return "suspended";
  if (t.subscriptionStatus === "cancelled" || t.isActive === false) return "closed";
  const setup = t.setupStatus?.status;
  if (setup && setup !== "completed") return "onboarding";
  return "active";
}

export async function up(db, { logger, session } = {}) {
  const tenants = db.collection("tenants");
  const cursor = tenants.find(
    { "lifecycle.state": null },
    { projection: { subscriptionStatus: 1, isActive: 1, suspendedAt: 1, deletionScheduledAt: 1, deletedAt: 1, "setupStatus.status": 1, suspensionReason: 1 }, session }
  );
  const BATCH = 500;
  const now = new Date();
  let n = 0;
  let ops = [];
  const flush = async () => {
    if (!ops.length) return;
    await tenants.bulkWrite(ops, { ordered: false, session });
    n += ops.length;
    ops = [];
  };
  for await (const t of cursor) {
    const state = derive(t);
    const reason = state === "suspended" ? t.suspensionReason || "Backfilled from legacy flags" : "Backfilled from legacy flags";
    ops.push({
      updateOne: {
        filter: { _id: t._id, "lifecycle.state": null },
        update: {
          $set: {
            lifecycle: {
              state,
              reason,
              changedAt: now,
              changedBy: "migration:008",
              history: [{ state, reason, changedAt: now, changedBy: "migration:008" }],
            },
          },
        },
      },
    });
    if (ops.length >= BATCH) await flush();
  }
  await flush();
  logger?.info?.(`migrate: backfilled lifecycle.state on ${n} tenant(s)`);
}

export async function down(db, { logger, session } = {}) {
  const r = await db
    .collection("tenants")
    .updateMany({ "lifecycle.changedBy": "migration:008" }, { $unset: { lifecycle: "" } }, { session });
  logger?.info?.(`migrate: removed backfilled lifecycle from ${r.modifiedCount} tenant(s)`);
}
