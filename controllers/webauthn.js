import mongoose from "mongoose";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { issueAuthSession } from "../services/auth.js";
import {
  buildRegistrationOptions,
  verifyRegistration,
  buildAuthenticationOptions,
  verifyAuthentication,
  listUserPasskeys,
  deleteUserPasskey,
} from "../services/webauthn.js";

/**
 * Derive the WebAuthn Relying Party ID + expected origin from the request.
 * rpID is the bare hostname (no port); origin includes scheme + host + port.
 * Both must match between the enrollment and authentication ceremonies, which
 * they do here because the dashboard for a store is always served from the
 * same host the ceremony runs on.
 */
function rpFromRequest(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || req.hostname;
  const hostname = String(host).split(":")[0];
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  return { rpID: hostname, origin: `${proto}://${host}` };
}

// ─── Credential management (authenticated) ──────────────────────────

export const listCredentialsController = asyncHandler(async (req, res) => {
  const passkeys = await listUserPasskeys({
    models: req.models,
    userId: req.user.userId,
  });
  res.json({ success: true, responseObject: { passkeys } });
});

export const deleteCredentialController = asyncHandler(async (req, res) => {
  const result = await deleteUserPasskey({
    models: req.models,
    userId: req.user.userId,
    id: req.params.id,
  });
  res.status(result.statusCode).json({ success: result.success, message: result.message });
});

// ─── Enrollment (authenticated) ─────────────────────────────────────

export const registrationOptionsController = asyncHandler(async (req, res) => {
  const { rpID } = rpFromRequest(req);
  // Pull a friendly name/email for the authenticator's user handle.
  const me = await req.models.User.findById(req.user.userId).select("name email").lean();
  const options = await buildRegistrationOptions({
    models: req.models,
    tenantId: req.tenantId,
    userId: req.user.userId,
    userName: me?.email || String(req.user.userId),
    userDisplayName: me?.name || me?.email || "Matjar user",
    rpID,
  });
  res.json({ success: true, responseObject: options });
});

export const verifyRegistrationController = asyncHandler(async (req, res) => {
  const { rpID, origin } = rpFromRequest(req);
  const result = await verifyRegistration({
    models: req.models,
    tenantId: req.tenantId,
    userId: req.user.userId,
    response: req.body.response || req.body,
    rpID,
    origin,
    name: req.body.name,
  });
  res.status(result.statusCode).json({
    success: result.success,
    message: result.message,
    responseObject: result.credential || null,
  });
});

// ─── Passwordless authentication (public) ───────────────────────────
//
// Resolve which store/user the email belongs to (mirrors loginController's
// resolution order), gather that user's passkeys, and hand back options +
// an opaque flowId. We deliberately return a neutral shape whether or not
// the email has any passkeys — the client shows the same "try your password"
// fallback either way, so this can't be used to enumerate accounts.

async function resolveTenantForEmail(req, email, tenantId) {
  const Tenant = mongoose.model("Tenant");
  if (tenantId) return Tenant.findById(tenantId).lean();
  if (req.tenant) return req.tenant;
  const TenantUser = mongoose.model("TenantUser");
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const match = await TenantUser.findOne({ email: normalizedEmail, tenantId: { $ne: null } })
    .select("tenantId")
    .lean();
  if (!match) return null;
  return Tenant.findOne({ _id: match.tenantId, isActive: true }).lean();
}

export const authenticationOptionsController = asyncHandler(async (req, res) => {
  const { rpID } = rpFromRequest(req);
  const { email, tenantId } = req.body || {};

  const tenant = await resolveTenantForEmail(req, email, tenantId);
  if (!tenant) {
    return res.json({ success: true, responseObject: { hasCredentials: false } });
  }

  const models = createScopedModels(mongoose.connection, tenant._id);
  const user = await models.User.findOne({ email: String(email || "").toLowerCase().trim() })
    .select("_id")
    .lean();
  if (!user) {
    return res.json({ success: true, responseObject: { hasCredentials: false } });
  }

  const result = await buildAuthenticationOptions({
    models,
    tenantId: tenant._id,
    userId: user._id,
    rpID,
  });

  if (!result.hasCredentials) {
    return res.json({ success: true, responseObject: { hasCredentials: false } });
  }

  res.json({
    success: true,
    responseObject: { hasCredentials: true, options: result.options, flowId: result.flowId },
  });
});

export const verifyAuthenticationController = asyncHandler(async (req, res) => {
  const { rpID, origin } = rpFromRequest(req);
  const { flowId, response } = req.body || {};
  if (!flowId || !response) {
    return res.status(400).json({ success: false, message: "flowId and response are required" });
  }

  const result = await verifyAuthentication({
    flowId,
    response,
    rpID,
    origin,
    modelsForTenant: (tid) => createScopedModels(mongoose.connection, tid),
  });

  if (!result.success) {
    return res.status(result.statusCode).json({ success: false, message: result.message });
  }

  // Mint a session identical to a password login so the dashboard hop +
  // host binding works exactly the same.
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(result.tenantId).lean();
  const user = await result.models.User.findById(result.userId)
    .select("_id email name roles tokenVersion isActive")
    .lean();
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: "Account is disabled or not found." });
  }

  const responseObject = await issueAuthSession(result.models, user, result.tenantId);
  responseObject.tenantId = String(result.tenantId);
  responseObject.tenantDomain =
    tenant?.domains?.subdomain?.fullDomain ||
    tenant?.domains?.subdomain?.name ||
    tenant?.slug ||
    null;
  responseObject.tenantSlug = tenant?.slug || null;

  res.status(200).json({ success: true, message: "Signed in with passkey", responseObject });
});
