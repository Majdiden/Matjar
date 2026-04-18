import crypto from "node:crypto";
import {
  listStaffRepo,
  getStaffRepo,
  updateStaffRolesRepo,
  softDeleteStaffRepo,
  countAdminsRepo,
  listInvitesRepo,
  getInviteRepo,
  getInviteByTokenRepo,
  createInviteRepo,
  markInviteAcceptedRepo,
  claimInviteByTokenRepo,
  revokeInviteRepo,
  refreshInviteTokenRepo,
  deleteExpiredInvitesRepo,
} from "../repositories/staff.js";
import { APIError } from "../middlewares/errorHandler.js";
import { sendEmail } from "./providers/email.js";
import logger from "../utils/logger.js";
import config from "../config/index.js";
import { emit as emitNotification } from "./notification.js";

const STAFF_ROLES = ["admin", "manager", "staff"];
const EMAIL_RE = /^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/;

const hashToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

const generateRawToken = () => crypto.randomBytes(32).toString("hex");

const sevenDaysFromNow = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

/**
 * Strip the hashed token from an invite doc before returning it to the API.
 * The hash is sensitive operational material — callers that need it use the
 * internal repo helpers directly.
 */
const sanitizeInvite = (invite) => {
  if (!invite) return invite;
  const obj = invite.toObject ? invite.toObject() : { ...invite };
  delete obj.token;
  return obj;
};

// ── Staff users ───────────────────────────────────────────────────────────────

export const listStaff = async (models) => listStaffRepo(models);

export const getStaff = async (models, id) => {
  const user = await getStaffRepo(models, id);
  if (!user) throw new APIError("Staff member not found", 404);
  return user;
};

export const updateStaffRole = async (models, id, { roles: newRoles, customRoleIds }, currentUserId) => {
  if (newRoles !== undefined) {
    if (!Array.isArray(newRoles) || newRoles.length === 0)
      throw new APIError("roles must be a non-empty array", 400);
    const invalid = newRoles.filter((r) => !STAFF_ROLES.includes(r));
    if (invalid.length)
      throw new APIError(`Invalid roles: ${invalid.join(", ")}. Allowed: ${STAFF_ROLES.join(", ")}`, 400);
  }

  if (customRoleIds !== undefined) {
    if (!Array.isArray(customRoleIds))
      throw new APIError("customRoleIds must be an array", 400);
    if (customRoleIds.length > 0) {
      const found = await models.Role.find({ _id: { $in: customRoleIds } }).select("_id").lean();
      if (found.length !== new Set(customRoleIds.map(String)).size)
        throw new APIError("One or more customRoleIds do not exist for this tenant", 400);
    }
  }

  const existing = await getStaffRepo(models, id);
  if (!existing) throw new APIError("Staff member not found", 404);

  // Last-admin protection: if this user is currently an admin and the new
  // roles don't include admin, confirm another admin still exists.
  if (newRoles !== undefined && existing.roles.includes("admin") && !newRoles.includes("admin")) {
    const adminCount = await countAdminsRepo(models);
    if (adminCount <= 1)
      throw new APIError("Cannot demote the last admin. Promote another user first.", 400);
  }

  const updated = await updateStaffRolesRepo(models, id, { roles: newRoles, customRoleIds });
  if (!updated) throw new APIError("Staff member not found", 404);
  return updated;
};

export const removeStaff = async (models, id, currentUserId) => {
  if (String(id) === String(currentUserId))
    throw new APIError("You cannot remove yourself", 400);

  const existing = await getStaffRepo(models, id);
  if (!existing) throw new APIError("Staff member not found", 404);

  if (existing.roles.includes("admin")) {
    const adminCount = await countAdminsRepo(models);
    if (adminCount <= 1)
      throw new APIError("Cannot remove the last admin.", 400);
  }

  const updated = await softDeleteStaffRepo(models, id);
  if (!updated) throw new APIError("Staff member not found", 404);
  return updated;
};

// ── Invites ───────────────────────────────────────────────────────────────────

export const listInvites = async (models) => listInvitesRepo(models);

const buildAcceptLink = (tenant, rawToken) => {
  const host = tenant && typeof tenant.getActiveDomain === "function"
    ? tenant.getActiveDomain()
    : tenant?.domains?.subdomain?.fullDomain;
  if (host) {
    const proto = config.isProduction ? "https" : "http";
    return `${proto}://${host}/dashboard/staff/accept?token=${rawToken}`;
  }
  // Fallback for environments without a resolvable tenant host
  const dashboardUrl = config.publicDashboardUrl || "";
  return `${dashboardUrl}/staff/accept?token=${rawToken}`;
};

export const createInvite = async (models, tenantId, { email, role, invitedById, tenant }) => {
  if (!email || !EMAIL_RE.test(email))
    throw new APIError("A valid email address is required", 400);
  if (!role || !STAFF_ROLES.includes(role))
    throw new APIError(`role must be one of: ${STAFF_ROLES.join(", ")}`, 400);

  const rawToken = generateRawToken();
  const hashed = hashToken(rawToken);
  const expiresAt = sevenDaysFromNow();

  const invite = await createInviteRepo(models, {
    tenantId,
    email: email.toLowerCase().trim(),
    role,
    invitedBy: invitedById || undefined,
    token: hashed,
    expiresAt,
  });

  // Fire-and-forget email; failure is logged but does not break the response.
  const acceptLink = buildAcceptLink(tenant, rawToken);
  try {
    await sendEmail({
      to: invite.email,
      subject: "You have been invited to join a store",
      html: `
        <h2>You have been invited!</h2>
        <p>You have been invited to join as <strong>${role}</strong>.</p>
        <p>Click the link below to accept your invitation. It expires in 7 days.</p>
        <p><a href="${acceptLink}" style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
        <p>Or copy this link: <code>${acceptLink}</code></p>
        <p>If you did not expect this invitation, you can safely ignore this email.</p>
      `,
    });
  } catch (err) {
    logger.warn("Staff invite email failed to send", { email: invite.email, error: err.message });
  }

  // Plaintext token returned only here (so the dashboard can show a copy link)
  return { invite: sanitizeInvite(invite), token: rawToken };
};

export const verifyInviteToken = async (models, rawToken) => {
  if (!rawToken) throw new APIError("token is required", 400);
  const hashed = hashToken(rawToken);
  const invite = await getInviteByTokenRepo(models, hashed);
  if (!invite) throw new APIError("Invalid or expired invitation token", 404);
  if (invite.revokedAt) throw new APIError("This invitation has been revoked", 410);
  if (invite.acceptedAt) throw new APIError("This invitation has already been accepted", 410);
  if (new Date(invite.expiresAt) < new Date()) throw new APIError("This invitation has expired", 410);
  return { email: invite.email, role: invite.role };
};

export const acceptInvite = async (models, tenantId, { token, name, password }) => {
  if (!token) throw new APIError("token is required", 400);
  if (!name || !name.trim()) throw new APIError("name is required", 400);
  if (!password || password.length < 8) throw new APIError("password must be at least 8 characters", 400);

  const hashed = hashToken(token);
  // Atomic claim: only one caller wins. The returned doc is the pre-update
  // state (acceptedAt still null), so it's safe to continue using.
  const invite = await claimInviteByTokenRepo(models, hashed);
  if (!invite) {
    // Either token doesn't exist, already accepted, revoked, or expired.
    const existing = await getInviteByTokenRepo(models, hashed);
    if (!existing) throw new APIError("Invalid invitation token", 404);
    if (existing.revokedAt) throw new APIError("This invitation has been revoked", 410);
    if (existing.acceptedAt) throw new APIError("This invitation has already been accepted", 410);
    throw new APIError("This invitation has expired", 410);
  }

  // Release the claim if user creation/update fails, so the invitee can retry.
  // We cleared acceptedAt in claimInviteByTokenRepo; if the next step throws,
  // put the invite back into the unclaimed state instead of burning the token.
  let user;
  try {
    // If user already exists, add role; otherwise create.
    user = await models.User.findOne({ email: invite.email }).lean();
    if (user) {
      const roles = Array.from(new Set([...(user.roles || []), invite.role]));
      user = await models.User.findByIdAndUpdate(
        user._id,
        { $set: { roles, updatedAt: Date.now() } },
        { new: true }
      ).select("-password").lean();
    } else {
      const created = await models.User.create({
        tenantId,
        name: name.trim(),
        email: invite.email,
        password,
        roles: [invite.role],
      });
      const obj = created.toObject();
      delete obj.password;
      user = obj;
    }
  } catch (err) {
    // Release the claim so the invitee can retry with the same link.
    await models.StaffInvite.findByIdAndUpdate(invite._id, {
      $set: { acceptedAt: null, updatedAt: Date.now() },
    });
    throw err;
  }

  // invite is already marked accepted by claimInviteByTokenRepo
  try {
    emitNotification(models, tenantId, {
      type: "staff.invite_accepted",
      severity: "success",
      title: "Staff invite accepted",
      body: `${user.name || invite.email} accepted the ${invite.role} invitation`,
      resourceType: "user",
      resourceId: user._id,
      permission: "team.manage",
      data: {
        email: invite.email,
        role: invite.role,
        userId: String(user._id),
      },
    });
  } catch (err) {
    console.warn("emit staff.invite_accepted failed", err?.message);
  }
  return user;
};

export const revokeInvite = async (models, id) => {
  const invite = await getInviteRepo(models, id);
  if (!invite) throw new APIError("Invite not found", 404);
  if (invite.revokedAt) throw new APIError("Invite already revoked", 400);
  if (invite.acceptedAt) throw new APIError("Cannot revoke an already accepted invite", 400);
  const revoked = await revokeInviteRepo(models, id);
  return sanitizeInvite(revoked);
};

export const resendInvite = async (models, id, { tenant } = {}) => {
  const invite = await getInviteRepo(models, id);
  if (!invite) throw new APIError("Invite not found", 404);
  if (invite.revokedAt) throw new APIError("Cannot resend a revoked invite", 400);
  if (invite.acceptedAt) throw new APIError("Cannot resend an already accepted invite", 400);

  const rawToken = generateRawToken();
  const hashed = hashToken(rawToken);
  const expiresAt = sevenDaysFromNow();

  await refreshInviteTokenRepo(models, id, hashed, expiresAt);

  const acceptLink = buildAcceptLink(tenant, rawToken);
  try {
    await sendEmail({
      to: invite.email,
      subject: "Your staff invitation has been resent",
      html: `
        <h2>Staff Invitation</h2>
        <p>Your invitation as <strong>${invite.role}</strong> has been resent.</p>
        <p>This link expires in 7 days.</p>
        <p><a href="${acceptLink}" style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
        <p>Or copy this link: <code>${acceptLink}</code></p>
      `,
    });
  } catch (err) {
    logger.warn("Staff invite resend email failed", { email: invite.email, error: err.message });
  }

  return { invite: sanitizeInvite({ ...invite, expiresAt }), token: rawToken };
};

export const deleteExpiredInvites = async (models) =>
  deleteExpiredInvitesRepo(models);
