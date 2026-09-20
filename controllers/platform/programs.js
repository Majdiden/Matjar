/**
 * Access programs + per-tenant feature overrides (platform admin).
 * Reads: support.read. Writes: flags.write. Every write is audited.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import * as svc from "../../services/platform/programs.js";

export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.listPrograms(req.query) });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.getProgram(req.params.id) });
});

export const create = asyncHandler(async (req, res) => {
  const { reason, ...body } = req.body;
  const program = await svc.createProgram(body, req.platformUser.id);
  await recordPlatformAudit(req, {
    action: "program.create",
    resourceType: "AccessProgram",
    resourceId: program._id,
    reason,
    after: program,
  });
  res.status(201).json({ success: true, data: program });
});

export const update = asyncHandler(async (req, res) => {
  const { reason, ...patch } = req.body;
  const { before, after } = await svc.updateProgram(req.params.id, patch);
  await recordPlatformAudit(req, {
    action: "program.update",
    resourceType: "AccessProgram",
    resourceId: after._id,
    reason,
    before,
    after,
  });
  res.json({ success: true, data: after });
});

export const close = asyncHandler(async (req, res) => {
  const { before, after, program } = await svc.closeProgram(req.params.id);
  await recordPlatformAudit(req, {
    action: "program.close",
    resourceType: "AccessProgram",
    resourceId: program._id,
    reason: req.body.reason,
    before,
    after,
  });
  res.json({ success: true, data: program });
});

export const members = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.listMembers(req.params.id, req.query) });
});

export const addMember = asyncHandler(async (req, res) => {
  const r = await svc.addMember(req.params.id, req.body.tenantId);
  await recordPlatformAudit(req, {
    action: "program.member.add",
    resourceType: "AccessProgram",
    resourceId: req.params.id,
    tenantId: req.body.tenantId,
    reason: req.body.reason,
    after: { programKey: r.programKey, tenant: r.tenant },
  });
  res.status(201).json({ success: true, data: r });
});

export const removeMember = asyncHandler(async (req, res) => {
  const r = await svc.removeMember(req.params.id, req.params.tenantId);
  await recordPlatformAudit(req, {
    action: "program.member.remove",
    resourceType: "AccessProgram",
    resourceId: req.params.id,
    tenantId: req.params.tenantId,
    reason: req.body?.reason || null,
    before: { programKey: r.programKey, tenant: r.tenant },
  });
  res.json({ success: true, data: r });
});

// ---- tenant feature overrides (mounted at /tenants/:tenantId/feature-overrides)

export const listTenantOverrides = asyncHandler(async (req, res) => {
  const includeRevoked = req.query.includeRevoked === "1" || req.query.includeRevoked === "true";
  res.json({ success: true, data: await svc.listTenantOverrides(req.params.tenantId, { includeRevoked }) });
});

export const createTenantOverride = asyncHandler(async (req, res) => {
  const r = await svc.createTenantOverride(req.params.tenantId, req.body, req.platformUser.id);
  await recordPlatformAudit(req, {
    action: "feature_override.create",
    resourceType: "FeatureOverride",
    resourceId: r.override._id,
    tenantId: req.params.tenantId,
    reason: req.body.reason,
    before: r.replaced ? { key: r.replaced.key, value: r.replaced.value } : null,
    after: { key: r.override.key, value: r.override.value, endsAt: r.override.endsAt },
  });
  res.status(201).json({ success: true, data: r });
});

export const revokeTenantOverride = asyncHandler(async (req, res) => {
  const o = await svc.revokeTenantOverride(req.params.tenantId, req.params.overrideId, req.platformUser.id);
  await recordPlatformAudit(req, {
    action: "feature_override.revoke",
    resourceType: "FeatureOverride",
    resourceId: o._id,
    tenantId: req.params.tenantId,
    reason: req.body.reason,
    before: { key: o.key, value: o.value },
    after: { revokedAt: o.revokedAt },
  });
  res.json({ success: true, data: o });
});
