/**
 * Tenant-lifecycle sweep processor.
 *
 * Runs every 15 minutes (see scheduleTenantLifecycleSweep). Responsibilities:
 *   1. Auto-purge — any tenant whose deletionScheduledAt has passed AND
 *      deletedAt is not yet set gets purged. This enforces the grace
 *      window without relying on a platform admin remembering to press
 *      the button.
 *   2. Export expiry — TenantExport rows past `expiresAt` with
 *      status=ready flip to "expired" and the storage file is deleted
 *      so we don't pay for cold storage forever.
 *
 * Bounded per-tick — processes at most 10 purges + 50 expiries per run
 * so a backlog can't lock up the worker.
 */

import mongoose from "mongoose";
import logger from "../../utils/logger.js";
import { purgeTenant } from "../../services/tenantLifecycle.js";
import { deleteFile } from "../../services/providers/storage.js";

const MAX_PURGES_PER_TICK = 10;
const MAX_EXPIRIES_PER_TICK = 50;

export async function processTenantLifecycle() {
  const Tenant = mongoose.model("Tenant");
  const TenantExport = mongoose.model("TenantExport");
  const now = new Date();

  // --- 1. Purge past-grace tenants --------------------------------
  const due = await Tenant.find({
    deletionScheduledAt: { $lte: now },
    deletedAt: null,
  })
    .limit(MAX_PURGES_PER_TICK)
    .select("_id name")
    .lean();

  for (const t of due) {
    try {
      await purgeTenant({ tenantId: t._id, force: false });
    } catch (err) {
      logger.error("Lifecycle sweep: purge failed", { tenantId: String(t._id), error: err.message });
    }
  }

  // --- 2. Expire old exports --------------------------------------
  const expired = await TenantExport.find({
    status: "ready",
    expiresAt: { $lte: now },
  })
    .limit(MAX_EXPIRIES_PER_TICK)
    .select("_id storageKey");

  for (const row of expired) {
    if (row.storageKey) {
      await deleteFile(row.storageKey).catch((err) =>
        logger.warn("Lifecycle sweep: export file delete failed", { id: String(row._id), error: err.message })
      );
    }
    row.status = "expired";
    row.url = null;
    await row.save().catch(() => {});
  }

  logger.info("Lifecycle sweep tick", { purged: due.length, expired: expired.length });
  return { purged: due.length, expired: expired.length };
}
