/**
 * Permanent store deletion ("hard delete").
 *
 * The lifecycle "purge" (services/tenantLifecycle.js) wipes a store's data
 * but keeps the Tenant row as an archived tombstone. A hard delete removes
 * the store completely:
 *
 *   1. Stop serving: mark the tenant inactive and drop its Domain rows, which
 *      also frees its hostnames for reuse.
 *   2. Files: Cloudinary folders, media-library assets, data-export files.
 *   3. Every tenant-scoped collection (TENANT_SCOPED_MODELS — the same list
 *      the request-scoping layer uses, so a new model can't be forgotten).
 *   4. Admin-database rows that only exist for this store.
 *   5. The Tenant row itself, LAST.
 *
 * Kept on purpose (RETAINED_PLATFORM_RECORDS): the platform's own audit
 * ledger and financial records. They reference the store by id only and
 * are the platform's records, not the store's.
 *
 * Resumable instead of transactional: a multi-collection wipe of a large
 * store can exceed MongoDB transaction limits. Every step is an idempotent
 * deleteMany and the Tenant row goes last, so if anything fails the store
 * stays listed (inactive, marked deleted) and running the action again
 * finishes the job. Files are best-effort and reported, never blocking.
 */
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { createScopedModels, TENANT_SCOPED_MODELS } from "../utils/scopedModel.js";
import { purgeTenantFiles } from "./tenantFilePurge.js";
import { invalidateFeatureFlagCache } from "./featureFlags.js";

/** Platform records deliberately kept after a hard delete. */
export const RETAINED_PLATFORM_RECORDS = Object.freeze([
  "PlatformAuditLog",
  "BillingStatement",
  "PlatformFeeEvent",
  "PlanChange",
]);

function assertTenantObjectId(tenantId) {
  // A missing id would turn the scoped `{ tenantId }` filter into `{}` and
  // delete EVERY store's rows. Refuse anything that isn't a real ObjectId.
  if (!tenantId || !mongoose.isValidObjectId(tenantId) || String(tenantId).length !== 24) {
    throw new Error(`Refusing tenant wipe: invalid tenant id "${tenantId}"`);
  }
  return new mongoose.Types.ObjectId(String(tenantId));
}

/**
 * Delete every tenant-scoped document of one store. Shared by the lifecycle
 * purge and the hard delete. Never throws for a single collection; returns
 * per-collection counts and the names that failed.
 */
export async function wipeTenantScopedData(tenantId) {
  const id = assertTenantObjectId(tenantId);
  const models = createScopedModels(mongoose.connection, id);
  const counts = {};
  const failed = [];
  for (const name of TENANT_SCOPED_MODELS) {
    try {
      const r = await models[name].deleteMany({});
      counts[name] = r.deletedCount || 0;
    } catch (err) {
      failed.push(name);
      logger.warn("wipeTenantScopedData: collection wipe failed", { tenantId: String(id), name, error: err.message });
    }
  }
  return { counts, failed };
}

/** Admin-DB rows owned by one store: [label, () => deleteMany/updateMany promise]. */
function adminRowDeletions(id, merchantUserIds) {
  const m = (name) => mongoose.model(name);
  return [
    // Platform staff rows carry no tenantId, but never touch them regardless.
    ["TenantUser", () => m("TenantUser").deleteMany({ tenantId: id, platformAdmin: { $ne: true } })],
    ["Subscription", () => m("Subscription").deleteMany({ user: { $in: merchantUserIds } })],
    ["TenantExport", () => m("TenantExport").deleteMany({ tenantId: id })],
    ["FeatureOverride", () => m("FeatureOverride").deleteMany({ scope: "tenant", scopeId: id })],
    ["PricingOverride", () => m("PricingOverride").deleteMany({ scope: "tenant", scopeId: id })],
    ["StorefrontHealth", () => m("StorefrontHealth").deleteMany({ tenantId: id })],
    ["TenantUsageSnapshot", () => m("TenantUsageSnapshot").deleteMany({ tenantId: id })],
    ["PlatformFeedback", () => m("PlatformFeedback").deleteMany({ tenantId: id })],
    ["Incident", () => m("Incident").updateMany({ affectedTenantIds: id }, { $pull: { affectedTenantIds: id } })],
  ];
}

const affected = (r) => r?.deletedCount ?? r?.modifiedCount ?? 0;

/**
 * Permanently delete a store. Callers enforce authorization (scope
 * `tenant.delete` + password confirmation) and write the operator audit row.
 *
 * @returns {Promise<{tenantId:string, name:string, slug:string, counts:object,
 *   files:{deleted:number, failed:string[]}, failed:string[], completed:boolean}>}
 *   `completed` is false when any database step failed (the Tenant row is
 *   then kept so the action can be re-run).
 */
export async function hardDeleteTenant(tenantId) {
  const id = assertTenantObjectId(tenantId);
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(id).lean();
  if (!tenant) {
    const err = new Error("Tenant not found");
    err.statusCode = 404;
    throw err;
  }

  const counts = {};
  const failed = [];
  const step = async (label, fn) => {
    try {
      counts[label] = affected(await fn());
    } catch (err) {
      failed.push(label);
      logger.warn("hardDeleteTenant: step failed", { tenantId: String(id), label, error: err.message });
    }
  };

  // 1. Stop serving immediately and free the hostnames.
  await Tenant.updateOne({ _id: id }, { $set: { isActive: false, deletedAt: tenant.deletedAt || new Date() } });
  await step("Domain", () => mongoose.model("Domain").deleteMany({ tenantId: id }));

  // 2. Files — read their handles before the rows that hold them are wiped.
  const assets = await mongoose.model("Asset").find({ tenantId: id }).select("publicId url storage").lean();
  const exports = await mongoose.model("TenantExport").find({ tenantId: id }).select("storageKey provider").lean();
  const files = await purgeTenantFiles(tenant, { assets, exports });

  // 3. Store data.
  const scoped = await wipeTenantScopedData(id);
  Object.assign(counts, scoped.counts);
  failed.push(...scoped.failed);

  // 4. Admin-DB rows that only exist for this store.
  const merchantUserIds = (
    await mongoose.model("TenantUser").find({ tenantId: id, platformAdmin: { $ne: true } }).select("_id").lean()
  ).map((u) => u._id);
  for (const [label, fn] of adminRowDeletions(id, merchantUserIds)) await step(label, fn);

  // 5. The store record — only once everything above succeeded.
  const completed = failed.length === 0;
  if (completed) await step("Tenant", () => Tenant.deleteOne({ _id: id }));

  invalidateFeatureFlagCache();
  const result = {
    tenantId: String(id),
    name: tenant.settings?.storeName || tenant.name,
    slug: tenant.slug,
    counts,
    files,
    failed,
    completed: completed && !failed.includes("Tenant"),
  };
  logger.warn("Tenant hard-deleted", { ...result, counts: undefined });
  return result;
}
