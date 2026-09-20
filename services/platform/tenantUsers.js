/**
 * Merchant staff management from the platform console.
 *
 * Every read/write goes through the tenant's scoped models so nothing can
 * cross tenants; shoppers (`customer` role) are never returned or touched.
 * Reuses services/staff.js for invites so email + token handling stays in
 * one place. The core mutations take `models` explicitly so they can be
 * unit-tested with mocks.
 */
import mongoose from "mongoose";
import { createScopedModels } from "../../utils/scopedModel.js";
import { APIError } from "../../middlewares/errorHandler.js";
import { resendInvite, revokeInvite } from "../staff.js";

const STAFF_ROLES = ["admin", "manager", "staff"];
const STAFF_FILTER = { roles: { $elemMatch: { $in: STAFF_ROLES } } };
// Whitelisted output — never password/reset/token material.
const STAFF_SELECT = "name email roles customRoleIds isActive deactivatedBy emailVerified lastLoginAt createdAt";
const WRITE_BLOCKED_STATES = new Set(["closed", "archived"]);

/** Load the tenant once per request; hydrated doc (needed by invite links). */
export async function loadTenant(tenantId) {
  const tenant = await mongoose.model("Tenant").findById(tenantId).select("name slug domains deletedAt lifecycle.state");
  if (!tenant) throw new APIError("Tenant not found", 404);
  return tenant;
}

/** Writes are refused on deleted/closed/archived stores. */
export function assertTenantWritable(tenant) {
  if (tenant.deletedAt || WRITE_BLOCKED_STATES.has(tenant.lifecycle?.state)) {
    throw new APIError("This store is closed or deleted; staff changes are not allowed.", 409);
  }
}

const scoped = (tenantId) => createScopedModels(mongoose.connection, tenantId);

export async function listTenantStaff(tenantId) {
  const models = scoped(tenantId);
  const users = await models.User.find(STAFF_FILTER).select(STAFF_SELECT).sort({ createdAt: 1 }).lean();

  const roleIds = [...new Set(users.flatMap((u) => (u.customRoleIds || []).map(String)))];
  const roleNames = new Map();
  if (roleIds.length && models.Role) {
    const roles = await models.Role.find({ _id: { $in: roleIds } }).select("name").lean();
    roles.forEach((r) => roleNames.set(String(r._id), r.name));
  }

  const passkeyCounts = new Map();
  if (models.WebauthnCredential && users.length) {
    // Scoped aggregate: the tenant plugin injects the tenantId match.
    const rows = await models.WebauthnCredential.aggregate([
      { $match: { user: { $in: users.map((u) => u._id) } } },
      { $group: { _id: "$user", n: { $sum: 1 } } },
    ]);
    rows.forEach((r) => passkeyCounts.set(String(r._id), r.n));
  }

  return users.map((u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    roles: u.roles || [],
    customRoles: (u.customRoleIds || []).map((id) => roleNames.get(String(id)) || "unknown"),
    isActive: u.isActive !== false,
    deactivatedBy: u.isActive === false ? u.deactivatedBy || null : null,
    emailVerified: !!u.emailVerified,
    lastLoginAt: u.lastLoginAt || null,
    createdAt: u.createdAt,
    passkeyCount: passkeyCounts.get(String(u._id)) || 0,
  }));
}

/** Open invitations (never accepted) — pending, expired and revoked, with status. */
export async function listTenantInvites(tenantId) {
  const models = scoped(tenantId);
  const invites = await models.StaffInvite.find({ acceptedAt: null })
    .select("email role invitedBy expiresAt revokedAt createdAt")
    .sort({ createdAt: -1 })
    .lean();
  const inviterIds = [...new Set(invites.map((i) => i.invitedBy).filter(Boolean).map(String))];
  const inviters = new Map();
  if (inviterIds.length) {
    const rows = await models.User.find({ _id: { $in: inviterIds } }).select("name email").lean();
    rows.forEach((r) => inviters.set(String(r._id), r.name || r.email));
  }
  const now = new Date();
  return invites.map((i) => ({
    id: String(i._id),
    email: i.email,
    role: i.role,
    invitedBy: i.invitedBy ? inviters.get(String(i.invitedBy)) || null : null,
    expiresAt: i.expiresAt,
    revokedAt: i.revokedAt || null,
    createdAt: i.createdAt,
    status: i.revokedAt ? "revoked" : i.expiresAt && i.expiresAt < now ? "expired" : "pending",
  }));
}

async function getStaffOrThrow(models, userId) {
  // Scoped find: a userId from another tenant is simply not found (404).
  const user = await models.User.findOne({ _id: userId, ...STAFF_FILTER }).select(STAFF_SELECT).lean();
  if (!user) throw new APIError("Staff member not found", 404);
  return user;
}

/**
 * Revoke a staff member's access: deactivate, bump tokenVersion (kills every
 * issued access token), revoke refresh tokens. Refuses to remove the
 * tenant's only active admin — checked before AND re-verified after the
 * write (rolled back if a concurrent revoke emptied the admin set).
 */
export async function revokeStaffWithModels(models, userId) {
  const user = await getStaffOrThrow(models, userId);
  if (user.isActive === false) throw new APIError("Staff member is already revoked", 400);
  const isAdmin = (user.roles || []).includes("admin");
  if (isAdmin) {
    const admins = await models.User.countDocuments({ roles: "admin", isActive: true });
    if (admins <= 1) throw new APIError("Cannot revoke the tenant's only active admin", 409);
  }
  await models.User.updateOne(
    { _id: userId },
    { $set: { isActive: false, deactivatedBy: "platform", updatedAt: new Date() }, $inc: { tokenVersion: 1 } }
  );
  if (isAdmin) {
    const remaining = await models.User.countDocuments({ roles: "admin", isActive: true });
    if (remaining === 0) {
      await models.User.updateOne({ _id: userId }, { $set: { isActive: true, deactivatedBy: null } });
      throw new APIError("Cannot revoke the tenant's only active admin", 409);
    }
  }
  if (models.RefreshToken) {
    await models.RefreshToken.updateMany({ user: user._id, isRevoked: false }, { $set: { isRevoked: true } });
  }
  return {
    before: { isActive: true, roles: user.roles },
    after: { isActive: false, deactivatedBy: "platform", roles: user.roles },
  };
}

export async function reactivateStaffWithModels(models, userId) {
  const user = await getStaffOrThrow(models, userId);
  if (user.isActive !== false) throw new APIError("Staff member is already active", 400);
  if (user.deactivatedBy === "merchant") {
    throw new APIError("This member was removed by the store owner; only the merchant can restore them.", 409);
  }
  await models.User.updateOne({ _id: userId }, { $set: { isActive: true, deactivatedBy: null, updatedAt: new Date() } });
  return {
    before: { isActive: false, deactivatedBy: user.deactivatedBy || null, roles: user.roles },
    after: { isActive: true, roles: user.roles },
  };
}

export const revokeTenantStaff = (tenantId, userId) => revokeStaffWithModels(scoped(tenantId), userId);
export const reactivateTenantStaff = (tenantId, userId) => reactivateStaffWithModels(scoped(tenantId), userId);

async function getOpenInvite(models, inviteId) {
  const invite = await models.StaffInvite.findOne({ _id: inviteId, acceptedAt: null })
    .select("email role expiresAt revokedAt")
    .lean();
  if (!invite) throw new APIError("Invite not found", 404);
  return invite;
}

export async function resendTenantInvite(tenant, inviteId) {
  const models = scoped(tenant._id);
  const existing = await getOpenInvite(models, inviteId);
  // The raw token only ever goes to the invitee's inbox — drop it here.
  const { invite } = await resendInvite(models, inviteId, { tenant });
  return {
    before: { status: existing.revokedAt ? "revoked" : "open", expiresAt: existing.expiresAt },
    after: { email: invite.email, role: invite.role, expiresAt: invite.expiresAt },
  };
}

export async function revokeTenantInvite(tenant, inviteId) {
  const models = scoped(tenant._id);
  const existing = await getOpenInvite(models, inviteId);
  const invite = await revokeInvite(models, inviteId);
  return {
    before: { status: "open", expiresAt: existing.expiresAt },
    after: { email: invite.email, role: invite.role, status: "revoked" },
  };
}
