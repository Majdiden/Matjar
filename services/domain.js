import dns from "dns/promises";
import crypto from "crypto";
import mongoose from "mongoose";
import config from "../config/index.js";
import {
  setCustomDomainRepo,
  verifyCustomDomainRepo,
  removeCustomDomainRepo,
  setPrimaryDomainRepo,
  updateSubdomainRepo,
  enableSSLRepo,
  checkSubdomainAvailabilityRepo,
  findTenantByDomainRepo,
  getTenantsWithCustomDomainsRepo,
  getPendingVerificationsRepo,
} from "../repositories/domain.js";
import { getATenantRepo } from "../repositories/tenant.js";
import { APIError } from "../middlewares/errorHandler.js";
import {
  createCustomDomainEntry,
  markOwnershipVerified,
  markSslFailed,
  provisionVerifiedDomain,
  deleteDomainByHostname,
  setPrimaryDomainRow,
  isHostnameAvailable,
} from "./domainRegistry.js";
import { DOMAIN_STATUSES } from "../schemas/domain.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { emit as emitNotification } from "./notification.js";
import {
  validateCustomDomain as validateCustomDomainStrict,
  normalizeHostname,
} from "../utils/hostnameNormalize.js";
import logger from "../utils/logger.js";

function validateSubdomain(subdomain) {
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
  if (!subdomainRegex.test(subdomain)) {
    return { valid: false, error: "Subdomain must be 3-63 characters, contain only lowercase letters, numbers, and hyphens" };
  }
  const reserved = ["www", "api", "admin", "app", "mail", "email", "ftp", "blog", "shop", "store", "help", "support", "dev", "staging", "test", "demo", "cdn", "static", "assets", "matjar"];
  if (reserved.includes(subdomain)) return { valid: false, error: "This subdomain is reserved" };
  return { valid: true };
}

export const checkSubdomainAvailabilityService = async (subdomain) => {
  const slug = subdomain.toLowerCase();
  const validation = validateSubdomain(slug);
  if (!validation.valid) throw new APIError(validation.error, 400);
  const isAvailable = await checkSubdomainAvailabilityRepo(subdomain);
  // Platform suffix comes from config so local/staging/white-label
  // deployments don't get baked-in `matjar.to` responses.
  const suffix = config.domainSuffix || config.baseDomain;
  return { available: isAvailable, subdomain: slug, fullDomain: `${slug}.${suffix}` };
};

export const updateSubdomainService = async (tenantId, newSubdomain) => {
  const tenant = await getATenantRepo({}, { _id: tenantId });
  if (!tenant) throw new APIError("Tenant not found", 404);

  const slug = newSubdomain.toLowerCase();
  const validation = validateSubdomain(slug);
  if (!validation.valid) throw new APIError(validation.error, 400);

  const Tenant = mongoose.model("Tenant");
  const existingTenant = await Tenant.findOne({
    "domains.subdomain.name": slug,
    _id: { $ne: tenantId },
  });
  if (existingTenant) throw new APIError("Subdomain is already taken", 400);

  const oldFullDomain = tenant.domains?.subdomain?.fullDomain || null;
  const wasPrimary = tenant.domains?.primaryDomain === "subdomain";

  const updated = await updateSubdomainRepo(tenantId, slug);

  // Mirror into the Domain registry so the resolver and dashboard
  // see the rename immediately. Without this the old platform-
  // subdomain row keeps serving traffic under the old hostname
  // until the next D3-style migration runs.
  try {
    const Domain = mongoose.model("Domain");
    const { upsertPlatformSubdomainDomain } = await import("./domainRegistry.js");

    // 1. Retire the old row — it's no longer serving this tenant.
    if (oldFullDomain) {
      await Domain.findOneAndDelete({ tenantId, hostname: oldFullDomain });
    }

    // 2. Create / upsert the new platform-subdomain row (active).
    const newRow = await upsertPlatformSubdomainDomain(tenantId, slug);

    // 3. Preserve primary flag: if the subdomain was the primary
    //    host before the rename, make sure the new row owns the
    //    single-primary-per-tenant flag.
    if (wasPrimary && newRow) {
      await Domain.updateMany(
        { tenantId, _id: { $ne: newRow._id }, isPrimary: true },
        { $set: { isPrimary: false } }
      );
      if (!newRow.isPrimary) {
        await Domain.findByIdAndUpdate(newRow._id, { $set: { isPrimary: true } });
      }
    }
  } catch (err) {
    logger.warn("Domain registry mirror failed after subdomain rename", {
      tenantId: String(tenantId),
      slug,
      error: err.message,
    });
  }

  return updated;
};

export const checkCustomDomainAvailabilityService = async (domain) => {
  // Use the strict hostname validator (punycode, IP literal rejection,
  // reserved TLDs, platform-domain collision) — same one the add flow
  // runs — and check availability against the Domain registry, not the
  // legacy embedded fields.
  const validation = validateCustomDomainStrict(domain);
  if (!validation.ok) throw new APIError(`Invalid domain: ${validation.reason}`, 400);
  const hostname = validation.hostname;
  const isAvailable = await isHostnameAvailable(hostname);
  return { available: isAvailable, domain: hostname };
};

export const addCustomDomainService = async (tenantId, customDomain, verificationMethod = "dns") => {
  const tenant = await getATenantRepo({}, { _id: tenantId });
  if (!tenant) throw new APIError("Tenant not found", 404);

  if (!["pro", "enterprise"].includes(tenant.subscriptionPlan)) {
    throw new APIError(`Custom domains are only available for Pro and Enterprise plans. Current plan: ${tenant.subscriptionPlan}`, 403);
  }

  // Create the Domain registry row first. The registry runs the
  // canonical normalization + validation (punycode, reserved TLDs,
  // IP literals, platform-domain collision) and mints the
  // verification token in one place.
  let registryEntry;
  try {
    registryEntry = await createCustomDomainEntry(tenantId, customDomain);
  } catch (err) {
    if (err.statusCode) throw new APIError(err.message, err.statusCode);
    throw err;
  }

  const hostname = registryEntry.row.hostname;
  const verificationCode = registryEntry.tokenPlain;
  const domainKind = registryEntry.row.kind; // custom_apex | custom_subdomain

  // Dual-write the legacy embedded fields so existing readers
  // (dashboard UI, resolver fallback) continue to work until D5
  // migrates every call site off the embedded subtree.
  const customDomainData = {
    name: hostname,
    isVerified: false,
    verificationCode,
    verificationMethod,
    verifiedAt: null,
    sslEnabled: false,
    sslIssuedAt: null,
  };

  let updatedTenant;
  try {
    updatedTenant = await setCustomDomainRepo(tenantId, customDomainData);
  } catch (err) {
    // Rollback the registry row so we don't leak a half-created state.
    await deleteDomainByHostname(tenantId, hostname).catch((e) =>
      logger.warn("Domain rollback failed after embedded write error", { error: e.message })
    );
    throw err;
  }

  // Eagerly register the hostname with Cloudflare for SaaS so the
  // merchant can see any CF-requested validation records (DCV CNAMEs,
  // ownership TXT, etc.) up front — before they come back to hit
  // verify. Best-effort: if CF is down or misconfigured we still hand
  // the merchant our own TXT + CNAME records; the full verify flow
  // will retry CF registration later.
  let cfValidationRecords = [];
  let cfHostnameId = null;
  try {
    const sslProvider = config.sslProvider;
    if (sslProvider === "cloudflare") {
      const { registerCustomHostname } = await import("./sslProviders/cloudflare.js");
      const cfResult = await registerCustomHostname(hostname);
      cfHostnameId = cfResult.id;
      cfValidationRecords = cfResult.validationRecords || [];
      if (cfHostnameId) {
        // Persist the CF id so the provision/poll path reuses it
        // instead of creating a duplicate record.
        const Domain = mongoose.model("Domain");
        await Domain.findByIdAndUpdate(registryEntry.row._id, {
          $set: {
            "ssl.provider": "cloudflare",
            "ssl.providerRef": cfHostnameId,
          },
        });
      }
    }
  } catch (err) {
    // Don't log the token. `err.message` shouldn't include it, but be
    // explicit: we log the error text without inspecting headers.
    logger.warn("Cloudflare custom hostname preregistration failed", {
      hostname,
      error: err.message,
    });
  }

  return {
    tenant: updatedTenant,
    verificationInstructions: getVerificationInstructions(
      hostname,
      verificationCode,
      verificationMethod,
      { kind: domainKind, cfValidationRecords, cfHostnameId }
    ),
  };
};

/**
 * Build the merchant-facing DNS instruction bundle.
 *
 * Combines three sources of records, in this order:
 *   1. Our own TXT ownership record (proves the merchant controls
 *      the hostname — gates the verify endpoint).
 *   2. The routing record pointing at the platform edge — CNAME to
 *      PLATFORM_EDGE_CNAME for subdomains, A/CNAME to PLATFORM_EDGE_IP
 *      for apex. Without this, Cloudflare can never reach the
 *      hostname so TLS will never issue.
 *   3. Any Cloudflare-side DCV records returned by the custom
 *      hostnames API (optional — CF usually validates over HTTP once
 *      the CNAME is live).
 */
function getVerificationInstructions(domain, verificationCode, method, opts = {}) {
  const { kind, cfValidationRecords = [] } = opts;
  const edgeCname = config.platformEdgeCname;
  const edgeIps = config.platformEdgeIps;

  const ownershipRecord = {
    type: "TXT",
    name: `_matjar-verification.${domain}`,
    value: verificationCode,
    purpose: "Ownership verification",
  };

  const routingRecords = [];
  if (kind === "custom_apex") {
    if (edgeIps.length) {
      for (const ip of edgeIps) {
        routingRecords.push({
          type: "A",
          name: domain,
          value: ip,
          purpose: "Traffic routing",
        });
      }
    }
  } else {
    // custom_subdomain (default) — CNAME to platform edge.
    if (edgeCname) {
      routingRecords.push({
        type: "CNAME",
        name: domain,
        value: edgeCname,
        purpose: "Traffic routing",
      });
    }
  }

  const allRecords = [ownershipRecord, ...routingRecords, ...cfValidationRecords];

  // Preserve legacy response shape for back-compat with any consumer
  // still reading `record` / `records`. New consumers should read the
  // unified `records` array which is now always present.
  if (method === "cname" || routingRecords.length || cfValidationRecords.length) {
    return {
      method: routingRecords.length ? "CNAME + TXT Records" : "TXT Record",
      instructions: [
        "Add the DNS records below at your domain registrar or DNS provider:",
        ...allRecords.map((r) => `  • ${r.type} ${r.name} → ${r.value} (${r.purpose})`),
        "Wait for DNS to propagate (typically 5-30 minutes).",
        "Then click Verify to check the records and begin SSL issuance.",
      ],
      record: ownershipRecord,
      records: allRecords,
    };
  }

  return {
    method: "TXT Record",
    instructions: [
      "Add a TXT record to your DNS settings",
      `Host/Name: ${ownershipRecord.name}`,
      `Value: ${ownershipRecord.value}`,
      "TTL: 3600",
      "Wait for DNS propagation (5-30 minutes)",
    ],
    record: ownershipRecord,
    records: [ownershipRecord],
  };
}

/**
 * Normalise a TXT value for comparison. DNS providers (Cloudflare, Route 53,
 * some registrars) store/echo TXT values wrapped in double quotes, and those
 * quotes can survive into the compared string — so an exact `===` against the
 * bare token fails even though the merchant added the right value. Strip
 * surrounding quotes + whitespace so `"abc"`, ` abc `, and `abc` all match.
 */
const normalizeTxtValue = (s) =>
  String(s ?? "").trim().replace(/^"+|"+$/g, "").trim();

/**
 * Resolve TXT records robustly. A container's default resolver (e.g. on
 * Render) frequently negative-caches a just-added record or lags propagation,
 * so a merchant who correctly added the record still fails to verify. Query
 * public resolvers (Cloudflare, Google) first and fall back to the system
 * resolver. Returns a flat array of strings; never throws (returns []).
 */
async function resolveTxtRobust(name) {
  const serverGroups = [
    ["1.1.1.1", "1.0.0.1"],
    ["8.8.8.8", "8.8.4.4"],
  ];
  for (const servers of serverGroups) {
    try {
      const resolver = new dns.Resolver();
      resolver.setServers(servers);
      const records = await resolver.resolveTxt(name);
      if (records && records.length) return records.flat();
    } catch {
      // try the next resolver
    }
  }
  // System resolver as a last resort (lets ENOTFOUND/ENODATA propagate up).
  const records = await dns.resolveTxt(name);
  return (records || []).flat();
}

export const verifyCustomDomainService = async (tenantId) => {
  const tenant = await getATenantRepo({}, { _id: tenantId });
  if (!tenant) throw new APIError("Tenant not found", 404);
  if (!tenant.domains.customDomain.name) throw new APIError("No custom domain configured", 400);
  if (tenant.domains.customDomain.isVerified) throw new APIError("Domain is already verified", 400);

  const domain = tenant.domains.customDomain.name;
  const expectedCode = tenant.domains.customDomain.verificationCode;

  try {
    const allRecords = await resolveTxtRobust(`_matjar-verification.${domain}`);
    // Tolerant match — strip quotes/whitespace both sides (see normalizeTxtValue).
    const wanted = normalizeTxtValue(expectedCode);
    const isVerified = allRecords.some((record) => normalizeTxtValue(record) === wanted);

    if (!isVerified) {
      try {
        const models = createScopedModels(mongoose.connection, tenantId);
        emitNotification(models, tenantId, {
          type: "domain.verification_failed",
          severity: "warning",
          title: "Domain verification failed",
          body: `TXT record for ${domain} does not match the expected verification code`,
          resourceType: "domain",
          permission: "settings.read",
          data: { domain, expectedCode, foundRecords: allRecords },
        });
      } catch (err) {
        console.warn("emit domain.verification_failed failed", err?.message);
      }
      return { verified: false, message: "Verification code not found in DNS records", foundRecords: allRecords };
    }

    // Run the full state machine against the Domain registry row:
    //   pending_dns → ownership_verified → dns_verified →
    //   provisioning_ssl → (active | ssl_failed | dns_misconfigured)
    //
    // Each step writes its terminal state back to the row, so the
    // returned `registryDomain` reflects the final state — the
    // dashboard polls getDomainInfo to see progression.
    let registryDomain = null;
    try {
      const Domain = mongoose.model("Domain");
      const row = await Domain.findOne({ tenantId, hostname: domain });
      if (row) {
        await markOwnershipVerified(row._id);
        registryDomain = await provisionVerifiedDomain(row._id);
      }
    } catch (err) {
      logger.warn("Domain registry update failed after verify", { error: err.message });
    }

    // Only flip the legacy embedded `isVerified` flag once the
    // registry row is fully ACTIVE (DNS target + SSL both good).
    // Flipping earlier would let dashboard/API consumers treat the
    // domain as "ready to serve" while traffic is still broken.
    // ownership-verified state is reflected via `ownershipVerified`
    // in the response — the legacy flag now tracks serving-ready.
    let updatedTenant = null;
    if (registryDomain?.status === DOMAIN_STATUSES.ACTIVE) {
      updatedTenant = await verifyCustomDomainRepo(tenantId);
    } else {
      updatedTenant = tenant;
    }

    const registryStatus = registryDomain?.status || null;
    return {
      verified: registryStatus === DOMAIN_STATUSES.ACTIVE,
      ownershipVerified: true,
      message:
        registryStatus === DOMAIN_STATUSES.ACTIVE
          ? "Domain verified and active."
          : "Ownership verified. DNS/SSL provisioning is in progress — check back shortly.",
      tenant: updatedTenant,
      registryStatus,
      sslStatus: registryDomain?.ssl?.status || null,
    };
  } catch (error) {
    if (error.code === "ENOTFOUND" || error.code === "ENODATA") {
      return { verified: false, message: "DNS record not found. Please ensure the TXT record has been added.", error: error.code };
    }
    throw new APIError(`DNS verification failed: ${error.message}`, 500);
  }
};

export const removeCustomDomainService = async (tenantId, domainIdentifier = null) => {
  const tenant = await getATenantRepo({}, { _id: tenantId });
  if (!tenant) throw new APIError("Tenant not found", 404);
  const Domain = mongoose.model("Domain");
  const embeddedHostname = normalizeHostname(tenant.domains?.customDomain?.name || "");
  let domainRow = null;

  if (domainIdentifier) {
    const rawIdentifier = String(domainIdentifier).trim();
    if (mongoose.Types.ObjectId.isValid(rawIdentifier)) {
      domainRow = await Domain.findOne({ tenantId, _id: rawIdentifier });
    }
    if (!domainRow) {
      const normalized = normalizeHostname(rawIdentifier);
      if (normalized) {
        domainRow = await Domain.findOne({ tenantId, hostname: normalized });
      }
    }
    if (!domainRow) {
      throw new APIError("Custom domain not found for this tenant", 404);
    }
    if (domainRow.kind === "platform_subdomain") {
      throw new APIError("Platform subdomain cannot be removed with the custom-domain endpoint", 400);
    }
  } else {
    // Backwards-compatible path for older clients that can only remove
    // the single embedded customDomain. New dashboard code passes the
    // clicked Domain registry row id to avoid deleting the wrong row.
    if (!embeddedHostname) throw new APIError("No custom domain configured", 400);
    domainRow = await Domain.findOne({ tenantId, hostname: embeddedHostname });
  }

  const hostname = domainRow?.hostname || embeddedHostname;
  const removingEmbeddedDomain = embeddedHostname && hostname === embeddedHostname;
  const removedDomain = domainRow?.toPublicJSON ? domainRow.toPublicJSON() : domainRow?.toObject?.() || null;

  // Capture the Domain row's id BEFORE we delete it, so we can pass
  // it to the SSL provider's revoke hook. Without this the adapter
  // can't find the providerRef and would fall back to a hostname
  // search against the upstream API.
  const domainIdForRevoke = domainRow?._id || null;

  let result = tenant;
  if (removingEmbeddedDomain) {
    result = await removeCustomDomainRepo(tenantId);
  } else if (domainRow?.isPrimary) {
    // A non-embedded registry row can still be marked primary. If the
    // merchant removes it, fall back to the platform subdomain before
    // deleting the row so canonical redirects never point at a dead host.
    result = await setPrimaryDomainRepo(tenantId, "subdomain");
  }

  // Best-effort revoke upstream. If Cloudflare returns an error we
  // log but continue — a stale custom_hostname on their side is
  // recoverable by hand and must not block the merchant from
  // detaching the domain on our side.
  try {
    const { getSslProvider } = await import("./sslProviders/index.js");
    const { provider, name: providerName } = await getSslProvider();
    if (typeof provider?.revokeCertificate === "function") {
      const revokeResult = await provider.revokeCertificate({
        hostname,
        domainId: domainIdForRevoke,
      });
      if (!revokeResult?.ok) {
        logger.warn("SSL provider revoke returned error", {
          hostname,
          provider: providerName,
          error: revokeResult?.error,
        });
      }
    }
  } catch (err) {
    logger.warn("SSL provider revoke failed during custom-domain removal", {
      hostname,
      error: err.message,
    });
  }

  // Delete the Domain registry row so the hostname is immediately
  // available for re-registration. Failure here is logged but not
  // fatal only for the backwards-compatible embedded-only path; for
  // explicit row deletes, the registry row is the thing the merchant
  // clicked, so failure must be surfaced.
  try {
    if (domainRow?._id) {
      await Domain.findOneAndDelete({ tenantId, _id: domainRow._id });
    } else {
      await deleteDomainByHostname(tenantId, hostname);
    }
  } catch (err) {
    logger.warn("Domain registry delete failed during custom-domain removal", { error: err.message });
    if (domainIdentifier) {
      throw new APIError(`Failed to remove custom domain: ${err.message}`, 500);
    }
  }

  return { tenant: result, removedDomain };
};

export const setPrimaryDomainService = async (tenantId, primaryDomain) => {
  const tenant = await getATenantRepo({}, { _id: tenantId });
  if (!tenant) throw new APIError("Tenant not found", 404);
  if (primaryDomain !== "subdomain" && primaryDomain !== "custom") throw new APIError("Primary domain must be 'subdomain' or 'custom'", 400);

  if (primaryDomain === "custom") {
    if (!tenant.domains.customDomain.name) throw new APIError("No custom domain configured", 400);

    // Gate on the Domain registry — the authoritative state. The
    // legacy `isVerified` flag only proves TXT ownership, not that
    // DNS points at our edge and SSL has been issued. Flipping
    // primary=custom before `active` would direct real merchants
    // at a broken cert and 5xx the storefront.
    const Domain = mongoose.model("Domain");
    const row = await Domain.findOne({
      tenantId,
      hostname: tenant.domains.customDomain.name,
    }).lean();
    if (!row || row.status !== DOMAIN_STATUSES.ACTIVE) {
      throw new APIError(
        `Custom domain is not ready to serve traffic (state: ${row?.status || "missing"}). ` +
          `Primary can only be flipped once DNS and SSL are active.`,
        400
      );
    }
  }

  const result = await setPrimaryDomainRepo(tenantId, primaryDomain);

  // Mirror the primary flip into the Domain registry.
  try {
    const targetHostname =
      primaryDomain === "custom"
        ? tenant.domains.customDomain.name
        : tenant.domains.subdomain.fullDomain;
    if (targetHostname) await setPrimaryDomainRow(tenantId, targetHostname);
  } catch (err) {
    logger.warn("Domain registry primary update failed", { error: err.message });
  }

  return result;
};

/**
 * Retry SSL provisioning for a verified custom domain.
 *
 * This replaces the old fake-success enableSSLService flag. It:
 *   1. Looks up the Domain registry row.
 *   2. Requires it to have passed ownership verification already
 *      (no cert for un-owned domains, no exceptions).
 *   3. Runs the same DNS target + provider issuance sequence the
 *      verify flow uses.
 *
 * Intended for two cases: merchant clicks "retry" after ssl_failed,
 * or a cert needs to be re-issued after a DNS/CNAME change.
 */
export const enableSSLService = async (tenantId) => {
  const tenant = await getATenantRepo({}, { _id: tenantId });
  if (!tenant) throw new APIError("Tenant not found", 404);
  if (!tenant.domains.customDomain.name) throw new APIError("No custom domain configured", 400);

  const hostname = tenant.domains.customDomain.name;
  const Domain = mongoose.model("Domain");
  const row = await Domain.findOne({ tenantId, hostname });
  if (!row) {
    throw new APIError("Domain registry row not found. Re-add the custom domain.", 404);
  }

  // Gate on the registry — TXT ownership is proven via
  // `verification.verifiedAt`. Relying on the legacy
  // `customDomain.isVerified` flag here would deadlock async
  // providers: that flag now only flips once the domain is fully
  // ACTIVE, but the merchant needs to hit retry precisely when the
  // domain is stuck in ownership_verified / dns_verified /
  // provisioning_ssl / ssl_failed / dns_misconfigured.
  if (!row.verification?.verifiedAt) {
    throw new APIError(
      "Domain ownership has not been verified yet. Complete DNS verification first.",
      400
    );
  }

  const isEligible = [
    DOMAIN_STATUSES.OWNERSHIP_VERIFIED,
    DOMAIN_STATUSES.DNS_VERIFIED,
    DOMAIN_STATUSES.PROVISIONING_SSL,
    DOMAIN_STATUSES.SSL_FAILED,
    DOMAIN_STATUSES.DNS_MISCONFIGURED,
    DOMAIN_STATUSES.ACTIVE, // Allow re-issuance / renewal from active.
  ].includes(row.status);
  if (!isEligible) {
    throw new APIError(`Domain in state ${row.status} is not eligible for SSL issuance`, 400);
  }

  // Mirror the legacy embedded field for dual-write compatibility.
  // The Domain row's ssl subdoc is the source of truth going forward.
  try {
    await enableSSLRepo(tenantId);
  } catch (err) {
    logger.warn("Legacy enableSSLRepo failed, continuing with registry flow", { error: err.message });
  }

  let finalRow;
  try {
    finalRow = await provisionVerifiedDomain(row._id);
  } catch (err) {
    await markSslFailed(row._id, { error: err.message });
    throw new APIError(`SSL provisioning failed: ${err.message}`, 502);
  }

  // PROVISIONING_SSL is a legitimate terminal state for this request:
  // async providers (Cloudflare for SaaS) may not finish issuance
  // inside the short foreground poll window. The dashboard polls
  // getDomainInfo and the merchant can hit enableSSL again to advance
  // it. Only ACTIVE and PROVISIONING_SSL are non-error outcomes.
  const acceptable = [DOMAIN_STATUSES.ACTIVE, DOMAIN_STATUSES.PROVISIONING_SSL];
  if (!finalRow || !acceptable.includes(finalRow.status)) {
    throw new APIError(
      `SSL provisioning did not complete: ${finalRow?.status || "unknown"} / ${finalRow?.ssl?.error || "no_error"}`,
      502
    );
  }

  const pending = finalRow.status === DOMAIN_STATUSES.PROVISIONING_SSL;
  return {
    domain: finalRow.toPublicJSON ? finalRow.toPublicJSON() : finalRow,
    message: pending
      ? "SSL issuance in progress — this can take a few minutes. Check back shortly."
      : "SSL certificate issued successfully",
  };
};

export const getDomainInfoService = async (domain) => {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findByDomain(domain);
  if (!tenant) throw new APIError("Tenant not found", 404);

  // Registry is authoritative. Legacy embedded fields are included
  // for back-compat but flagged `_legacy: true` so new consumers
  // don't trust them. `customDomain.ownershipVerified` and
  // `customDomain.status` reflect the real lifecycle.
  const Domain = mongoose.model("Domain");
  const customDomainRow = tenant.domains.customDomain?.name
    ? await Domain.findOne({
        tenantId: tenant._id,
        hostname: tenant.domains.customDomain.name,
      }).lean()
    : null;

  const isServing = customDomainRow?.status === DOMAIN_STATUSES.ACTIVE;

  return {
    subdomain: {
      name: tenant.domains.subdomain.name,
      fullDomain: tenant.domains.subdomain.fullDomain,
      isActive: tenant.domains.subdomain.isActive,
    },
    customDomain: tenant.domains.customDomain?.name
      ? {
          name: tenant.domains.customDomain.name,
          // Registry-sourced fields — use these in new code.
          status: customDomainRow?.status || null,
          ownershipVerified: Boolean(customDomainRow?.verification?.verifiedAt),
          sslStatus: customDomainRow?.ssl?.status || null,
          sslIssuedAt: customDomainRow?.ssl?.issuedAt || null,
          sslExpiresAt: customDomainRow?.ssl?.expiresAt || null,
          isServing,
          // Legacy fields — DO NOT use for serving decisions.
          _legacy: {
            isVerified: tenant.domains.customDomain.isVerified,
            sslEnabled: tenant.domains.customDomain.sslEnabled,
          },
        }
      : null,
    primaryDomain: tenant.domains.primaryDomain,
    // Active storefront host: custom only if it's actually serving,
    // otherwise the platform subdomain.
    activeDomain:
      tenant.domains.primaryDomain === "custom" && isServing
        ? tenant.domains.customDomain.name
        : tenant.domains.subdomain.fullDomain,
    canUseCustomDomain: ["pro", "enterprise"].includes(tenant.subscriptionPlan),
    subscriptionPlan: tenant.subscriptionPlan,
    settings: tenant.settings,
  };
};

export const getTenantsWithCustomDomainsService = async () => {
  return await getTenantsWithCustomDomainsRepo();
};

export const getPendingVerificationsService = async () => {
  return await getPendingVerificationsRepo();
};

export const checkDNSPropagationService = async (domain) => {
  try {
    const results = { domain, timestamp: new Date(), records: {} };
    try { results.records.A = await dns.resolve4(domain); } catch (e) { results.records.A = { error: e.code }; }
    try { results.records.CNAME = await dns.resolveCname(domain); } catch (e) { results.records.CNAME = { error: e.code }; }
    try { results.records.TXT = await dns.resolveTxt(domain); } catch (e) { results.records.TXT = { error: e.code }; }
    try { results.records.verificationTXT = await dns.resolveTxt(`_matjar-verification.${domain}`); } catch (e) { results.records.verificationTXT = { error: e.code }; }
    return results;
  } catch (error) {
    throw new APIError(`DNS check failed: ${error.message}`, 500);
  }
};
