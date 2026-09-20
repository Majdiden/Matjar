/**
 * Platform staff management — invitations, roles, suspension, sessions,
 * password reset. Admin DB only (TenantUser rows with platformAdmin: true).
 *
 * Security posture:
 *   - Only SHA-256 hashes of invite / reset tokens are stored.
 *   - Public flows (accept invite, password reset) return generic responses
 *     and never reveal whether an email exists.
 *   - Self-protection: nobody can suspend/demote/revoke themselves, the last
 *     active OWNER can never be removed, and only an OWNER may grant or take
 *     away the OWNER role (config/platformRoles.js).
 *   - Every mutation is written to the platform audit ledger by the caller
 *     (controllers) with before/after snapshots produced here.
 */
import crypto from "crypto";
import mongoose from "mongoose";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";
import { generateHash, comparePassword } from "../../utils/misc.js";
import { APIError } from "../../middlewares/errorHandler.js";
import { sendEmail } from "../providers/email.js";
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_DEFS,
  isValidRole,
  canAssignRole,
  canActOnRole,
  resolveEffectiveScopes,
} from "../../config/platformRoles.js";
import { revokeAllSessions } from "./sessions.js";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const TOKEN_BYTES = 32;

export const hashToken = (raw) => crypto.createHash("sha256").update(String(raw)).digest("hex");
const newRawToken = () => crypto.randomBytes(TOKEN_BYTES).toString("hex");

const TenantUser = () => mongoose.model("TenantUser");
const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const PlatformInvite = () => mongoose.model("PlatformInvite");

/** Public projection of a platform user — never hashes or reset tokens. */
export function publicUser(u) {
  if (!u) return null;
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.platformRole || null,
    status: u.platformStatus || "active",
    scopes: resolveEffectiveScopes(u.platformRole, u.platformScopes),
    explicitScopes: Array.isArray(u.platformScopes) ? u.platformScopes : [],
    mustResetPassword: !!u.platformMustResetPassword,
    mfaEnabled: !!u.platformMfa?.enabled,
    mfaEnrolledAt: u.platformMfa?.enrolledAt || null,
    lastLoginAt: u.platformLastLoginAt || null,
    suspendedAt: u.platformSuspendedAt || null,
    suspensionReason: u.platformSuspensionReason || null,
    createdAt: u.createdAt || null,
  };
}

export function publicInvite(i) {
  if (!i) return null;
  return {
    id: String(i._id),
    email: i.email,
    role: i.role,
    status: i.status,
    invitedBy: i.invitedBy ? String(i.invitedBy) : null,
    expiresAt: i.expiresAt,
    acceptedAt: i.acceptedAt,
    revokedAt: i.revokedAt,
    createdAt: i.createdAt,
  };
}

/**
 * Base URL of the platform console for links in emails.
 *   1. PLATFORM_ADMIN_URL env (recommended in production)
 *   2. production: https://<platformDomain>/platform (where the built console is served)
 *   3. dev only: the request Origin (Vite dev server), else http://localhost:5174
 * The request Origin is deliberately NOT trusted in production — a public
 * reset endpoint must never build a link to an attacker-controlled host.
 */
export function platformAdminBaseUrl(req) {
  const fromEnv = (process.env.PLATFORM_ADMIN_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (config.isProduction) {
    const host = String(config.platformDomain || "").split(":")[0];
    return `https://${host}/platform`;
  }
  const origin = String(req?.headers?.origin || "").trim();
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return "http://localhost:5174";
}

// ── Roles ────────────────────────────────────────────────────────────────

export function listRoles() {
  return PLATFORM_ROLE_DEFS.map(({ key, label, description, scopes }) => ({ key, label, description, scopes }));
}

async function countActiveOwners(excludeId = null) {
  const q = { platformAdmin: true, platformRole: PLATFORM_ROLES.OWNER, platformStatus: { $ne: "suspended" } };
  if (excludeId) q._id = { $ne: excludeId };
  return TenantUser().countDocuments(q);
}

// ── Users ────────────────────────────────────────────────────────────────

export async function listPlatformUsers() {
  const rows = await TenantUser()
    .find({ platformAdmin: true })
    .select("name email platformRole platformStatus platformScopes platformMustResetPassword platformLastLoginAt platformSuspendedAt platformSuspensionReason platformMfa.enabled platformMfa.enrolledAt createdAt")
    .sort({ createdAt: 1 })
    .lean();
  return rows.map(publicUser);
}

/** Minimal role/email lookup for guards (no scopes, no hashes). 404 when absent. */
export async function findPlatformUserBrief(id) {
  const u = await TenantUser().findOne({ _id: id, platformAdmin: true }).select("platformRole email").lean();
  if (!u) throw new APIError("Platform user not found", 404);
  return { id: String(u._id), role: u.platformRole || null, email: u.email };
}

async function loadTarget(id) {
  const u = await TenantUser().findOne({ _id: id, platformAdmin: true });
  if (!u) throw new APIError("Platform user not found", 404);
  return u;
}

function assertNotSelf(actor, target, what) {
  if (String(actor.id) === String(target._id)) throw new APIError(`You cannot ${what} your own account`, 400);
}

function assertCanActOn(actor, target) {
  if (!canActOnRole(actor.role, target.platformRole)) {
    throw new APIError("You are not allowed to manage this user's role level", 403);
  }
}

export async function changeRole(actor, id, rawRole) {
  const role = String(rawRole || "").toLowerCase().trim();
  if (!isValidRole(role)) throw new APIError("Unknown role", 400);
  const target = await loadTarget(id);
  assertNotSelf(actor, target, "change the role of");
  assertCanActOn(actor, target);
  if (!canAssignRole(actor.role, role)) throw new APIError("You are not allowed to grant this role", 403);
  if (target.platformRole === PLATFORM_ROLES.OWNER && role !== PLATFORM_ROLES.OWNER) {
    if ((await countActiveOwners(target._id)) === 0) throw new APIError("Cannot demote the last owner", 400);
  }
  const before = { role: target.platformRole || null };
  target.platformRole = role;
  // A role change invalidates existing sessions so stale scope sets cannot linger.
  target.platformTokenVersion = (target.platformTokenVersion || 0) + 1;
  await target.save();
  await revokeAllSessions(target._id, "role changed");
  return { user: publicUser(target), before, after: { role } };
}

export async function suspendUser(actor, id, reason) {
  const target = await loadTarget(id);
  assertNotSelf(actor, target, "suspend");
  assertCanActOn(actor, target);
  if (target.platformStatus === "suspended") throw new APIError("User is already suspended", 409);
  if (target.platformRole === PLATFORM_ROLES.OWNER && (await countActiveOwners(target._id)) === 0) {
    throw new APIError("Cannot suspend the last owner", 400);
  }
  const before = { status: target.platformStatus };
  target.platformStatus = "suspended";
  target.platformSuspendedAt = new Date();
  target.platformSuspensionReason = reason;
  target.platformTokenVersion = (target.platformTokenVersion || 0) + 1;
  // A pending reset link must not survive a suspension.
  target.platformResetTokenHash = null;
  target.platformResetTokenExpiresAt = null;
  await target.save();
  await revokeAllSessions(target._id, "account suspended");
  return { user: publicUser(target), before, after: { status: "suspended", reason } };
}

export async function reactivateUser(actor, id) {
  const target = await loadTarget(id);
  assertCanActOn(actor, target);
  if (target.platformStatus !== "suspended") throw new APIError("User is not suspended", 409);
  const before = { status: target.platformStatus };
  target.platformStatus = "active";
  target.platformSuspendedAt = null;
  target.platformSuspensionReason = null;
  await target.save();
  return { user: publicUser(target), before, after: { status: "active" } };
}

export async function revokeSessions(actor, id, { reason = null } = {}) {
  const target = await loadTarget(id);
  if (String(actor.id) !== String(target._id)) assertCanActOn(actor, target);
  target.platformTokenVersion = (target.platformTokenVersion || 0) + 1;
  await target.save();
  await revokeAllSessions(target._id, reason || "revoked by operator");
  return { user: publicUser(target) };
}

export async function forcePasswordReset(actor, req, id) {
  const target = await loadTarget(id);
  assertNotSelf(actor, target, "force a password reset on");
  assertCanActOn(actor, target);
  target.platformMustResetPassword = true;
  target.platformTokenVersion = (target.platformTokenVersion || 0) + 1;
  await target.save();
  await revokeAllSessions(target._id, "password reset forced");
  // Best-effort reset email so the operator can set a new password directly.
  await issueResetToken(req, target.email).catch((err) =>
    logger.warn("forcePasswordReset: reset email failed", { error: err.message })
  );
  return { user: publicUser(target) };
}

// ── Own password ─────────────────────────────────────────────────────────

/** Text-only notification after any password change. Never includes tokens. */
async function sendPasswordChangedEmail(email) {
  try {
    await sendEmail({
      to: email,
      subject: "Your Matjar platform console password was changed",
      text: "The password for your Matjar platform console account was just changed. If this was not you, contact a platform owner immediately so your account can be suspended.",
    });
  } catch (err) {
    logger.warn("password-changed email failed", { error: err.message });
  }
}

/**
 * Self-service change with the current password. Deliberately does NOT
 * clear an operator-imposed forced reset: that flag can only be cleared by
 * proving control of the mailbox (confirmReset via the emailed token), so a
 * hijacked session cannot satisfy the reset on its own.
 */
export async function changeOwnPassword(actor, currentPassword, newPassword) {
  const user = await TenantUser().findOne({ _id: actor.id, platformAdmin: true }).select("+platformPasswordHash");
  if (!user || !user.platformPasswordHash) throw new APIError("Not authenticated", 401);
  if (user.platformMustResetPassword) {
    throw new APIError("A password reset was required by an owner. Use the reset link sent to your email.", 403);
  }
  const ok = await comparePassword(currentPassword, user.platformPasswordHash);
  if (!ok) throw new APIError("Current password is incorrect", 400);
  user.platformPasswordHash = await generateHash(newPassword);
  user.platformResetTokenHash = null;
  user.platformResetTokenExpiresAt = null;
  user.platformTokenVersion = (user.platformTokenVersion || 0) + 1;
  await user.save();
  await revokeAllSessions(user._id, "password changed");
  await sendPasswordChangedEmail(user.email);
  return { tokenVersion: user.platformTokenVersion };
}

// ── Invitations ──────────────────────────────────────────────────────────

export async function listInvites() {
  const rows = await PlatformInvite().find({ status: "pending" }).sort({ createdAt: -1 }).lean();
  // Expired-but-still-pending rows are reported as expired without a write.
  const now = Date.now();
  return rows.map((i) => publicInvite({ ...i, status: i.expiresAt && i.expiresAt.getTime() < now ? "expired" : i.status }));
}

async function sendInviteEmail(req, invite, rawToken, inviterName) {
  const link = `${platformAdminBaseUrl(req)}/accept-invite?token=${encodeURIComponent(rawToken)}`;
  const inviter = escapeHtml(inviterName || "A platform owner");
  const role = escapeHtml(invite.role);
  await sendEmail({
    to: invite.email,
    subject: "You have been invited to the Matjar platform console",
    text: `${inviterName || "A platform owner"} invited you as ${invite.role}. Accept within 72 hours: ${link}`,
    html: `<p>${inviter} invited you to the <strong>Matjar platform console</strong> as <strong>${role}</strong>.</p>
<p><a href="${link}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Accept invitation</a></p>
<p>Or copy this link: <code>${link}</code></p><p>The link expires in 72 hours. If you did not expect this, ignore this email.</p>`,
  });
  if (config.isDevelopment) logger.info("Platform invite link (dev)", { email: invite.email, link });
}

export async function createInvite(actor, req, { email: rawEmail, role: rawRole }) {
  const email = String(rawEmail || "").toLowerCase().trim();
  const role = String(rawRole || "").toLowerCase().trim();
  if (!isValidRole(role)) throw new APIError("Unknown role", 400);
  if (!canAssignRole(actor.role, role)) throw new APIError("You are not allowed to invite with this role", 403);
  const existing = await TenantUser().findOne({ email, platformAdmin: true }).select("platformStatus").lean();
  if (existing) throw new APIError("This email already belongs to a platform user", 409);

  // Supersede any older pending invite for the same email.
  await PlatformInvite().updateMany({ email, status: "pending" }, { $set: { status: "revoked", revokedAt: new Date() } });

  const rawToken = newRawToken();
  const invite = await PlatformInvite().create({
    email,
    role,
    tokenHash: hashToken(rawToken),
    invitedBy: actor.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  try {
    await sendInviteEmail(req, invite, rawToken, actor.name);
  } catch (err) {
    logger.warn("Platform invite email failed", { email, error: err.message });
  }
  return publicInvite(invite);
}

export async function resendInvite(actor, req, id) {
  const invite = await PlatformInvite().findById(id).select("+tokenHash");
  if (!invite || invite.status !== "pending") throw new APIError("Pending invite not found", 404);
  if (!canAssignRole(actor.role, invite.role)) throw new APIError("You are not allowed to manage this invite", 403);
  // Rotate the token on resend so an old email cannot be replayed.
  const rawToken = newRawToken();
  invite.tokenHash = hashToken(rawToken);
  invite.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await invite.save();
  try {
    await sendInviteEmail(req, invite, rawToken, actor.name);
  } catch (err) {
    logger.warn("Platform invite email failed", { email: invite.email, error: err.message });
  }
  return publicInvite(invite);
}

export async function revokeInvite(actor, id) {
  const invite = await PlatformInvite().findById(id);
  if (!invite || invite.status !== "pending") throw new APIError("Pending invite not found", 404);
  if (!canAssignRole(actor.role, invite.role)) throw new APIError("You are not allowed to manage this invite", 403);
  invite.status = "revoked";
  invite.revokedAt = new Date();
  await invite.save();
  return publicInvite(invite);
}

/**
 * Public: accept an invite with a raw token, set name + password. Creates
 * the platform user (or upgrades an existing directory row for that email —
 * a merchant may also be staff). Single use; expiry enforced.
 */
export async function acceptInvite({ token, name, password }) {
  const now = new Date();
  // Claim the invite ATOMICALLY first — two concurrent accepts of the same
  // link can never both proceed, and an expired/revoked/used token fails
  // with the same generic 410.
  const invite = await PlatformInvite().findOneAndUpdate(
    { tokenHash: hashToken(token), status: "pending", expiresAt: { $gt: now } },
    { $set: { status: "accepted", acceptedAt: now } },
    { new: true }
  );
  if (!invite) throw new APIError("This invitation is invalid or has expired", 410);

  const email = String(invite.email).toLowerCase().trim();
  const already = await TenantUser().findOne({ email, platformAdmin: true }).select("_id").lean();
  if (already) throw new APIError("This email already has a platform account", 409);

  const platformFields = {
    platformAdmin: true,
    platformPasswordHash: await generateHash(password),
    platformRole: invite.role,
    platformScopes: [],
    platformStatus: "active",
    platformTokenVersion: 0,
    platformMustResetPassword: false,
  };
  // A directory row for this email may exist WITHOUT a tenant (e.g. a
  // previously demoted operator) — reuse it, keeping its name. Rows that
  // belong to a merchant tenant are left alone: platform access gets its
  // own dedicated row (tenantId: null) so merchant and operator identities
  // never share a document. The partial unique index on {email,
  // platformAdmin:true} makes a duplicate create fail loudly.
  let user;
  try {
    user = await TenantUser().findOne({ email, platformAdmin: { $ne: true }, tenantId: null });
    if (user) {
      Object.assign(user, platformFields);
      if (!user.name) user.name = name;
      await user.save();
    } else {
      user = await TenantUser().create({ name, email, tenantId: null, ...platformFields });
    }
  } catch (err) {
    // The invite was claimed above; give it back so the invitee can retry
    // instead of being locked out by a transient failure. Best effort.
    await PlatformInvite()
      .updateOne({ _id: invite._id, status: "accepted" }, { $set: { status: "pending", acceptedAt: null } })
      .catch((e) => logger.warn("acceptInvite: could not restore invite", { inviteId: String(invite._id), error: e.message }));
    throw err;
  }
  return { user: publicUser(user), inviteId: String(invite._id) };
}

// ── Password reset (public) ──────────────────────────────────────────────

/** Issue a reset token + email for an existing platform user. No-op otherwise. */
export async function issueResetToken(req, email) {
  const user = await TenantUser().findOne({ email: String(email).toLowerCase().trim(), platformAdmin: true });
  if (!user || user.platformStatus === "suspended") return { sent: false };
  const rawToken = newRawToken();
  user.platformResetTokenHash = hashToken(rawToken);
  user.platformResetTokenExpiresAt = new Date(Date.now() + RESET_TTL_MS);
  await user.save();
  const link = `${platformAdminBaseUrl(req)}/reset-password?token=${encodeURIComponent(rawToken)}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Matjar platform console password",
    text: `Reset your password within 60 minutes: ${link}`,
    html: `<p>Someone requested a password reset for your Matjar platform console account.</p>
<p><a href="${link}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Reset password</a></p>
<p>Or copy this link: <code>${link}</code></p><p>The link expires in 60 minutes. If you did not request this, ignore this email.</p>`,
  });
  if (config.isDevelopment) logger.info("Platform password reset link (dev)", { email: user.email, link });
  return { sent: true };
}

export async function confirmReset({ token, password }) {
  const user = await TenantUser()
    .findOne({ platformResetTokenHash: hashToken(token), platformAdmin: true, platformStatus: { $ne: "suspended" } })
    .select("+platformResetTokenHash +platformResetTokenExpiresAt +platformPasswordHash");
  if (!user || !user.platformResetTokenExpiresAt || user.platformResetTokenExpiresAt.getTime() < Date.now()) {
    throw new APIError("This reset link is invalid or has expired", 410);
  }
  user.platformPasswordHash = await generateHash(password);
  user.platformResetTokenHash = null;
  user.platformResetTokenExpiresAt = null;
  user.platformMustResetPassword = false;
  user.platformTokenVersion = (user.platformTokenVersion || 0) + 1;
  await user.save();
  await revokeAllSessions(user._id, "password reset");
  await sendPasswordChangedEmail(user.email);
  return { user: publicUser(user) };
}
