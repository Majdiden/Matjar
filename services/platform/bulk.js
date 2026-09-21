/**
 * Bulk tenant operations.
 *
 * Deliberately narrow: a fixed allow-list of reversible actions (never purge,
 * never delete), at most BULK_MAX_TENANTS ids per call, run SEQUENTIALLY
 * through the same single-tenant services the console uses — so every
 * lifecycle guard, program rule and plan rule applies per tenant, and each
 * tenant gets its own audit row exactly as if the operator had clicked it.
 * One tenant failing never stops the others; the caller gets per-tenant
 * outcomes.
 */
import mongoose from "mongoose";
import { suspendTenant, unsuspendTenant } from "../tenantLifecycle.js";
import { addMember, removeMember } from "./programs.js";
import { schedulePlanChange } from "./billing/planChanges.js";
import { BULK_ACTIONS, BULK_MAX_TENANTS } from "../../validators/bulk.validator.js";

export { BULK_ACTIONS, BULK_MAX_TENANTS };

/** Pure guard used by the service and unit-tested directly. */
export function validateBulkRequest({ action, tenantIds }) {
  if (!BULK_ACTIONS.includes(action)) return `Unsupported bulk action "${action}"`;
  if (!Array.isArray(tenantIds) || tenantIds.length === 0) return "No tenants selected";
  if (tenantIds.length > BULK_MAX_TENANTS) return `At most ${BULK_MAX_TENANTS} tenants per bulk action`;
  if (new Set(tenantIds.map(String)).size !== tenantIds.length) return "Duplicate tenant ids";
  return null;
}

function lifecycleSnapshot(t) {
  return t
    ? {
        lifecycle: t.lifecycle?.state || null,
        subscriptionStatus: t.subscriptionStatus,
        subscriptionPlan: t.subscriptionPlan || null,
        accessPrograms: t.accessPrograms || [],
      }
    : null;
}

async function snapshot(tenantId) {
  const t = await mongoose
    .model("Tenant")
    .findById(tenantId)
    .select("lifecycle.state subscriptionStatus subscriptionPlan accessPrograms")
    .lean();
  return lifecycleSnapshot(t);
}

/**
 * Run one action for one tenant. Returns { ok, before, after, error?, code? }.
 * Never throws — errors become the per-tenant outcome.
 */
async function runOne({ action, tenantId, reason, params, actor }) {
  const before = await snapshot(tenantId);
  if (!before) return { ok: false, error: "Tenant not found", code: 404, before: null, after: null };
  try {
    switch (action) {
      case "suspend":
        await suspendTenant({ tenantId, reason, platformUserEmail: actor.email });
        break;
      case "unsuspend":
        await unsuspendTenant({ tenantId, reason, platformUserEmail: actor.email });
        break;
      case "add_to_program":
        await addMember(params.programId, tenantId);
        break;
      case "remove_from_program":
        await removeMember(params.programId, tenantId);
        break;
      case "change_plan":
        await schedulePlanChange({
          tenantId,
          toPlan: params.planKey,
          effectiveAt: params.effectiveAt || "next_period",
          requestedBy: "operator",
          requestedById: actor.id,
          reason,
          selfService: false,
        });
        break;
      default:
        return { ok: false, error: "Unsupported action", code: 400, before, after: before };
    }
    return { ok: true, before, after: await snapshot(tenantId) };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "Failed",
      code: err?.statusCode || 500,
      before,
      after: before,
    };
  }
}

/**
 * Execute the bulk action sequentially. `onEach(result)` is awaited after
 * every tenant so the controller can write the per-tenant audit row.
 */
export async function runBulkTenantAction({ action, tenantIds, reason, params = {}, actor, onEach }) {
  const problem = validateBulkRequest({ action, tenantIds });
  if (problem) {
    const err = new Error(problem);
    err.statusCode = 400;
    throw err;
  }
  const results = [];
  for (const tenantId of tenantIds) {
    const r = await runOne({ action, tenantId, reason, params, actor });
    const row = { tenantId: String(tenantId), ok: r.ok, ...(r.ok ? {} : { error: r.error, code: r.code }) };
    results.push(row);
    if (onEach) await onEach({ ...row, before: r.before, after: r.after });
  }
  const okCount = results.filter((r) => r.ok).length;
  return { results, summary: { total: results.length, ok: okCount, failed: results.length - okCount } };
}
