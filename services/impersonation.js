/**
 * Support-staff impersonation.
 *
 * A platform admin can mint a short-lived tenant JWT for any store's
 * admin user so they can reproduce a bug or walk a merchant through
 * a flow. Every mint is audit-logged with:
 *   - platformUserId (who)
 *   - tenantId (into which store)
 *   - impersonatedUserId (as whom)
 *   - reason (free text — required; no silent impersonation)
 *
 * Tokens are capped at 30 minutes and carry an `impersonatedBy` claim
 * so downstream audit entries written during the session can be traced
 * back to the real actor, not just the impersonated one.
 */

import mongoose from "mongoose";
import { signJWT } from "../utils/misc.js";
import { createScopedModels } from "../utils/scopedModel.js";

const MAX_TTL_SECONDS = 30 * 60;

export async function mintImpersonationToken({
  platformUser,
  tenantId,
  reason,
  ttlSeconds = MAX_TTL_SECONDS,
}) {
  if (!reason || String(reason).trim().length < 4) {
    throw new Error("Impersonation reason is required (min 4 chars)");
  }
  const ttl = Math.min(Math.max(Number(ttlSeconds) || MAX_TTL_SECONDS, 60), MAX_TTL_SECONDS);

  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  const models = createScopedModels(mongoose.connection, tenant._id);
  const adminUser = await models.User.findOne({ roles: "admin", isActive: true })
    .select("_id email tokenVersion roles")
    .lean();
  if (!adminUser) throw new Error("No admin user found for tenant");

  const token = signJWT(
    {
      userId: String(adminUser._id),
      tenantId: String(tenant._id),
      tokenVersion: adminUser.tokenVersion ?? 0,
      impersonatedBy: platformUser.id,
      impersonationReason: reason.slice(0, 200),
    },
    `${ttl}s`
  );

  // Audit the mint itself into the tenant's own log so the merchant can
  // see that a support agent logged in on their behalf.
  try {
    await models.AuditLog.create({
      tenantId: tenant._id,
      actor: null,
      actorName: `platform:${platformUser.email || platformUser.id}`,
      action: "impersonation.minted",
      resource: "user",
      resourceId: adminUser._id,
      metadata: { reason: reason.slice(0, 200), ttlSeconds: ttl },
    });
  } catch (_) {
    // Audit failures must not block the support workflow.
  }

  return {
    token,
    tenantId: String(tenant._id),
    userId: String(adminUser._id),
    userEmail: adminUser.email,
    expiresIn: ttl,
  };
}
