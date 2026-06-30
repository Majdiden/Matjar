import crypto from "crypto";
import mongoose from "mongoose";
import {
  loginService,
  refreshTokenService,
  logoutService,
  changePasswordService,
  hashToken,
  requestPasswordReset,
  confirmPasswordReset,
} from "../services/auth.js";
import { getEffectivePermissions } from "../middlewares/authorize.js";
import { addATenantService, addStoreForExistingUserService } from "../services/tenant.js";
import { signJWT } from "../utils/misc.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { logAudit } from "../utils/audit.js";

export const registerTenantController = asyncHandler(async (req, res) => {
  const result = await addATenantService(req.body);
  res.status(result.statusCode).json(result);
});

/**
 * Create an ADDITIONAL store under the authenticated user's account (the
 * "add a store" flow an existing user reaches from the store picker or from
 * signup's "email exists → sign in to add a store"). Reuses the user's
 * credentials (no new account) and returns a token for the NEW store so the
 * client can hand the user straight into it — already signed in.
 */
export const addStoreController = asyncHandler(async (req, res) => {
  // Load the authenticated user's tenant-scoped doc (name + bcrypt hash) so
  // the new store's admin user is created with the same credentials.
  const me = await req.models.User.findById(req.user.userId)
    .select("name email password")
    .lean();
  if (!me) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const result = await addStoreForExistingUserService(me, {
    storeName: req.body.storeName,
    subdomain: req.body.subdomain,
    themeSlug: req.body.themeSlug,
    niche: req.body.niche,
    currency: req.body.currency,
    language: req.body.language,
  });

  // Sign a JWT for the NEW store's admin user so the dashboard can hop to the
  // new subdomain already authenticated (the tenant + admin user exist
  // synchronously; theme/data setup completes asynchronously).
  const ro = result.responseObject || {};
  if (ro.adminUserId && ro.tenantId) {
    ro.accessToken = signJWT({
      userId: String(ro.adminUserId),
      tenantId: String(ro.tenantId),
      roles: ["admin"],
      tokenVersion: 0,
    });
    ro.tenantDomain = ro.subdomain || ro.domain || null;
  }
  res.status(result.statusCode).json(result);
});

/**
 * Public email-availability check for the signup flow. Returns whether the
 * email already has a dashboard-capable account (owner/admin/manager/staff
 * or a TenantUser directory row), so the UI can stop the user early and
 * prompt them to SIGN IN to add a store to their existing account instead of
 * failing late at registration. Deliberately returns only a boolean — no
 * store names / counts — so it can't be used to enumerate a person's stores.
 */
export const checkEmailController = asyncHandler(async (req, res) => {
  const normalizedEmail = String(req.query.email || "").toLowerCase().trim();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail)) {
    return res.status(200).json({ success: true, data: { exists: false } });
  }
  const TenantUser = mongoose.model("TenantUser");
  const User = mongoose.model("User");
  const inDirectory = await TenantUser.exists({
    email: normalizedEmail,
    tenantId: { $ne: null },
  });
  const hasAccount = inDirectory
    ? true
    : !!(await User.exists({
        email: normalizedEmail,
        isActive: true,
        tenantId: { $ne: null },
        $or: [
          { roles: { $elemMatch: { $in: ["admin", "manager", "staff"] } } },
          { customRoleIds: { $exists: true, $ne: [] } },
        ],
      }));
  res.status(200).json({ success: true, data: { exists: hasAccount } });
});

export const loginController = asyncHandler(async (req, res) => {
  const { email, password, domain, tenantId } = req.body;
  const Tenant = mongoose.model("Tenant");

  // Resolution order:
  //   1. explicit tenantId (store-picker flow)
  //   2. explicit domain (legacy clients)
  //   3. host-resolved tenant — when the login request comes from a STORE
  //      SUBDOMAIN, log directly into that store (no multi-store picker).
  //      The storefrontTenantResolver sets req.tenant from the Host; on the
  //      main app domain it stays unset, so that case falls through to the
  //      email directory lookup + picker below.
  //   4. email lookup in the cross-tenant TenantUser directory (picker)
  let tenant = null;

  if (tenantId) {
    tenant = await Tenant.findById(tenantId).lean();
  } else if (domain) {
    tenant = await Tenant.findByDomain(domain);
  } else if (req.tenant) {
    tenant = req.tenant;
  } else {
    const TenantUser = mongoose.model("TenantUser");
    const normalizedEmail = String(email || "").toLowerCase().trim();
    // Match rows that belong to a tenant (skip platform-admin users,
    // which don't have a tenantId). TenantUser is the cross-tenant
    // owner/admin directory, while invited staff and custom-role users
    // live in tenant-scoped User rows. Union both sources so store
    // selection is based on every tenant where this email has an active
    // dashboard-capable account. Plain storefront customers are excluded:
    // a customer account must not make the merchant dashboard offer that
    // store as a login target.
    const directoryMatches = await TenantUser.find({
      email: normalizedEmail,
      tenantId: { $ne: null },
    })
      .select("tenantId")
      .lean();

    const User = mongoose.model("User");
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

    if (tenantIds.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Filter to tenants that actually exist and are active. A stale
    // TenantUser row pointing at a deleted tenant would otherwise
    // either (a) inflate matches.length past 1 and show a picker with
    // fewer cards than matches, or (b) get auto-picked and immediately
    // fail the downstream tenant lookup.
    const liveTenants = await Tenant.find({
      _id: { $in: tenantIds },
      isActive: true,
    })
      .select("name slug domains")
      .lean();

    if (liveTenants.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (liveTenants.length > 1) {
      return res.status(200).json({
        success: true,
        requiresStoreSelection: true,
        message: "Multiple stores found for this email. Please pick one.",
        data: {
          stores: liveTenants.map((t) => ({
            id: String(t._id),
            name: t.name,
            slug: t.slug,
            domain:
              t.domains?.subdomain?.fullDomain ||
              t.domains?.subdomain?.name ||
              t.slug,
          })),
        },
      });
    }

    tenant = liveTenants[0];
  }

  if (!tenant) {
    // Keep message identical to bad-password so we don't leak which
    // field was wrong. A 401 rather than 404 for the same reason.
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  const models = createScopedModels(mongoose.connection, tenant._id);
  const result = await loginService(models, email, password, tenant._id);
  // Attach the tenant's primary host so the dashboard can hop to the
  // right subdomain — the auth middleware on tenant hosts rejects tokens
  // whose tenantId disagrees with the host's resolved tenant, so logging
  // into Store B from Store A's URL would otherwise 403 every request.
  if (result.success && result.responseObject) {
    result.responseObject.tenantId = String(tenant._id);
    result.responseObject.tenantDomain =
      tenant.domains?.subdomain?.fullDomain ||
      tenant.domains?.subdomain?.name ||
      tenant.slug ||
      null;
    result.responseObject.tenantSlug = tenant.slug || null;
  }
  res.status(result.statusCode).json(result);
});

export const refreshTokenController = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: "Refresh token is required" });
  }

  const hashed = hashToken(refreshToken);
  const RefreshToken = mongoose.connection.model("RefreshToken");
  const tokenDoc = await RefreshToken.findOne({ token: hashed }).lean();

  if (!tokenDoc) {
    return res.status(401).json({ success: false, message: "Invalid refresh token" });
  }

  const models = createScopedModels(mongoose.connection, tokenDoc.tenantId);
  const result = await refreshTokenService(models, refreshToken, tokenDoc);
  res.status(result.statusCode).json(result);
});

export const getCurrentUserController = asyncHandler(async (req, res) => {
  // Pull tenant settings so the dashboard can format prices in the
  // merchant's currency / timezone without a second round-trip.
  let settings = null;
  try {
    const Tenant = (await import("mongoose")).default.model("Tenant");
    const tenant = await Tenant.findById(req.user.tenantId)
      .select("settings.currency settings.timezone settings.language name")
      .lean();
    if (tenant) {
      settings = {
        currency: tenant.settings?.currency || "SDG",
        timezone: tenant.settings?.timezone || "Africa/Khartoum",
        language: tenant.settings?.language || "en",
        storeName: tenant.name,
      };
    }
  } catch {
    // Non-fatal — the dashboard falls back to SDG.
  }
  // Resolve effective permissions so the dashboard can gate UI without
  // replaying the middleware's role→permission lookup on the client.
  // Wildcard expands to "*"; callers treat that as "anything goes".
  let permissions = [];
  try {
    const perms = await getEffectivePermissions(req);
    permissions = Array.from(perms);
  } catch {
    permissions = [];
  }
  res.json({
    success: true,
    message: "User info retrieved successfully",
    responseObject: {
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      roles: req.user.roles,
      permissions,
      settings,
    },
  });
});

export const changePasswordController = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ success: false, message: "currentPassword and newPassword are required" });
  }
  const result = await changePasswordService(
    req.models,
    req.user.userId,
    currentPassword,
    newPassword
  );
  if (result.success) {
    logAudit(req.models, {
      action: "user.password_changed",
      resource: "User",
      resourceId: req.user.userId,
      req,
    });
  }
  res.status(result.statusCode).json(result);
});

// ─── Forgot-password controllers ──────────────────────────────────────
//
// Both controllers return the SAME generic success envelope regardless
// of whether anything actually happened server-side. This is a
// deliberate anti-enumeration choice — an attacker probing for valid
// emails (or probing which tokens are currently live) gets no signal
// from the response shape, status code, or timing (the service does the
// same amount of work either way at the grain the attacker can see).
//
// Validation failures (malformed email, badly-formed token, weak new
// password) are allowed to surface as 400s because they can be
// reproduced without any server-side state and so don't leak
// information the attacker couldn't have obtained on their own.

export const requestPasswordResetController = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  // Service always resolves — we ignore any internal signal and return
  // the same envelope whether or not the email matched.
  await requestPasswordReset(mongoose.connection, email);
  res.status(200).json({
    success: true,
    message:
      "If an account exists for that email, a password reset link has been sent.",
  });
});

export const confirmPasswordResetController = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body || {};
  const result = await confirmPasswordReset(mongoose.connection, { token, newPassword });
  if (result.success) {
    // Audit the successful reset so platform-admin can trace who
    // actually rotated their own password vs. who was invited / reset
    // by staff. We don't have a tenant-scoped models object here (the
    // service is tenant-agnostic by design), so skip the audit entry
    // and let the logger carry the event — platform admins can grep
    // logs for this.
  }
  res.status(result.statusCode).json({
    success: result.success,
    message: result.message,
    responseObject: result.responseObject,
  });
});

export const logoutController = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: "Refresh token is required" });
  }

  const models = createScopedModels(mongoose.connection, req.user.tenantId);
  const result = await logoutService(models, refreshToken);
  res.status(result.statusCode).json(result);
});
