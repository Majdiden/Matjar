/**
 * Domain verification processor.
 *
 * Re-runs DNS verification for a tenant's custom domain. The lookup
 * can take 5-30s depending on the resolver chain, which is precisely
 * why it has to run off the request path.
 *
 * The actual verification logic lives in services/domain.js — this
 * processor is the queue adapter. On success it flips
 * `customDomain.isVerified = true`; on failure it bumps an attempt
 * counter and schedules a retry through BullMQ's backoff.
 *
 * SSL issuance is NOT enqueued here — Cloudflare for SaaS handles
 * certificates at the edge via the custom-hostname API (registered
 * in services/domain.js::addCustomDomainService). There is nothing
 * for us to provision once the DNS record is verified.
 */

import logger from "../../utils/logger.js";

// Retry policy: overridden per-enqueue in services/jobs/index.js
// (enqueueDomainVerification) to attempts=10 × exponential backoff starting
// at 60s — a window of roughly 8 hours, which matches real-world DNS
// propagation delays. Callers: controllers/domain.js::verifyCustomDomain
// fires an async re-verification when the sync attempt returns pending.

export async function processDomainVerification(job) {
  const { tenantId, domain } = job.data || {};
  if (!tenantId || !domain) throw new Error("domain-verify job requires tenantId + domain");

  // Lazy-load the service so workers that never process domain jobs
  // don't pull the whole dependency tree.
  const { verifyCustomDomainService } = await import("../../services/domain.js");
  if (typeof verifyCustomDomainService !== "function") {
    logger.warn("domain verification service unavailable", { tenantId, domain });
    return { skipped: true, reason: "service-not-implemented" };
  }

  // verifyCustomDomainService loads the tenant by id, runs the TXT
  // lookup against the embedded customDomain.name, and drives the full
  // Domain registry state machine (markOwnershipVerified +
  // provisionVerifiedDomain). We pass only tenantId — the `domain`
  // field in job.data is retained for logging/idempotency.
  const result = await verifyCustomDomainService(tenantId);
  if (!result?.verified && !result?.ownershipVerified) {
    throw new Error(result?.message || `DNS not yet propagated for ${domain}`);
  }

  return {
    verified: Boolean(result.verified),
    ownershipVerified: Boolean(result.ownershipVerified),
    domain,
    registryStatus: result.registryStatus || null,
    sslStatus: result.sslStatus || null,
  };
}
