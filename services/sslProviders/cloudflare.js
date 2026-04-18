/**
 * Cloudflare for SaaS — Custom Hostnames adapter.
 *
 * Cloudflare is the SaaS-industry-standard path for multi-tenant TLS:
 * the platform sits behind Cloudflare, merchants CNAME their domain to
 * our fallback origin, and Cloudflare terminates TLS + auto-issues
 * DV certs against the inbound SNI. We never touch PEM bytes; we just
 * tell Cloudflare "this hostname belongs to us now" via the Custom
 * Hostnames API.
 *
 * Docs: https://developers.cloudflare.com/api/operations/custom-hostname-for-a-zone-create-custom-hostname
 *
 * Required env:
 *   CLOUDFLARE_API_TOKEN  — API token with Zone:SSL & Certificates:Edit on the zone
 *   CLOUDFLARE_ZONE_ID    — the platform's zone id that hosts the fallback origin
 *
 * Env-var names match Cloudflare's official docs.
 *
 * Status contract (see sslProviders/index.js for the shared interface):
 *
 *   issueCertificate({hostname, domainId}) →
 *     { ok: true,  status: "issued",  issuedAt, expiresAt, providerRef }
 *     { ok: true,  status: "pending", providerRef }            // async, poll again
 *     { ok: false, status: "failed",  error, providerRef? }    // hard failure
 *
 * The orchestrator (services/domainRegistry.js#provisionVerifiedDomain)
 * treats "pending" as a legitimate in-flight state and leaves the row
 * in PROVISIONING_SSL — the merchant (or a future background worker)
 * drives the next poll by hitting enableSSL again.
 */

import mongoose from "mongoose";
import logger from "../../utils/logger.js";
import config from "../../config/index.js";

const API_BASE = "https://api.cloudflare.com/client/v4";

// Short foreground poll window. Cloudflare's issuance path is
// typically seconds for DNS/HTTP-01 but can be minutes for domains
// behind another CDN. We block the HTTP handler for ~15s max to
// catch the fast path, then return "pending" and let the dashboard
// or a retry drive the next check.
const POLL_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 2_500;

function getConfig() {
  const token = config.cloudflareApiToken;
  const zoneId = config.cloudflareZoneId;
  if (!token || !zoneId) {
    throw new Error(
      "Cloudflare SSL provider requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID env vars"
    );
  }
  return { token, zoneId };
}

async function cfRequest(path, { method = "GET", body } = {}) {
  const { token } = getConfig();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json;
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (!res.ok || json?.success === false) {
    const firstError = json?.errors?.[0];
    const message =
      firstError?.message ||
      res.statusText ||
      `HTTP ${res.status}`;
    const err = new Error(
      `Cloudflare API ${method} ${path} failed (${res.status}): ${message}`
    );
    err.statusCode = res.status;
    err.cfCode = firstError?.code || null;
    err.cfErrors = json?.errors || null;
    throw err;
  }

  return json.result;
}

/**
 * Translate a Cloudflare custom_hostname payload into our adapter
 * contract. CF's ssl.status values:
 *   initializing | pending_validation | pending_issuance |
 *   pending_deployment | active | pending_deletion | deleted
 */
function translateCfResult(result) {
  if (!result) {
    return { ok: false, status: "failed", error: "cf_empty_response" };
  }

  const sslStatus = result.ssl?.status;
  const providerRef = result.id || null;

  if (sslStatus === "active") {
    return {
      ok: true,
      status: "issued",
      providerRef,
      issuedAt: result.created_on ? new Date(result.created_on) : new Date(),
      expiresAt: result.ssl?.expires_on
        ? new Date(result.ssl.expires_on)
        : null,
    };
  }

  if (
    sslStatus === "initializing" ||
    sslStatus === "pending_validation" ||
    sslStatus === "pending_issuance" ||
    sslStatus === "pending_deployment"
  ) {
    return {
      ok: true,
      status: "pending",
      providerRef,
      detail: `cf_ssl_${sslStatus}`,
    };
  }

  // deleted, pending_deletion, null — treat as failure so the
  // merchant sees an error state and can retry.
  return {
    ok: false,
    status: "failed",
    providerRef,
    error: `cf_ssl_${sslStatus || "unknown"}`,
  };
}

/**
 * Look up the domain row's current providerRef so retries and polls
 * reuse the existing Cloudflare record instead of creating duplicates.
 */
async function getExistingRef(domainId) {
  if (!domainId) return null;
  try {
    const Domain = mongoose.model("Domain");
    const row = await Domain.findById(domainId).lean();
    return row?.ssl?.providerRef || null;
  } catch {
    return null;
  }
}

async function fetchCustomHostname(zoneId, id) {
  return cfRequest(`/zones/${zoneId}/custom_hostnames/${id}`);
}

async function createCustomHostname(zoneId, hostname) {
  return cfRequest(`/zones/${zoneId}/custom_hostnames`, {
    method: "POST",
    body: {
      hostname,
      ssl: {
        // http validation: Cloudflare serves the challenge via the
        // edge, so the merchant's CNAME pointing to our fallback
        // origin is enough — no extra TXT/CNAME validation records
        // required in most cases. "txt" is the alternative if HTTP
        // reachability is blocked.
        method: "http",
        type: "dv",
        settings: {
          min_tls_version: "1.2",
          // BYOC HTTP/2 + early hints — safe defaults for modern
          // merchant storefronts. CF will fall back if unsupported.
          http2: "on",
          tls_1_3: "on",
        },
      },
    },
  });
}

async function findByHostname(zoneId, hostname) {
  const results = await cfRequest(
    `/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`
  );
  if (Array.isArray(results) && results.length > 0) return results[0];
  return null;
}

async function deleteCustomHostname(zoneId, id) {
  return cfRequest(`/zones/${zoneId}/custom_hostnames/${id}`, {
    method: "DELETE",
  });
}

/**
 * Extract any ownership / DCV (domain-control-validation) records
 * Cloudflare needs the merchant to publish. For `http` validation
 * these are usually empty (CF validates over the CNAME), but for
 * `txt` validation CF returns a `ownership_verification` TXT and/or
 * an `ssl.validation_records` array. The dashboard surfaces these
 * so the merchant knows exactly what to publish.
 *
 * Shape returned:
 *   [{ type, name, value, purpose }]
 */
function extractValidationRecords(result) {
  const out = [];
  if (!result || typeof result !== "object") return out;

  // Hostname ownership — CF sometimes wants a TXT at a specific name
  // proving we control the hostname. Surface it even if it's optional
  // so the merchant sees the full picture.
  const ov = result.ownership_verification;
  if (ov?.type && ov?.name && ov?.value) {
    out.push({
      type: String(ov.type).toUpperCase(),
      name: ov.name,
      value: ov.value,
      purpose: "Cloudflare hostname ownership",
    });
  }
  const ovHttp = result.ownership_verification_http;
  if (ovHttp?.http_url && ovHttp?.http_body) {
    out.push({
      type: "HTTP",
      name: ovHttp.http_url,
      value: ovHttp.http_body,
      purpose: "Cloudflare hostname ownership (HTTP file)",
    });
  }

  // SSL DCV records — CF publishes one per requested validation
  // method when it can't validate over HTTP (e.g. txt mode).
  const vrs = result.ssl?.validation_records;
  if (Array.isArray(vrs)) {
    for (const vr of vrs) {
      if (vr?.txt_name && vr?.txt_value) {
        out.push({
          type: "TXT",
          name: vr.txt_name,
          value: vr.txt_value,
          purpose: "SSL certificate validation",
        });
      }
      if (vr?.cname && vr?.cname_target) {
        out.push({
          type: "CNAME",
          name: vr.cname,
          value: vr.cname_target,
          purpose: "SSL certificate validation",
        });
      }
    }
  }

  return out;
}

/**
 * Short-poll the custom hostname until ssl.status leaves the pending
 * family or the deadline elapses. Returns whatever the final fetch
 * saw — the caller translates it into the adapter contract.
 */
async function pollForActive(zoneId, id) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let latest = null;

  while (Date.now() < deadline) {
    latest = await fetchCustomHostname(zoneId, id);
    const sslStatus = latest?.ssl?.status;
    if (sslStatus === "active") return latest;
    // Terminal non-pending states — bail out of the loop, don't waste
    // the rest of the window.
    if (
      sslStatus !== "initializing" &&
      sslStatus !== "pending_validation" &&
      sslStatus !== "pending_issuance" &&
      sslStatus !== "pending_deployment"
    ) {
      return latest;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  return latest;
}

/**
 * Named wrappers around the CF Custom Hostnames API. These are the
 * building blocks used by `services/domainRegistration.js` and the
 * custom-domain add flow — they don't go through the SSL-provider
 * adapter contract because the caller wants the raw validation
 * records back, not the translated ok/status/providerRef shape.
 *
 * Each wrapper requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID
 * and will throw if they're unset. Never log the token.
 */

/** POST /zones/{zone}/custom_hostnames */
export async function registerCustomHostname(hostname) {
  const { zoneId } = getConfig();

  // Reuse an existing record when one is already present for this
  // hostname — avoids a 409 on retries when the caller didn't
  // persist the CF id yet.
  let cfRow = await findByHostname(zoneId, hostname).catch(() => null);
  if (!cfRow) {
    cfRow = await createCustomHostname(zoneId, hostname);
  }

  return {
    id: cfRow?.id || null,
    status: cfRow?.status || null,
    sslStatus: cfRow?.ssl?.status || null,
    validationRecords: extractValidationRecords(cfRow),
    raw: cfRow,
  };
}

/** GET /zones/{zone}/custom_hostnames/{id} */
export async function getCustomHostnameById(id) {
  const { zoneId } = getConfig();
  const cfRow = await fetchCustomHostname(zoneId, id);
  return {
    id: cfRow?.id || null,
    status: cfRow?.status || null,
    sslStatus: cfRow?.ssl?.status || null,
    validationRecords: extractValidationRecords(cfRow),
    raw: cfRow,
  };
}

/** DELETE /zones/{zone}/custom_hostnames/{id} */
export async function removeCustomHostnameById(id) {
  const { zoneId } = getConfig();
  await deleteCustomHostname(zoneId, id);
  return { ok: true };
}

/**
 * Convenience for callers who have only the hostname (no CF id
 * persisted yet). Used by the revoke path when the Domain row was
 * deleted before we could grab the id.
 */
export async function removeCustomHostnameByName(hostname) {
  const { zoneId } = getConfig();
  const existing = await findByHostname(zoneId, hostname);
  if (!existing?.id) return { ok: true, skipped: true };
  await deleteCustomHostname(zoneId, existing.id);
  return { ok: true };
}

export default {
  async issueCertificate({ hostname, domainId }) {
    try {
      const { zoneId } = getConfig();

      // Retry path: if we already have a providerRef, just re-fetch
      // its status. Creating a duplicate would 409 at Cloudflare.
      const existingRef = await getExistingRef(domainId);
      let cfRow;

      if (existingRef) {
        try {
          cfRow = await fetchCustomHostname(zoneId, existingRef);
        } catch (err) {
          if (err.statusCode === 404) {
            // Stale ref (CF record deleted out-of-band). Fall through
            // to re-create so the merchant isn't stuck.
            cfRow = null;
          } else {
            throw err;
          }
        }
      }

      if (!cfRow) {
        // Double-check by hostname in case our row lost the ref but
        // Cloudflare still has a record — avoids 409 "duplicate".
        cfRow = await findByHostname(zoneId, hostname);
      }

      if (!cfRow) {
        cfRow = await createCustomHostname(zoneId, hostname);
      }

      // Short-poll for the fast path (DNS/HTTP-01 against an already
      // pointed CNAME usually completes in a few seconds).
      if (cfRow?.id && cfRow?.ssl?.status !== "active") {
        const polled = await pollForActive(zoneId, cfRow.id);
        if (polled) cfRow = polled;
      }

      const translated = translateCfResult(cfRow);
      // Always carry the CF-requested validation records alongside the
      // translated status so the dashboard can display them while the
      // cert is still pending.
      translated.validationRecords = extractValidationRecords(cfRow);
      return translated;
    } catch (err) {
      logger.error("Cloudflare issueCertificate failed", {
        hostname,
        error: err.message,
        cfCode: err.cfCode,
      });
      return {
        ok: false,
        status: "failed",
        error: err.message,
      };
    }
  },

  async renewCertificate(args) {
    // Cloudflare for SaaS auto-renews DV certs for active custom
    // hostnames — there's no explicit "renew" API. Re-running the
    // issue flow returns current state, which is what the background
    // renewal worker (D8+) will check.
    return this.issueCertificate(args);
  },

  async revokeCertificate({ hostname, domainId }) {
    try {
      const { zoneId } = getConfig();

      let ref = await getExistingRef(domainId);
      if (!ref) {
        const found = await findByHostname(zoneId, hostname);
        ref = found?.id || null;
      }

      // Nothing registered upstream — treat as already-revoked. The
      // merchant flow shouldn't block on cleanup of a record that
      // never existed or was already gone.
      if (!ref) return { ok: true };

      await deleteCustomHostname(zoneId, ref);
      return { ok: true };
    } catch (err) {
      logger.error("Cloudflare revokeCertificate failed", {
        hostname,
        error: err.message,
        cfCode: err.cfCode,
      });
      // Non-fatal for the remove flow — log and return error so the
      // caller can decide whether to surface it.
      return { ok: false, error: err.message };
    }
  },
};
