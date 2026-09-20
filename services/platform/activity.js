/**
 * Human-readable activity timeline for one tenant.
 *
 * Merges two sources into a single, newest-first list:
 *   - platform ledger rows (PlatformAuditLog, admin DB) for that tenant —
 *     what OPERATORS did to the store;
 *   - the tenant's own AuditLog (merchant-side, via scoped models) — what
 *     the MERCHANT's staff did inside the store.
 *
 * Labels come from a small template map keyed by action; unknown actions
 * fall back to a humanised form of the action string so nothing renders
 * as a raw identifier.
 */
import mongoose from "mongoose";
import { createScopedModels } from "../../utils/scopedModel.js";
import { redactForAudit } from "./audit.js";

const ACTION_TEMPLATES = {
  // Platform ledger
  "tenant.suspend": ({ actor, reason }) => `${actor} suspended the store${reason ? ` — ${reason}` : ""}`,
  "tenant.unsuspend": ({ actor }) => `${actor} unsuspended the store`,
  "tenant.schedule_deletion": ({ actor, reason }) => `${actor} scheduled the store for deletion${reason ? ` — ${reason}` : ""}`,
  "tenant.cancel_deletion": ({ actor }) => `${actor} cancelled the scheduled deletion`,
  "tenant.purge": ({ actor }) => `${actor} purged the store's data`,
  "tenant.setup.retry": ({ actor }) => `${actor} retried store setup`,
  "tenant.seed_starter_content": ({ actor, after }) =>
    after?.seeded ? `${actor} seeded starter content (${after.products ?? 0} products)` : `${actor} attempted to seed starter content (nothing seeded)`,
  "plan.change": ({ actor, after, before }) => `${actor} changed the plan${before?.plan ? ` from ${before.plan}` : ""}${after?.plan ? ` to ${after.plan}` : ""}`,
  "impersonation.request": ({ actor, reason }) => `${actor} requested impersonation access${reason ? ` (${reason})` : ""}`,
  "impersonation.approve_by_code": ({ actor }) => `${actor} approved impersonation with the owner's code`,
  "impersonation.enter": ({ actor }) => `${actor} started an impersonation session`,
  "impersonation.exit": ({ actor }) => `${actor} ended the impersonation session`,
  "impersonation.mint_legacy": ({ actor }) => `${actor} minted a legacy impersonation token`,
  "export.request": ({ actor }) => `${actor} requested a data export`,
  "export.download": ({ actor }) => `${actor} downloaded a data export`,
  "export.sync_download": ({ actor }) => `${actor} downloaded a synchronous data export`,
  "queue.job.retry": ({ actor, metadata }) => `${actor} retried job ${metadata?.jobName || ""} in ${metadata?.queue || "a queue"}`.replace(/\s+/g, " "),
  "flags.update": ({ actor, metadata }) => `${actor} changed feature flags${metadata?.keys?.length ? `: ${metadata.keys.join(", ")}` : ""}`,
  "phone_countries.update": ({ actor }) => `${actor} updated the phone country list`,
  "billing.statement.record_payment": ({ actor }) => `${actor} recorded a statement payment`,
  "billing.override.create": ({ actor, reason }) => `${actor} added a pricing override${reason ? ` — ${reason}` : ""}`,
  "tenant_users.revoke": ({ actor, resourceId }) => `${actor} revoked merchant staff access (${resourceId})`,
  // Merchant-side AuditLog actions (tenant DB)
  "user.email_verified": ({ actor }) => `${actor} verified their email`,
  "user.profile_updated": ({ actor }) => `${actor} updated their profile`,
  "order.status_updated": ({ actor, details }) => `${actor} updated an order status${details?.to ? ` to ${details.to}` : ""}`,
  "product.created": ({ actor }) => `${actor} created a product`,
  "product.updated": ({ actor }) => `${actor} updated a product`,
  "product.deleted": ({ actor }) => `${actor} deleted a product`,
  "settings.updated": ({ actor }) => `${actor} changed store settings`,
  "impersonation.approved": ({ actor }) => `${actor} approved a support impersonation request`,
  "impersonation.denied": ({ actor }) => `${actor} denied a support impersonation request`,
};

/** "order.status_updated" → "Order status updated" */
export function humanizeAction(action) {
  return String(action || "")
    .replace(/[._]+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Build the display label for one normalised activity item.
 * Pure — unit-tested in tests/unit/platformActivity.test.js.
 */
export function buildActivityLabel(item) {
  const actor = item.actor || (item.source === "platform" ? "A platform operator" : "Someone");
  const tpl = ACTION_TEMPLATES[item.action];
  if (tpl) {
    try {
      return tpl({ ...item, actor });
    } catch {
      /* fall through */
    }
  }
  return `${actor}: ${humanizeAction(item.action)}`;
}

function fromPlatformRow(r) {
  const base = {
    at: r.createdAt,
    source: "platform",
    actor: r.actorEmail || (r.actorType === "system" ? "System" : null),
    action: r.action,
    resourceType: r.resourceType || null,
    resourceId: r.resourceId || null,
    reason: r.reason || null,
    before: r.before ?? null,
    after: r.after ?? null,
    metadata: r.metadata ?? null,
    outcome: r.outcome || "success",
    details: null,
  };
  return { ...base, label: buildActivityLabel(base) };
}

function fromMerchantRow(r) {
  const base = {
    at: r.createdAt,
    source: "merchant",
    actor: r.actorName || null,
    action: r.action,
    resourceType: r.resource || null,
    resourceId: r.resourceId ? String(r.resourceId) : null,
    reason: null,
    before: null,
    after: null,
    metadata: redactForAudit(r.metadata ?? null),
    outcome: "success",
    details: redactForAudit(r.changes ?? null),
  };
  return { ...base, label: buildActivityLabel(base) };
}

/**
 * Page through the merged timeline. Both sources are fetched newest-first
 * with the same window and merged in memory; page N asks each source for
 * N*limit rows and slices — simple and correct for the sizes an operator
 * reads (bounded by MAX_WINDOW).
 */
export async function getTenantActivity(tenantId, { page = 1, limit = 25 } = {}) {
  const MAX_WINDOW = 500;
  const window = Math.min(page * limit, MAX_WINDOW);
  const PlatformAuditLog = mongoose.model("PlatformAuditLog");
  const models = createScopedModels(mongoose.connection, tenantId);

  const [platformRows, merchantRows] = await Promise.all([
    PlatformAuditLog.find({ tenantId }).sort({ createdAt: -1 }).limit(window).lean(),
    models.AuditLog ? models.AuditLog.find({}).sort({ createdAt: -1 }).limit(window).lean() : [],
  ]);

  const merged = [...platformRows.map(fromPlatformRow), ...merchantRows.map(fromMerchantRow)].sort(
    (a, b) => new Date(b.at) - new Date(a.at)
  );
  const start = (page - 1) * limit;
  const items = merged.slice(start, start + limit);
  const exhausted = platformRows.length < window && merchantRows.length < window;
  const hasMore = !exhausted || merged.length > start + limit;
  return { items, page, limit, hasMore: hasMore && start + limit < MAX_WINDOW };
}
