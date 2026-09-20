/**
 * Storefront health probe (repeatable, every 6h — see scheduleStorefrontHealthCron).
 * Probes every live tenant's primary host with bounded concurrency and upserts
 * one StorefrontHealth row per tenant. Only platform-registered hosts are ever
 * contacted; redirects are never followed off-host.
 */
import logger from "../../utils/logger.js";
import { checkAllStorefronts } from "../../services/platform/storefront.js";

export async function processStorefrontHealth(job) {
  const summary = await checkAllStorefronts({ concurrency: 3 });
  logger.info("Storefront health sweep done", { ...summary, jobId: job?.id || null });
  return summary;
}
