import crypto from "node:crypto";
import mongoose from "mongoose";
import config from "../config/index.js";
import logger from "../utils/logger.js";
import {
  normalizeHostname,
  validateCustomDomain,
  classifyCustomHostname,
} from "../utils/hostnameNormalize.js";
import { DOMAIN_STATUSES, DOMAIN_KINDS } from "../schemas/domain.js";

/**
 * Domain Registry Service
 * -----------------------
 * Single source of truth for hostname → tenant resolution. Both
 * `middlewares/tenantContext.js` and `middlewares/storefrontServe.js`
 * call into this service — there must not be a second copy of the
 * resolution logic anywhere else.
 *
 * Resolution order:
 *   1. Exact-hostname lookup in the Domain registry (fast path once
 *      D3 migration runs and the registry is populated).
 *   2. Platform subdomain fallback — `<slug>.<baseDomain>` patterns
 *      split the slug out and look up the tenant by slug. This is
 *      the legacy read path that still works pre-migration and for
 *      freshly-registered tenants before their Domain row is written.
 *   3. Dev fallback — bare `localhost` returns the oldest active
 *      tenant so developers can hit the backend without setting up
 *      a subdomain.
 *
 * Returns the full Tenant document or null. Never throws — callers
 * treat null as "no store at this host".
 */

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/**
 * Parse a Host header or req.hostname into the bare lowercase
 * hostname (no port). Returns null if the input is garbage.
 */
function extractHost(rawHostOrHeader) {
  if (!rawHostOrHeader) return null;
  // req.hostname is already port-less but req.headers.host is not.
  const noPort = String(rawHostOrHeader).split(":")[0].trim().toLowerCase();
  if (!noPort) return null;
  // We intentionally do NOT run this through normalizeHostname here
  // because that function's IDNA encoding and URL parsing would
  // reject bare "localhost" and mangle some dev inputs. The registry
  // stores already-normalized hostnames; inbound lookups just need
  // lowercase + trimmed + port stripped.
  return noPort.replace(/\.$/, "");
}

/**
 * Split `<slug>.<baseDomain>` (or `<slug>.localhost`) into its slug
 * component. Returns null if the host doesn't match either pattern.
 */
function extractSubdomainSlug(host) {
  if (!host) return null;

  // Dev: *.localhost
  const parts = host.split(".");
  if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
    return parts[0] || null;
  }

  // Prod/staging: *.baseDomain
  const baseDomain = (config.baseDomain || "").toLowerCase();
  if (baseDomain && host.endsWith(`.${baseDomain}`)) {
    const prefix = host.slice(0, -(baseDomain.length + 1)); // drop `.baseDomain`
    if (!prefix || prefix.includes(".")) {
      // `shop.eu.matjar.to` etc. — multi-level subdomains under our
      // base domain aren't the tenant-slug pattern, they'd have to
      // exist as explicit Domain rows.
      return null;
    }
    return prefix;
  }

  return null;
}

/**
 * Primary public API: given any hostname (from a Host header, a
 * req.hostname, or an arbitrary string), return the tenant serving
 * that host, or null.
 */
export async function resolveTenantByHost(rawHost) {
  const host = extractHost(rawHost);
  if (!host) return null;

  const Tenant = mongoose.model("Tenant");

  // --- 1. Bare localhost → no tenant ---
  // Returning a tenant here would bind every bare-host request to the
  // oldest active tenant, which then causes the auth middleware to 403
  // any JWT minted for a different tenant ("token tenant does not
  // match the requested store"). Use `<slug>.localhost` in dev.
  if (LOCALHOST_HOSTS.has(host)) {
    return null;
  }

  // --- 2. Domain registry exact match ---
  // Only consider rows in a serving state. A pending_dns or
  // disabled row must NOT route live traffic.
  let Domain = null;
  try {
    Domain = mongoose.model("Domain");
  } catch {
    // Model not registered yet — registry-less fallback below.
  }

  if (Domain) {
    try {
      // Only ACTIVE rows serve live traffic. dns_verified and
      // provisioning_ssl are intermediate — the merchant has pointed
      // DNS at us but the cert isn't issued, so HTTPS would fail.
      // Routing them through here would leak 5xx to real visitors.
      const domainRow = await Domain.findOne({
        hostname: host,
        status: DOMAIN_STATUSES.ACTIVE,
      }).lean();

      if (domainRow) {
        const tenant = await Tenant.findOne({
          _id: domainRow.tenantId,
          isActive: true,
        });
        if (tenant) return tenant;
      }
    } catch (err) {
      logger.warn("Domain registry lookup failed, falling through", {
        host,
        error: err.message,
      });
    }
  }

  // --- 3. Legacy: platform subdomain by slug ---
  // Platform subdomains are always owned by the platform, cert-wise
  // (wildcard on the parent zone), so slug → tenant is safe even
  // without a Domain row. This path exists so freshly-registered
  // tenants resolve before their upsertPlatformSubdomainDomain row
  // lands.
  const slug = extractSubdomainSlug(host);
  if (slug) {
    const tenant = await Tenant.findOne({
      "domains.subdomain.name": slug,
      isActive: true,
    });
    if (tenant) return tenant;
  }

  // Custom-domain resolution is registry-only. The legacy
  // `tenant.domains.customDomain.isVerified === true` fallback was
  // removed: `isVerified` only proves TXT ownership, not that DNS
  // points at our edge and SSL is issued. Routing storefront traffic
  // at a half-provisioned custom domain would serve TLS errors or
  // 5xx to real visitors. A custom domain must have a Domain row in
  // status=ACTIVE to serve.
  return null;
}

/**
 * Check if a hostname is available — i.e. not claimed by any tenant
 * in the Domain registry or embedded legacy fields. Used by the
 * custom-domain add flow to 409 on conflicts before minting a
 * verification token.
 */
export async function isHostnameAvailable(host) {
  const normalized = normalizeHostname(host);
  if (!normalized) return false;

  let Domain = null;
  try {
    Domain = mongoose.model("Domain");
  } catch {
    Domain = null;
  }

  if (Domain) {
    const existing = await Domain.findOne({ hostname: normalized }).lean();
    if (existing) return false;
  }

  const Tenant = mongoose.model("Tenant");
  const collision = await Tenant.findOne({
    $or: [
      { "domains.subdomain.fullDomain": normalized },
      { "domains.customDomain.name": normalized },
    ],
  }).lean();

  return !collision;
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------
//
// These helpers own all writes into the Domain collection. Call sites
// (`services/tenant.js`, `services/domain.js`, the migration script)
// must go through these so invariants — hostname normalization, single
// isPrimary per tenant, token hashing, state-machine transitions —
// stay in one place.

/**
 * Hash a verification token for storage. Plaintext is only ever
 * returned to the merchant once, in the add-domain response.
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Idempotently create the platform-subdomain Domain row for a tenant.
 * Called from the tenant-creation transaction so a new signup has a
 * registry row from the moment it exists.
 *
 * Platform subdomains skip DNS/ownership verification — the platform
 * owns the parent zone — so the row jumps straight to ACTIVE and is
 * marked isPrimary on insert.
 *
 * Accepts an optional mongoose session so the caller can bundle this
 * into a larger transaction.
 */
export async function upsertPlatformSubdomainDomain(
  tenantId,
  slug,
  { session } = {}
) {
  if (!tenantId || !slug) return null;
  const hostname = `${String(slug).toLowerCase()}.${(config.domainSuffix || config.baseDomain || "").toLowerCase()}`;
  if (!hostname || hostname.startsWith(".") || hostname.endsWith(".")) return null;

  const Domain = mongoose.model("Domain");

  // Check for an existing row before inserting. If one exists under
  // a different tenant we MUST throw — silently returning it would
  // hand tenant B a row that tenant A already owns, and the caller
  // would then mark isPrimary on a foreign record. Hostname is a
  // unique index, so two tenants can never legitimately share one.
  const existing = await Domain.findOne({ hostname }).session(session || null);
  if (existing) {
    if (String(existing.tenantId) !== String(tenantId)) {
      const err = new Error(
        `Platform subdomain "${hostname}" is already claimed by another tenant`
      );
      err.code = "platform_subdomain_conflict";
      err.statusCode = 409;
      throw err;
    }
    return existing;
  }

  try {
    return await Domain.create(
      [
        {
          tenantId,
          hostname,
          kind: DOMAIN_KINDS.PLATFORM_SUBDOMAIN,
          status: DOMAIN_STATUSES.ACTIVE,
          isPrimary: true,
          redirects: { forceHttps: !config.isDevelopment, canonicalHost: null },
        },
      ],
      { session }
    ).then((arr) => arr[0]);
  } catch (err) {
    // Race: another writer inserted between our find and create.
    // Re-read and enforce the same tenant-ownership invariant.
    if (err.code === 11000) {
      const row = await Domain.findOne({ hostname }).session(session || null);
      if (!row) throw err;
      if (String(row.tenantId) !== String(tenantId)) {
        const conflict = new Error(
          `Platform subdomain "${hostname}" is already claimed by another tenant`
        );
        conflict.code = "platform_subdomain_conflict";
        conflict.statusCode = 409;
        throw conflict;
      }
      return row;
    }
    throw err;
  }
}

/**
 * Create (or replace) a custom-domain Domain row in pending_dns state.
 *
 * Returns the row plus the plaintext verification token — the token
 * is ONLY available in this return value, never again. If the caller
 * loses it the merchant has to re-add the domain.
 *
 * Throws APIError-style `{code, message}` on validation failure so
 * the service layer can translate to HTTP errors.
 */
export async function createCustomDomainEntry(tenantId, rawHostname, { createdBy } = {}) {
  const validation = validateCustomDomain(rawHostname);
  if (!validation.ok) {
    const error = new Error(`Invalid custom domain: ${validation.reason}`);
    error.code = validation.reason;
    error.statusCode = 400;
    throw error;
  }
  const hostname = validation.hostname;

  const available = await isHostnameAvailable(hostname);
  if (!available) {
    const error = new Error("Hostname is already registered to another tenant");
    error.code = "hostname_taken";
    error.statusCode = 409;
    throw error;
  }

  const Domain = mongoose.model("Domain");

  // Mint a 32-byte CSPRNG verification token. Store only the sha256
  // hash — plaintext is handed back to the caller exactly once.
  const tokenPlain = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(tokenPlain);

  const kind = classifyCustomHostname(hostname); // custom_apex | custom_subdomain
  const recordName = `_matjar-verification.${hostname}`;

  const row = await Domain.create({
    tenantId,
    hostname,
    kind,
    status: DOMAIN_STATUSES.PENDING_DNS,
    isPrimary: false,
    verification: {
      method: "txt",
      tokenHash,
      recordName,
      recordValue: tokenPlain, // Cleared after successful verification.
      checkedAt: null,
      verifiedAt: null,
      failureReason: null,
    },
    dns: {
      targetType: kind === "custom_apex" ? "A" : "CNAME",
      expectedTarget: null, // Filled once the platform's edge target is configured.
      lastResolved: null,
      lastCheckedAt: null,
      error: null,
    },
    redirects: { forceHttps: true, canonicalHost: null },
    createdBy: createdBy || null,
  });

  return { row, tokenPlain };
}

// ---------------------------------------------------------------------------
// State machine transitions
// ---------------------------------------------------------------------------
//
// Legal transitions:
//
//   pending_dns        → ownership_verified    (TXT verified)
//   ownership_verified → dns_verified          (CNAME/A target matches)
//   dns_verified       → provisioning_ssl      (cert job started)
//   provisioning_ssl   → active                (cert issued)
//   provisioning_ssl   → ssl_failed            (cert failed)
//   ssl_failed         → provisioning_ssl      (retry)
//   active             → dns_misconfigured     (background drift check)
//   any                → disabled              (merchant removed)
//
// Every helper here takes a domainId + minimal payload and returns
// the updated doc. They do NOT enforce the legal-transitions table
// — the caller sequences them. That's deliberate: the verify flow
// runs them in order and short-circuits on the first failure,
// whereas the background worker may jump straight from active to
// dns_misconfigured without hitting the intermediate states.

export async function markOwnershipVerified(domainId, { recordValue } = {}) {
  const Domain = mongoose.model("Domain");
  return Domain.findByIdAndUpdate(
    domainId,
    {
      status: DOMAIN_STATUSES.OWNERSHIP_VERIFIED,
      "verification.verifiedAt": new Date(),
      "verification.checkedAt": new Date(),
      "verification.failureReason": null,
      // Clear plaintext token — the hash lingers as audit, but the
      // record value no longer needs to be retrievable.
      "verification.recordValue": recordValue ?? null,
    },
    { new: true }
  );
}

export async function markDnsVerified(domainId, { targetType, expectedTarget, resolved }) {
  const Domain = mongoose.model("Domain");
  return Domain.findByIdAndUpdate(
    domainId,
    {
      status: DOMAIN_STATUSES.DNS_VERIFIED,
      "dns.targetType": targetType || null,
      "dns.expectedTarget": expectedTarget || null,
      "dns.lastResolved": Array.isArray(resolved) ? resolved.join(",") : (resolved || null),
      "dns.lastCheckedAt": new Date(),
      "dns.error": null,
    },
    { new: true }
  );
}

export async function markDnsMisconfigured(domainId, { error, resolved } = {}) {
  const Domain = mongoose.model("Domain");
  return Domain.findByIdAndUpdate(
    domainId,
    {
      status: DOMAIN_STATUSES.DNS_MISCONFIGURED,
      "dns.lastCheckedAt": new Date(),
      "dns.lastResolved": Array.isArray(resolved) ? resolved.join(",") : (resolved || null),
      "dns.error": error || "dns_mismatch",
    },
    { new: true }
  );
}

export async function markProvisioningSsl(domainId, { provider, providerRef } = {}) {
  const Domain = mongoose.model("Domain");
  const update = {
    status: DOMAIN_STATUSES.PROVISIONING_SSL,
    "ssl.provider": provider || null,
    "ssl.status": "pending",
    "ssl.lastAttemptAt": new Date(),
    "ssl.error": null,
  };
  // Only persist providerRef when the caller has one — never clobber
  // an existing ref with null, since retries should reuse it.
  if (providerRef) update["ssl.providerRef"] = providerRef;
  return Domain.findByIdAndUpdate(domainId, update, { new: true });
}

export async function markSslActive(
  domainId,
  { issuedAt, expiresAt, provider, providerRef } = {}
) {
  const Domain = mongoose.model("Domain");
  const update = {
    status: DOMAIN_STATUSES.ACTIVE,
    "ssl.status": "issued",
    "ssl.issuedAt": issuedAt || new Date(),
    "ssl.expiresAt": expiresAt || null,
    "ssl.provider": provider || null,
    "ssl.error": null,
  };
  if (providerRef) update["ssl.providerRef"] = providerRef;
  return Domain.findByIdAndUpdate(domainId, update, { new: true });
}

export async function markSslFailed(domainId, { error, provider } = {}) {
  const Domain = mongoose.model("Domain");
  return Domain.findByIdAndUpdate(
    domainId,
    {
      status: DOMAIN_STATUSES.SSL_FAILED,
      "ssl.status": "failed",
      "ssl.provider": provider || null,
      "ssl.error": error || "cert_issuance_failed",
      "ssl.lastAttemptAt": new Date(),
    },
    { new: true }
  );
}

/**
 * Back-compat shim for D3 call sites that used to jump straight to
 * ACTIVE after TXT verification. Now marks ownership_verified — the
 * caller is expected to run the full DNS+SSL sequence afterwards.
 *
 * Kept so D3 dual-write code doesn't break until callers migrate.
 */
export async function markDomainActive(domainId) {
  return markOwnershipVerified(domainId);
}

// ---------------------------------------------------------------------------
// Full verification orchestration
// ---------------------------------------------------------------------------

/**
 * Run the full verify → DNS → SSL sequence for a Domain row that
 * has already passed TXT ownership verification. Short-circuits on
 * the first failure and writes the terminal state back to the row.
 *
 * Returns the final Domain doc. Does NOT throw on verification
 * failure — the failure is reflected in the returned doc's status
 * and the per-subdoc error field. Only unexpected errors propagate.
 */
export async function provisionVerifiedDomain(domainId) {
  // Lazy-imported to break the import cycle (dnsTargetCheck imports
  // nothing from registry, and sslProviders imports nothing from
  // registry, so top-level imports here would be fine — but lazy
  // keeps the domainRegistry module loadable in migration scripts
  // that don't need the Express HTTP stack).
  const { checkDnsTarget } = await import("./dnsTargetCheck.js");
  const { getSslProvider } = await import("./sslProviders/index.js");

  const Domain = mongoose.model("Domain");
  const row = await Domain.findById(domainId);
  if (!row) return null;

  // 1. DNS target check.
  const dnsResult = await checkDnsTarget(row.hostname, row.kind);
  if (!dnsResult.ok) {
    return markDnsMisconfigured(domainId, {
      error: dnsResult.reason,
      resolved: dnsResult.resolved,
    });
  }

  await markDnsVerified(domainId, {
    targetType: dnsResult.expected?.targetType,
    expectedTarget: dnsResult.expected?.expectedTarget,
    resolved: dnsResult.resolved,
  });

  // 2. SSL provisioning via the configured provider adapter.
  const { name: providerName, provider } = await getSslProvider();
  await markProvisioningSsl(domainId, {
    provider: providerName,
    providerRef: row.ssl?.providerRef || null,
  });

  let issuance;
  try {
    issuance = await provider.issueCertificate({
      hostname: row.hostname,
      domainId: row._id,
    });
  } catch (err) {
    logger.error("SSL provider threw during issuance", {
      hostname: row.hostname,
      provider: providerName,
      error: err.message,
    });
    return markSslFailed(domainId, { error: err.message, provider: providerName });
  }

  // Hard failure (ok=false) → terminal ssl_failed, retryable by the
  // merchant. Distinct from "still pending" — an async provider like
  // Cloudflare may take minutes to issue, in which case we stay in
  // PROVISIONING_SSL and let the dashboard / enableSSL endpoint poll.
  if (!issuance || !issuance.ok) {
    return markSslFailed(domainId, {
      error: issuance?.error || "cert_not_issued",
      provider: providerName,
    });
  }

  if (issuance.status === "pending") {
    // Persist the provider ref so the next poll reuses the same
    // upstream record instead of creating a duplicate.
    return markProvisioningSsl(domainId, {
      provider: providerName,
      providerRef: issuance.providerRef || null,
    });
  }

  // status === "issued" — full success.
  return markSslActive(domainId, {
    issuedAt: issuance.issuedAt,
    expiresAt: issuance.expiresAt,
    provider: providerName,
    providerRef: issuance.providerRef || null,
  });
}

/**
 * Delete a Domain row by tenant + hostname. Used by the remove-custom-
 * domain flow. Returns the deleted document or null.
 *
 * We hard-delete rather than soft-disable: a merchant re-adding the
 * same hostname later should start from a clean state, not inherit
 * stale verification/ssl history.
 */
export async function deleteDomainByHostname(tenantId, hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return null;
  const Domain = mongoose.model("Domain");
  return Domain.findOneAndDelete({ tenantId, hostname: normalized });
}

/**
 * Atomically set exactly one Domain row as primary for a tenant.
 * Unsets isPrimary on the tenant's other rows in the same write burst.
 */
export async function setPrimaryDomainRow(tenantId, hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return null;
  const Domain = mongoose.model("Domain");

  // Unset first, then set — two writes, not atomic across documents,
  // but good enough because the merchant-facing flow serializes on
  // the single tenant doc. A cross-doc race here would at worst
  // leave two isPrimary rows; the resolver doesn't depend on that
  // flag for routing, only for canonical-redirect decisions.
  await Domain.updateMany(
    { tenantId, isPrimary: true, hostname: { $ne: normalized } },
    { $set: { isPrimary: false } }
  );
  return Domain.findOneAndUpdate(
    { tenantId, hostname: normalized },
    { $set: { isPrimary: true } },
    { new: true }
  );
}

