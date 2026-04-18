/**
 * Domain Controller
 * HTTP handlers for domain management (subdomains and custom domains).
 *
 * All tenant-scoped handlers take the tenant id from `req.user.tenantId`
 * (set by the auth middleware). The previous version grabbed
 * `req.tenant?.domain || req.user?.tenantDomain` — a hostname string —
 * and passed it as `tenantId` to services that expect an ObjectId,
 * which silently matched nothing and returned "tenant not found" for
 * every authenticated request. See domain-management.md §Important.
 */

import {
  checkSubdomainAvailabilityService,
  updateSubdomainService,
  checkCustomDomainAvailabilityService,
  addCustomDomainService,
  verifyCustomDomainService,
  removeCustomDomainService,
  setPrimaryDomainService,
  enableSSLService,
  getDomainInfoService,
  getTenantsWithCustomDomainsService,
  getPendingVerificationsService,
  checkDNSPropagationService,
} from "../services/domain.js";
import { getATenantRepo } from "../repositories/tenant.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { logAudit } from "../utils/audit.js";
import { enqueueDomainVerification } from "../services/jobs/index.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";
import config from "../config/index.js";

/**
 * Resolve the tenant id for the current request. Throws 401 if the
 * auth middleware didn't populate it — defense in depth, the route
 * should already be gated.
 */
function requireTenantId(req) {
  const id = req.user?.tenantId;
  if (!id) {
    const err = new Error("Authentication required");
    err.statusCode = 401;
    throw err;
  }
  return id;
}

/** GET /api/domains/check-subdomain — Public */
export const checkSubdomainAvailability = asyncHandler(async (req, res) => {
  const { subdomain } = req.query;
  if (!subdomain) {
    return res.status(400).json({ success: false, message: "Subdomain parameter is required" });
  }
  const result = await checkSubdomainAvailabilityService(subdomain);
  res.json({ success: true, data: result });
});

/** PATCH /api/domains/subdomain — Private */
export const updateSubdomain = asyncHandler(async (req, res) => {
  const { subdomain } = req.body;
  if (!subdomain) {
    return res.status(400).json({ success: false, message: "Subdomain is required" });
  }
  const tenantId = requireTenantId(req);
  const tenant = await updateSubdomainService(tenantId, subdomain);

  logAudit(req.models, {
    req,
    action: "domain.subdomain_updated",
    resource: "Domain",
    resourceId: tenantId,
    changes: { subdomain: { to: subdomain } },
  });

  res.json({
    success: true,
    message: "Subdomain updated successfully",
    data: {
      subdomain: tenant.domains.subdomain,
      activeDomain: tenant.domains.subdomain.fullDomain,
    },
  });
});

/** GET /api/domains/check-custom-domain — Public */
export const checkCustomDomainAvailability = asyncHandler(async (req, res) => {
  const { domain } = req.query;
  if (!domain) {
    return res.status(400).json({ success: false, message: "Domain parameter is required" });
  }
  const result = await checkCustomDomainAvailabilityService(domain);
  res.json({ success: true, data: result });
});

/** POST /api/domains/custom — Private */
export const addCustomDomain = asyncHandler(async (req, res) => {
  const { domain, verificationMethod = "dns" } = req.body;
  if (!domain) {
    return res.status(400).json({ success: false, message: "Domain is required" });
  }
  if (!["dns", "cname", "txt"].includes(verificationMethod)) {
    return res.status(400).json({
      success: false,
      message: "Invalid verification method. Must be 'dns', 'cname', or 'txt'",
    });
  }

  const tenantId = requireTenantId(req);
  const result = await addCustomDomainService(tenantId, domain, verificationMethod);

  logAudit(req.models, {
    req,
    action: "domain.custom_added",
    resource: "Domain",
    resourceId: tenantId,
    metadata: { hostname: domain, verificationMethod },
  });

  res.status(201).json({
    success: true,
    message: "Custom domain added successfully. Please verify ownership to activate.",
    data: result,
  });
});

/** POST /api/domains/custom/verify — Private */
export const verifyCustomDomain = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const result = await verifyCustomDomainService(tenantId);

  if (result.verified) {
    logAudit(req.models, {
      req,
      action: "domain.custom_verified",
      resource: "Domain",
      resourceId: tenantId,
      metadata: {
        registryStatus: result.registryStatus,
        sslStatus: result.sslStatus,
      },
    });
    return res.json({
      success: true,
      message: result.message,
      data: {
        domain: result.tenant.domains.customDomain,
        activeDomain:
          result.tenant.domains.primaryDomain === "custom"
            ? result.tenant.domains.customDomain.name
            : result.tenant.domains.subdomain.fullDomain,
        registryStatus: result.registryStatus,
        sslStatus: result.sslStatus,
      },
    });
  }

  // Pending state: the sync attempt found no (or partial) DNS records
  // yet. Fire a background re-verification so the merchant doesn't have
  // to keep clicking "Verify" through propagation. BullMQ dedupes on
  // the stable jobId so repeat POSTs don't fan out multiple schedules.
  // The caller still gets the immediate 400 response — background
  // retries are fire-and-forget.
  try {
    const tenant = await getATenantRepo({}, { _id: tenantId });
    const hostname = tenant?.domains?.customDomain?.name;
    if (hostname && !tenant.domains.customDomain.isVerified) {
      await enqueueDomainVerification(tenantId, hostname, { source: "verify-endpoint" });
    }
  } catch (err) {
    // Enqueue failure must NOT block the HTTP response — log and move on.
    logger.warn("Failed to enqueue background domain verification", {
      tenantId: String(tenantId),
      error: err.message,
    });
  }

  res.status(400).json({
    success: false,
    message: result.message,
    data: { foundRecords: result.foundRecords, error: result.error },
  });
});

/** DELETE /api/domains/custom — Private */
export const removeCustomDomain = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const domainIdentifier =
    req.params.domainId ||
    req.query.domainId ||
    req.query.domain ||
    req.body?.domainId ||
    req.body?.domain ||
    null;
  const { tenant, removedDomain } = await removeCustomDomainService(tenantId, domainIdentifier);

  logAudit(req.models, {
    req,
    action: "domain.custom_removed",
    resource: "Domain",
    resourceId: tenantId,
    metadata: { hostname: removedDomain?.hostname || domainIdentifier || null },
  });

  res.json({
    success: true,
    message: `${removedDomain?.hostname || "Custom domain"} removed successfully.`,
    data: {
      subdomain: tenant.domains.subdomain,
      activeDomain: tenant.domains.subdomain.fullDomain,
      removedDomain,
    },
  });
});

/** PATCH /api/domains/primary — Private */
export const setPrimaryDomain = asyncHandler(async (req, res) => {
  const { primaryDomain } = req.body;
  if (!primaryDomain) {
    return res.status(400).json({ success: false, message: "primaryDomain is required" });
  }
  const tenantId = requireTenantId(req);
  const tenant = await setPrimaryDomainService(tenantId, primaryDomain);

  logAudit(req.models, {
    req,
    action: "domain.primary_changed",
    resource: "Domain",
    resourceId: tenantId,
    changes: { primaryDomain: { to: primaryDomain } },
  });

  const allDomains = [tenant.domains.subdomain.fullDomain];
  if (tenant.domains.customDomain?.name && tenant.domains.customDomain?.isVerified) {
    allDomains.push(tenant.domains.customDomain.name);
  }

  res.json({
    success: true,
    message: `Primary domain set to ${primaryDomain} successfully`,
    data: {
      primaryDomain: tenant.domains.primaryDomain,
      activeDomain:
        primaryDomain === "custom" && tenant.domains.customDomain?.name
          ? tenant.domains.customDomain.name
          : tenant.domains.subdomain.fullDomain,
      allDomains,
    },
  });
});

/** POST /api/domains/custom/ssl — Private */
export const enableSSL = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const result = await enableSSLService(tenantId);

  logAudit(req.models, {
    req,
    action: "domain.ssl_provisioned",
    resource: "Domain",
    resourceId: tenantId,
    metadata: { provider: result.domain?.ssl?.provider || null },
  });

  res.json({
    success: true,
    message: result.message,
    data: { domain: result.domain },
  });
});

/**
 * GET /api/domains/info — Private
 *
 * Returns consolidated domain state for the current tenant, combining
 * the legacy embedded fields (still the dashboard's primary read path
 * until D6 lands) with the Domain registry rows so the UI can start
 * surfacing real state machine statuses immediately.
 */
export const getDomainInfo = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const tenant = await getATenantRepo({}, { _id: tenantId });
  if (!tenant) {
    return res.status(404).json({ success: false, message: "Tenant not found" });
  }

  const info = await getDomainInfoService(tenant.domains.subdomain.fullDomain);

  // Layer in the Domain registry rows so the dashboard can see
  // status / ssl / dns subdocs without migrating off the legacy
  // embedded fields yet.
  const Domain = mongoose.model("Domain");
  const rows = await Domain.find({ tenantId }).lean();
  const registry = rows.map((r) => {
    if (r.verification) delete r.verification.tokenHash;
    return r;
  });

  res.json({ success: true, data: { ...info, registry } });
});

/** GET /api/domains/dns-check — Private */
export const checkDNSPropagation = asyncHandler(async (req, res) => {
  const { domain } = req.query;
  if (!domain) {
    return res.status(400).json({ success: false, message: "Domain parameter is required" });
  }
  const result = await checkDNSPropagationService(domain);
  res.json({ success: true, data: result });
});

/** GET /api/domains/admin/custom-domains — Admin */
export const getTenantsWithCustomDomains = asyncHandler(async (req, res) => {
  const tenants = await getTenantsWithCustomDomainsService();
  res.json({ success: true, data: { count: tenants.length, tenants } });
});

/** GET /api/domains/admin/pending-verifications — Admin */
export const getPendingVerifications = asyncHandler(async (req, res) => {
  const tenants = await getPendingVerificationsService();
  res.json({
    success: true,
    data: { count: tenants.length, pendingVerifications: tenants },
  });
});

/** GET /api/domains/verification-instructions — Private */
export const getVerificationInstructions = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const tenant = await getATenantRepo({}, { _id: tenantId });
  if (!tenant) {
    return res.status(404).json({ success: false, message: "Tenant not found" });
  }
  if (!tenant.domains.customDomain?.name) {
    return res.status(400).json({ success: false, message: "No custom domain configured" });
  }
  if (tenant.domains.customDomain.isVerified) {
    return res.status(400).json({ success: false, message: "Domain is already verified" });
  }

  const domain = tenant.domains.customDomain.name;
  const code = tenant.domains.customDomain.verificationCode;
  const method = tenant.domains.customDomain.verificationMethod || "dns";

  // Look up any CF-side validation records from the Domain registry
  // row so the dashboard sees the full set — ownership TXT, routing
  // CNAME/A, and any Cloudflare-requested DCV records.
  const Domain = mongoose.model("Domain");
  const row = await Domain.findOne({ tenantId, hostname: domain }).lean();
  const kind = row?.kind || null;

  const edgeCname = config.platformEdgeCname;
  const edgeIps = config.platformEdgeIps;

  const ownershipRecord = {
    type: "TXT",
    name: `_matjar-verification.${domain}`,
    value: code,
    purpose: "Ownership verification",
  };
  const routingRecords = [];
  if (kind === "custom_apex") {
    for (const ip of edgeIps) {
      routingRecords.push({ type: "A", name: domain, value: ip, purpose: "Traffic routing" });
    }
  } else if (edgeCname) {
    routingRecords.push({ type: "CNAME", name: domain, value: edgeCname, purpose: "Traffic routing" });
  }

  const records = [ownershipRecord, ...routingRecords];

  let instructions;
  switch (method) {
    case "dns":
    case "txt":
    case "cname":
      instructions = {
        method: routingRecords.length ? "CNAME + TXT Records" : "TXT Record",
        instructions: [
          "Add the DNS records below at your domain registrar or DNS provider:",
          ...records.map((r) => `  • ${r.type} ${r.name} → ${r.value} (${r.purpose})`),
          "TTL: 3600 (or your DNS provider's default)",
          "Wait for DNS propagation (usually 5-30 minutes)",
          "Click 'Verify Domain' to complete verification",
        ],
        record: ownershipRecord,
        records,
      };
      break;

    default:
      instructions = { method: "Unknown", instructions: ["Please contact support"] };
  }

  res.json({
    success: true,
    data: { domain, verificationMethod: method, instructions },
  });
});
