/**
 * Store setup processor.
 *
 * Loads the tenant fresh from Mongo (NOT from job payload — that snapshot
 * is stale by retry time), builds scoped models, delegates to the shared
 * `initializeStoreSetup` service. Idempotency is enforced by the service
 * itself (it short-circuits when `setupStatus.status === "completed"`
 * and `force !== true`).
 *
 * Throwing from this function tells BullMQ the attempt failed so the
 * retry policy configured in queues.js applies. Returning normally marks
 * the job completed.
 */

import mongoose from "mongoose";
import { initializeStoreSetup } from "../../services/storeSetup.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import logger from "../../utils/logger.js";

export async function processStoreSetup(job) {
  const { tenantId, force } = job.data || {};
  if (!tenantId) throw new Error("storeSetup job missing tenantId");

  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    // Tenant was deleted between enqueue and execution — nothing to do.
    // Log and complete normally so the job doesn't keep retrying against
    // a missing row.
    logger.warn("storeSetup: tenant not found, skipping", { tenantId, jobId: job.id });
    return { skipped: true, reason: "tenant-not-found" };
  }

  const models = createScopedModels(mongoose.connection, tenant._id);
  const result = await initializeStoreSetup(tenant, models, { force: !!force });
  if (!result.success && !result.skipped) {
    throw new Error(result.error || "Store setup failed without error detail");
  }
  return result;
}
