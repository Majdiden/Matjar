import dns from "node:dns/promises";
import config from "../config/index.js";

/**
 * DNS target verification.
 *
 * Given a custom hostname and the platform's expected edge target,
 * resolve the hostname's CNAME or A record and compare. This runs
 * after TXT ownership verification succeeds, and before SSL
 * provisioning kicks off — a cert for a domain that doesn't actually
 * point at us is useless.
 *
 * Returns:
 *   { ok: true, resolved }                   — target matches
 *   { ok: false, reason, resolved? }         — mismatch or lookup error
 */

export function getExpectedDnsTarget(kind) {
  const expectedA = config.platformEdgeIps;
  const expectedCname = (config.platformEdgeCname || "").toLowerCase();
  // custom_apex → A/ALIAS to PLATFORM_EDGE_IP
  // custom_subdomain → CNAME to PLATFORM_EDGE_CNAME
  if (kind === "custom_apex") {
    return {
      targetType: "A",
      expectedTarget: expectedA[0] || null,
      allTargets: expectedA,
    };
  }
  return {
    targetType: "CNAME",
    expectedTarget: expectedCname || null,
    allTargets: expectedCname ? [expectedCname] : [],
  };
}

/**
 * Resolve the hostname's DNS target and compare against what the
 * platform expects. In dev/test (no PLATFORM_EDGE_* env vars set)
 * this returns `{ ok: true, skipped: true }` so the state machine
 * still progresses on localhost.
 */
export async function checkDnsTarget(hostname, kind) {
  const expected = getExpectedDnsTarget(kind);

  if (!expected.expectedTarget) {
    // In production the platform edge target MUST be configured —
    // skipping DNS verification there would let merchants "verify"
    // domains that don't point at us, and we'd then try to issue
    // certs for hostnames we can't serve. Hard-fail instead.
    if (config.isProduction) {
      return {
        ok: false,
        reason: "edge_target_not_configured",
        error: "PLATFORM_EDGE_CNAME/PLATFORM_EDGE_IP must be set in production",
        expected,
      };
    }
    // Dev/test path: no edge target configured. We return ok so the
    // state machine progresses, but flag skipped so the caller can
    // record why in the Domain.dns subdoc.
    return { ok: true, skipped: true, expected };
  }

  try {
    if (expected.targetType === "CNAME") {
      const records = await dns.resolveCname(hostname);
      const normalized = records.map((r) => r.toLowerCase().replace(/\.$/, ""));
      const match = normalized.some((r) => r === expected.expectedTarget);
      return match
        ? { ok: true, resolved: normalized, expected }
        : { ok: false, reason: "cname_mismatch", resolved: normalized, expected };
    }

    if (expected.targetType === "A") {
      const records = await dns.resolve4(hostname);
      const match = records.some((r) => expected.allTargets.includes(r));
      return match
        ? { ok: true, resolved: records, expected }
        : { ok: false, reason: "a_record_mismatch", resolved: records, expected };
    }

    return { ok: false, reason: "unknown_target_type", expected };
  } catch (err) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
      return { ok: false, reason: "dns_not_found", error: err.code, expected };
    }
    return { ok: false, reason: "dns_lookup_failed", error: err.code || err.message, expected };
  }
}
