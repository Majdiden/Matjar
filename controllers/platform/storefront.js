/**
 * Storefront operations (platform console): Domain registry, theme catalog,
 * storefront health. Reads on support.read; domain writes on tenant.lifecycle;
 * theme catalog status on flags.write. Every write audits.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import {
  listDomains,
  domainStatusCounts,
  retryDomainVerification,
  setDomainPrimary,
  removeDomain,
  listThemes,
  listThemeStores,
  setThemeStatus,
  checkTenantStorefront,
  listHealth,
  getTenantHealth,
} from "../../services/platform/storefront.js";

export const domains = asyncHandler(async (req, res) => {
  const [{ rows, pagination }, counts] = await Promise.all([listDomains(req.query), domainStatusCounts()]);
  res.json({ success: true, data: { domains: rows, pagination, counts } });
});

export const domainRetry = asyncHandler(async (req, res) => {
  const { before, after } = await retryDomainVerification(req.params.id);
  await recordPlatformAudit(req, {
    action: "domain.retry_verification",
    resourceType: "Domain",
    resourceId: before._id,
    tenantId: before.tenantId,
    reason: req.body?.reason,
    before: { status: before.status, ssl: before.ssl?.status },
    after: { status: after?.status, ssl: after?.ssl?.status },
  });
  res.json({ success: true, data: after });
});

export const domainSetPrimary = asyncHandler(async (req, res) => {
  const { before, after } = await setDomainPrimary(req.params.id);
  await recordPlatformAudit(req, {
    action: "domain.set_primary",
    resourceType: "Domain",
    resourceId: before._id,
    tenantId: before.tenantId,
    reason: req.body?.reason,
    before: { hostname: before.hostname, isPrimary: before.isPrimary },
    after: { hostname: after?.hostname, isPrimary: after?.isPrimary },
  });
  res.json({ success: true, data: after });
});

export const domainRemove = asyncHandler(async (req, res) => {
  const { before } = await removeDomain(req.params.id);
  await recordPlatformAudit(req, {
    action: "domain.remove",
    resourceType: "Domain",
    resourceId: before._id,
    tenantId: before.tenantId,
    reason: req.body?.reason,
    before: { hostname: before.hostname, kind: before.kind, status: before.status, isPrimary: before.isPrimary },
    after: null,
  });
  res.json({ success: true, data: { id: String(before._id) } });
});

export const themes = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await listThemes() });
});

export const themeStores = asyncHandler(async (req, res) => {
  const { rows, pagination } = await listThemeStores(String(req.params.slug).toLowerCase(), req.query);
  res.json({ success: true, data: { tenants: rows, pagination } });
});

export const themeStatus = asyncHandler(async (req, res) => {
  const { before, after } = await setThemeStatus(req.params.id, req.body.status);
  await recordPlatformAudit(req, {
    action: "theme.status.update",
    resourceType: "Theme",
    resourceId: req.params.id,
    reason: req.body?.reason,
    before: { slug: before.slug, status: before.status },
    after: { slug: after.slug, status: after.status },
  });
  res.json({ success: true, data: after });
});

export const health = asyncHandler(async (req, res) => {
  const { rows, pagination } = await listHealth(req.query);
  res.json({ success: true, data: { results: rows, pagination } });
});

export const tenantHealth = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getTenantHealth(req.params.tenantId) });
});

export const runTenantCheck = asyncHandler(async (req, res) => {
  const result = await checkTenantStorefront(req.params.tenantId, { source: "manual" });
  await recordPlatformAudit(req, {
    action: "storefront.health.check",
    resourceType: "Tenant",
    resourceId: req.params.tenantId,
    tenantId: req.params.tenantId,
    metadata: { host: result.host, overall: result.overall },
  });
  res.json({ success: true, data: result });
});
