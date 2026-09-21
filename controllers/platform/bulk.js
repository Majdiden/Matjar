/**
 * Bulk tenant operations controller. The route requires requireRecentReauth
 * and at least one bulk-capable scope; each ACTION then needs the same scope
 * as its single-tenant equivalent (see BULK_ACTION_SCOPE) so bulk can never
 * be a back door around billing.write / flags.write. One platform audit row
 * per tenant (action-specific, with before/after) plus one summary row.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { PLATFORM_SCOPES } from "../../config/platformScopes.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import { runBulkTenantAction } from "../../services/platform/bulk.js";

const ACTION_AUDIT = {
  suspend: "tenant.suspend",
  unsuspend: "tenant.unsuspend",
  add_to_program: "program.member.add",
  remove_from_program: "program.member.remove",
  change_plan: "plan.change",
};

/** Scope required per bulk action — mirrors the single-tenant routes. */
export const BULK_ACTION_SCOPE = Object.freeze({
  suspend: PLATFORM_SCOPES.TENANT_LIFECYCLE,
  unsuspend: PLATFORM_SCOPES.TENANT_LIFECYCLE,
  add_to_program: PLATFORM_SCOPES.FLAGS_WRITE,
  remove_from_program: PLATFORM_SCOPES.FLAGS_WRITE,
  change_plan: PLATFORM_SCOPES.BILLING_WRITE,
});
export const BULK_SCOPES = Object.freeze([...new Set(Object.values(BULK_ACTION_SCOPE))]);

export const runTenants = asyncHandler(async (req, res) => {
  const { action, tenantIds, reason, params } = req.body;
  const needed = BULK_ACTION_SCOPE[action];
  if (!needed || !req.platformUser?.scopes?.includes(needed)) {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Insufficient platform scopes.", missing: [needed] });
  }
  const actor = { id: req.platformUser.id, email: req.platformUser.email };
  const batchId = `bulk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const data = await runBulkTenantAction({
    action,
    tenantIds,
    reason,
    params,
    actor,
    onEach: async (r) => {
      await recordPlatformAudit(req, {
        action: ACTION_AUDIT[action],
        resourceType: "Tenant",
        resourceId: r.tenantId,
        tenantId: r.tenantId,
        reason,
        before: r.before,
        after: r.after,
        outcome: r.ok ? "success" : "failure",
        metadata: { bulk: true, batchId, params, ...(r.ok ? {} : { error: r.error }) },
      });
    },
  });

  await recordPlatformAudit(req, {
    action: "bulk.tenants",
    resourceType: "BulkAction",
    resourceId: batchId,
    reason,
    metadata: { action, params, ...data.summary },
  });

  res.json({ success: true, data: { batchId, ...data } });
});
