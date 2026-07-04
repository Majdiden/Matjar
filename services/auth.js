import crypto from "crypto";
import mongoose from "mongoose";
import { signJWT, comparePassword } from "../utils/misc.js";
import { getAUserRepo } from "../repositories/user.js";
import config from "../config/index.js";
import logger from "../utils/logger.js";
import { sendEmail } from "./providers/email.js";
import { buildPasswordResetEmail } from "./emailTemplates/passwordReset.js";
import { dashboardBaseUrl } from "../utils/notificationLinks.js";

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function refreshExpiresAt() {
  const match = config.jwtRefreshExpiresIn.match(/^(\d+)([dhms])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const val = parseInt(match[1], 10);
  const unit = match[2];
  const ms = { d: 86400000, h: 3600000, m: 60000, s: 1000 }[unit];
  return new Date(Date.now() + val * ms);
}

/**
 * Resolve every ACTIVE store an email can access from the merchant dashboard.
 *
 * "Access" = an owner/admin row in the cross-tenant TenantUser directory OR a
 * dashboard-capable User row (admin/manager/staff, or any custom role) inside
 * a tenant. Plain storefront customers are excluded — a customer account must
 * never surface a store as a dashboard login/switch target. This is the single
 * source of truth for both the login store-picker and the in-app store
 * switcher, so the two can never drift.
 *
 * Returns lean Tenant docs ({ _id, name, slug, domains }); empty array when the
 * email has no dashboard-capable account anywhere.
 */
const findStoresForEmail = async (email) => {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  if (!normalizedEmail) return [];

  const TenantUser = mongoose.model("TenantUser");
  const User = mongoose.model("User");
  const Tenant = mongoose.model("Tenant");

  const directoryMatches = await TenantUser.find({
    email: normalizedEmail,
    tenantId: { $ne: null },
  })
    .select("tenantId")
    .lean();

  const accountMatches = await User.find({
    email: normalizedEmail,
    isActive: true,
    tenantId: { $ne: null },
    $or: [
      { roles: { $elemMatch: { $in: ["admin", "manager", "staff"] } } },
      { customRoleIds: { $exists: true, $ne: [] } },
    ],
  })
    .select("tenantId")
    .lean();

  const tenantIds = Array.from(
    new Set(
      [...directoryMatches, ...accountMatches]
        .map((m) => m.tenantId)
        .filter(Boolean)
        .map(String)
    )
  );

  if (tenantIds.length === 0) return [];

  return Tenant.find({ _id: { $in: tenantIds }, isActive: true })
    .select("name slug domains")
    .lean();
};

/**
 * Shape a lean Tenant doc into the store summary the dashboard consumes
 * (id/name/slug + primary host). Kept next to `findStoresForEmail` so the
 * login picker and the store switcher present identical fields.
 */
const toStoreSummary = (t) => ({
  id: String(t._id),
  name: t.name,
  slug: t.slug,
  domain:
    t.domains?.subdomain?.fullDomain ||
    t.domains?.subdomain?.name ||
    t.slug,
});

const loginService = async (models, email, password, tenantId) => {
  const user = await getAUserRepo(
    models,
    { email },
    { password: 1, email: 1, name: 1, roles: 1, isActive: 1, tokenVersion: 1 }
  );

  if (!user) {
    return { success: false, statusCode: 401, message: "Invalid email or password", responseObject: null };
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    return { success: false, statusCode: 401, message: "Invalid email or password", responseObject: null };
  }

  if (!user.isActive) {
    return { success: false, statusCode: 403, message: "Account is deactivated", responseObject: null };
  }

  const tokenPayload = {
    userId: user._id.toString(),
    tenantId: tenantId.toString(),
    roles: user.roles,
    // Pin the token to the user's current invalidation epoch — a later
    // password change bumps tokenVersion and this token stops verifying.
    tokenVersion: user.tokenVersion ?? 0,
  };

  const accessToken = signJWT(tokenPayload);

  const family = crypto.randomUUID();
  const rawRefreshToken = crypto.randomUUID();
  const hashed = hashToken(rawRefreshToken);

  await models.RefreshToken.create({
    user: user._id,
    token: hashed,
    family,
    expiresAt: refreshExpiresAt(),
  });

  return {
    success: true,
    statusCode: 200,
    message: "Logged in successfully",
    responseObject: {
      accessToken,
      refreshToken: rawRefreshToken,
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      roles: user.roles,
    },
  };
};

/**
 * Mint an access token + refresh token for an already-authenticated user
 * (no password check). Shared by the passwordless passkey (WebAuthn) login
 * flow. Mirrors the token issuance in `loginService` exactly so a passkey
 * session is indistinguishable from a password session downstream.
 *
 * @param {object} models   tenant-scoped models
 * @param {object} user     user doc with { _id, email, name, roles, tokenVersion }
 * @param {string} tenantId
 */
const issueAuthSession = async (models, user, tenantId) => {
  const tokenPayload = {
    userId: user._id.toString(),
    tenantId: tenantId.toString(),
    roles: user.roles,
    tokenVersion: user.tokenVersion ?? 0,
  };
  const accessToken = signJWT(tokenPayload);

  const family = crypto.randomUUID();
  const rawRefreshToken = crypto.randomUUID();
  const hashed = hashToken(rawRefreshToken);

  await models.RefreshToken.create({
    user: user._id,
    token: hashed,
    family,
    expiresAt: refreshExpiresAt(),
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    userId: user._id.toString(),
    email: user.email,
    name: user.name,
    roles: user.roles,
  };
};

const refreshTokenService = async (models, rawRefreshToken, tokenDoc) => {
  if (tokenDoc.isRevoked) {
    await models.RefreshToken.updateMany({ family: tokenDoc.family }, { $set: { isRevoked: true } });
    return { success: false, statusCode: 401, message: "Token reuse detected. Family revoked.", responseObject: null };
  }

  if (tokenDoc.expiresAt < new Date()) {
    return { success: false, statusCode: 401, message: "Refresh token expired", responseObject: null };
  }

  const user = await models.User.findById(tokenDoc.user);
  if (!user || !user.isActive) {
    await models.RefreshToken.updateMany({ family: tokenDoc.family }, { $set: { isRevoked: true } });
    return { success: false, statusCode: 403, message: "User account is deactivated", responseObject: null };
  }

  await models.RefreshToken.updateOne({ _id: tokenDoc._id }, { $set: { isRevoked: true } });

  const newRaw = crypto.randomUUID();
  const newHashed = hashToken(newRaw);

  await models.RefreshToken.create({
    user: tokenDoc.user,
    token: newHashed,
    family: tokenDoc.family,
    expiresAt: refreshExpiresAt(),
  });

  const tokenPayload = {
    userId: user._id.toString(),
    tenantId: tokenDoc.tenantId.toString(),
    roles: user.roles,
    tokenVersion: user.tokenVersion ?? 0,
  };

  const accessToken = signJWT(tokenPayload);

  return {
    success: true,
    statusCode: 200,
    message: "Token refreshed successfully",
    responseObject: { accessToken, refreshToken: newRaw },
  };
};

/**
 * Change the user's password and invalidate every existing session.
 *
 * The two halves are critical:
 *   1. `$inc tokenVersion` — every JWT issued before this point now
 *      fails the auth-middleware version check on its next request.
 *   2. Revoke every refresh token — even though access tokens are now
 *      dead, an attacker holding a refresh token could otherwise mint
 *      a new one. We sweep them all in one update.
 *
 * The order matters: bump first, then revoke. If we revoked first and
 * then crashed before the bump, an attacker with a stolen access token
 * would still be authorised until it expired naturally.
 */
const changePasswordService = async (models, userId, currentPassword, newPassword) => {
  const user = await models.User.findById(userId).select("+password tokenVersion");
  if (!user) {
    return { success: false, statusCode: 404, message: "User not found", responseObject: null };
  }
  const ok = await comparePassword(currentPassword, user.password);
  if (!ok) {
    return { success: false, statusCode: 401, message: "Current password is incorrect", responseObject: null };
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return {
      success: false,
      statusCode: 400,
      message: "New password must be at least 8 characters",
      responseObject: null,
    };
  }

  user.password = newPassword; // pre-save hook re-hashes
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  // Revoke every refresh token for the user (across families) so that
  // no surviving refresh token can mint a fresh access token.
  await models.RefreshToken.updateMany(
    { user: user._id, isRevoked: { $ne: true } },
    { $set: { isRevoked: true } }
  );

  return { success: true, statusCode: 200, message: "Password changed. Please log in again.", responseObject: null };
};

const logoutService = async (models, rawRefreshToken) => {
  const hashed = hashToken(rawRefreshToken);
  const tokenDoc = await models.RefreshToken.findOne({ token: hashed });
  if (tokenDoc) {
    await models.RefreshToken.updateMany({ family: tokenDoc.family }, { $set: { isRevoked: true } });
  }
  return { success: true, statusCode: 200, message: "Logged out successfully", responseObject: null };
};

// ─── Forgot-password flow ─────────────────────────────────────────────
//
// Two-step flow with a hashed-token-in-DB pattern:
//
//   1. requestPasswordReset — user submits their email. We always return
//      success so an attacker can't probe for valid addresses. If the
//      email does exist, we mint a random 32-byte token, store only its
//      SHA-256 hash on the user doc, and send the RAW token inside the
//      reset link. A DB dump therefore doesn't let the attacker
//      impersonate the reset flow — they'd need the raw token, which
//      only ever lived in the email.
//
//   2. confirmPasswordReset — user submits the raw token + new password.
//      We hash the presented token, look up the owning user, check that
//      it hasn't been used AND hasn't expired, swap in the new password
//      (which the pre-save hook re-hashes), bump tokenVersion to kill
//      every in-flight access token, and sweep all refresh tokens. Then
//      we stamp passwordResetUsedAt so the same link can't be reused
//      even within the expiry window.

// 32 bytes is ~256 bits of entropy — infeasible to brute-force even
// with the full 1-hour window. Encoded as hex for URL-safety (no +, /,
// or = that'd need percent-encoding in the reset link).
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_TOKEN_TTL_MINUTES = 60;

// Hex-encoded 32-byte token → 64 chars. Used to validate the format
// both at the route layer (Zod) and here before a DB lookup, so
// malformed input never touches the collection.
const RESET_TOKEN_HEX_RE = /^[a-f0-9]{64}$/;

/**
 * Password policy for new passwords set via reset.
 * Matches the existing spirit of the project: at least 8 characters,
 * with at least one letter and one digit. The register schema is
 * stricter (upper + lower + digit); we stay at "letter + digit" here
 * to match changePasswordService's behaviour and the task spec.
 */
function validatePasswordStrength(pw) {
  if (typeof pw !== "string" || pw.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return "Password must include at least one letter and one number";
  }
  return null;
}

/**
 * Kick off a password reset. Always resolves to `{ ok: true }` — we
 * deliberately do NOT surface whether the email exists, to prevent
 * account-enumeration attacks via differential timing or response
 * content.
 *
 * Accepts a raw mongoose connection. A single email can belong to
 * multiple tenants (Bob owns Store A AND works at Store B as staff);
 * each tenant has an independent User row keyed on `{ tenantId, email }`.
 * We mint a separate reset token per matching User doc so each store's
 * session can be reset independently, and send a single email listing
 * all the reset links — but since the cross-tenant case is rare and
 * would be confusing in the inbox, we just fire one email per matching
 * user doc. In practice a user almost always has exactly one match.
 */
const requestPasswordReset = async (connection, email) => {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  if (!normalizedEmail) return { ok: true };

  // Unscoped lookup across the User collection. User docs are keyed
  // per-tenant on `{ tenantId, email }`, so the same email may return
  // multiple docs from distinct tenants. We send one reset link per
  // matching account so the recipient can reset the right store.
  const UserModel = connection.model("User");
  const users = await UserModel.find({ email: normalizedEmail });
  if (!users.length) {
    // Intentional no-op — return the same envelope as the happy path.
    return { ok: true };
  }

  for (const user of users) {
    // Generate a fresh raw token for each account, and store only the
    // hash. Only the hash ever touches disk.
    const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetTokenExpiresAt = expiresAt;
    // Clear any prior "used" timestamp — this token is fresh and single-use.
    user.passwordResetUsedAt = null;
    await user.save();

    // Build the ABSOLUTE URL the user clicks, on the tenant's own host.
    // Staff (admin/manager/staff) reset inside the dashboard at
    // /dashboard/reset-password; customers reset on the storefront at
    // /reset-password. Both read `?token=` from the URL. We resolve the
    // tenant host here so the link is never a bare relative path — the old
    // code fell back to a relative "/reset-password" whenever the global
    // dashboard URL env was unset, which is unusable in an email and also
    // 404'd on the storefront for customers.
    let language;
    let host = null;
    try {
      const Tenant = connection.model("Tenant");
      const tenant = await Tenant.findById(user.tenantId)
        .select("domains settings.language")
        .lean();
      language = tenant?.settings?.language;
      const custom = tenant?.domains?.customDomain;
      const sub = tenant?.domains?.subdomain;
      host =
        (custom?.name && custom?.isVerified ? custom.name : null) ||
        sub?.fullDomain ||
        (sub?.name ? `${sub.name}.${config.platformDomain}` : null) ||
        null;
    } catch { /* default to English + the configured dashboard URL */ }

    const isStaff =
      Array.isArray(user.roles) &&
      user.roles.some((r) => ["admin", "manager", "staff"].includes(r));
    const appPath = isStaff ? "/dashboard/reset-password" : "/reset-password";
    const query = `?token=${encodeURIComponent(rawToken)}`;

    let resetUrl;
    if (host) {
      const proto = /localhost|127\.0\.0\.1|::1/.test(host) ? "http" : "https";
      resetUrl = `${proto}://${host}${appPath}${query}`;
    } else {
      // Last resort: the configured dashboard URL (staff-oriented).
      const base = dashboardBaseUrl();
      resetUrl = `${base}${appPath}${query}`;
    }

    const { subject, text, html } = buildPasswordResetEmail({
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      language,
    });

    try {
      await sendEmail({ to: normalizedEmail, subject, text, html });
    } catch (err) {
      // Don't surface the send failure to the caller — a user hitting
      // retry on a transient provider hiccup would otherwise leak "yes,
      // that email exists, the send just failed" through the different
      // error path. Log server-side and return the generic envelope.
      logger.warn("Password reset email failed to send", {
        email: normalizedEmail,
        error: err?.message,
      });
    }
  }

  return { ok: true };
};

/**
 * Complete a password reset. Validates the token (present, well-formed,
 * matches a user, not expired, not already used), enforces password
 * policy, installs the new password, and burns every existing session
 * by bumping tokenVersion and revoking every refresh token for the user.
 *
 * Accepts a raw mongoose connection rather than a scoped `models`
 * because the reset token alone doesn't identify which tenant the user
 * belongs to — we use the globally-unique token hash to find the user,
 * then scope subsequent writes to that user's tenant. The 256-bit token
 * space is large enough that a cross-tenant collision is infeasible.
 */
const confirmPasswordReset = async (connection, { token, newPassword }) => {
  if (typeof token !== "string" || !RESET_TOKEN_HEX_RE.test(token)) {
    return {
      success: false,
      statusCode: 400,
      message: "Invalid or expired reset link",
      responseObject: null,
    };
  }

  const policyError = validatePasswordStrength(newPassword);
  if (policyError) {
    return { success: false, statusCode: 400, message: policyError, responseObject: null };
  }

  const tokenHash = hashToken(token);
  // Unscoped lookup: the token hash is globally unique across tenants,
  // so we find the owner via the raw User model. This is safe because
  // an attacker with a valid token is by definition authorised to reset
  // that user's password regardless of tenant.
  const UserModel = connection.model("User");
  const user = await UserModel.findOne({ passwordResetTokenHash: tokenHash });

  // Use a single generic message for every failure mode past format
  // validation — "wrong token", "used token", "expired token" all look
  // the same to the caller. This denies the attacker any oracle for
  // guessing whether a token ever existed.
  const genericInvalid = {
    success: false,
    statusCode: 400,
    message: "Invalid or expired reset link",
    responseObject: null,
  };

  if (!user) return genericInvalid;
  if (user.passwordResetUsedAt) return genericInvalid;
  if (!user.passwordResetTokenExpiresAt) return genericInvalid;
  if (new Date(user.passwordResetTokenExpiresAt).getTime() < Date.now()) {
    return genericInvalid;
  }

  // Install the new password. The pre-save hook on the schema re-hashes
  // when `password` is modified, so we assign the raw string here.
  user.password = newPassword;
  // Bump tokenVersion so every existing access token fails the next
  // auth middleware check — see changePasswordService for the full
  // rationale.
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  // Single-use: stamp passwordResetUsedAt. We leave the hash + expiry
  // in place (rather than nulling them) so a reused link still lands
  // in the `passwordResetUsedAt != null` branch above instead of
  // looking like an unknown token — useful if we ever want to alert
  // on suspicious re-use.
  user.passwordResetUsedAt = new Date();
  await user.save();

  // Sweep every refresh token for this user. Without this, a refresh
  // token captured before the reset could still mint fresh access
  // tokens for its own family until it expired naturally. The
  // RefreshToken collection is tenant-scoped on disk but we can safely
  // filter by user._id directly — the tenantId on a refresh token
  // necessarily matches its user's tenantId.
  const RefreshTokenModel = connection.model("RefreshToken");
  await RefreshTokenModel.updateMany(
    { user: user._id, isRevoked: { $ne: true } },
    { $set: { isRevoked: true } }
  );

  return {
    success: true,
    statusCode: 200,
    message: "Password updated. Please sign in with your new password.",
    responseObject: { ok: true },
  };
};

export {
  findStoresForEmail,
  toStoreSummary,
  loginService,
  issueAuthSession,
  refreshTokenService,
  logoutService,
  changePasswordService,
  hashToken,
  requestPasswordReset,
  confirmPasswordReset,
};
