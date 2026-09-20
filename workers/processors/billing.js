/**
 * Billing period-close processor (monthly cron, see scheduleBillingPeriodCron).
 * Delegates to the same routine the operator's POST /billing/run-period uses,
 * so cron and manual runs cannot drift. `job.data.periodKey` overrides the
 * default (previous month) for replays. The run is audited as a system actor.
 */
import logger from "../../utils/logger.js";
import { runBillingPeriod } from "../../controllers/platform/billing.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";

export async function processBilling(job) {
  const result = await runBillingPeriod(job?.data?.periodKey);
  await recordPlatformAudit(null, {
    action: "billing.period.run",
    resourceType: "BillingPeriod",
    resourceId: result.periodKey,
    metadata: { ...result, errors: result.errors.slice(0, 20), source: "cron", jobId: job?.id || null },
  });
  logger.info("Billing period closed", { ...result, errors: result.errors.length });
  return result;
}
