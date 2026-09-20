/**
 * Nightly usage snapshot processor (see scheduleUsageSnapshotCron). Walks
 * every non-deleted tenant and writes one TenantUsageSnapshot each; per-tenant
 * failures are collected, never fatal. Audited as a system actor.
 */
import logger from "../../utils/logger.js";
import { snapshotAllTenants } from "../../services/platform/usage.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";

export async function processUsage(job) {
  const result = await snapshotAllTenants();
  await recordPlatformAudit(null, {
    action: "usage.snapshot.run",
    resourceType: "TenantUsageSnapshot",
    metadata: { tenants: result.tenants, ok: result.ok, errors: result.errors.slice(0, 20), jobId: job?.id || null },
  });
  logger.info("Usage snapshots written", { tenants: result.tenants, ok: result.ok, errors: result.errors.length });
  return result;
}
