import mongoose from "mongoose";
import { verifyJWT } from "../utils/misc.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { evaluateSubscriptionBlock } from "./subscriptionGate.js";
import logger from "../utils/logger.js";

/**
 * Authentication middleware
 * Verifies JWT, injects req.user, req.tenantId, req.tenant, req.models
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }

    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findById(decoded.tenantId);
    if (!tenant || !tenant.isActive) {
      return res.status(404).json({ success: false, message: "Tenant not found." });
    }

    // Host-bound tenancy policy. If a host resolver (storefrontTenantResolver
    // or similar) already bound this request to a specific tenant via the
    // Host header, the token's tenantId MUST agree. Otherwise we'd silently
    // flip the request's tenant context from "whoever owns this host" to
    // "whoever signed this token" — ambiguous and dangerous for admins who
    // think they're operating on Store B but carry a Store A token.
    //
    // Central dashboard / platform-admin routes that don't resolve a host
    // tenant are unaffected: `req.tenantId` is undefined at this point and
    // the token is trusted to decide the tenant.
    const hostTenantId = req.tenantId ? String(req.tenantId) : null;
    const tokenTenantId = String(decoded.tenantId);
    if (hostTenantId && hostTenantId !== tokenTenantId) {
      return res.status(403).json({
        success: false,
        message: "Token tenant does not match the requested store.",
      });
    }

    req.tenantId = tenant._id;
    req.tenant = tenant;
    req.models = createScopedModels(mongoose.connection, tenant._id);

    // Subscription write-gate for the app host. On tenant subdomains the
    // host-mounted `subscriptionGate` already blocked suspended/cancelled/
    // deleting stores BEFORE this middleware ran (it had a host-resolved
    // req.tenant). On the tenant-agnostic app host there is no host tenant at
    // that point — the tenant is only known here, from the JWT — so we re-run
    // the same evaluation to keep write-blocking consistent across hosts.
    if (req.isAppHost) {
      const blocked = evaluateSubscriptionBlock(tenant, req.method);
      if (blocked) return res.status(blocked.statusCode).json(blocked.body);
    }

    // Revalidate user is still active and the token wasn't issued
    // before the user's most recent invalidation epoch (a password
    // change bumps `tokenVersion`, killing every prior JWT). We also
    // re-hydrate `roles` from the DB so a demoted user (admin → customer)
    // immediately loses privileges instead of waiting for their token
    // to expire — trusting `decoded.roles` would let a stale token keep
    // admin access for the entire JWT lifetime.
    const user = await req.models.User.findById(decoded.userId).select(
      "isActive tokenVersion roles customRoleIds"
    );
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Account is disabled or not found." });
    }
    const currentVersion = user.tokenVersion ?? 0;
    const tokenVersion = decoded.tokenVersion ?? 0;
    if (tokenVersion !== currentVersion) {
      return res
        .status(401)
        .json({ success: false, message: "Session has been revoked. Please log in again." });
    }

    // Consent-grant impersonation binding. When the token carries an
    // `impersonation` claim (minted by services/impersonation.js after the
    // owner approved), the request is only allowed while the grant is still
    // ACTIVE and unexpired. This is what makes an owner revoke immediate:
    // the moment the grant flips to cancelled/ended/expired, the very next
    // impersonated request 401s — no token blacklist needed.
    if (decoded.impersonation?.grantId) {
      const grant = await req.models.ImpersonationGrant.findById(
        decoded.impersonation.grantId
      )
        .select("status sessionExpiresAt supportUserId ticket")
        .lean();
      const live =
        grant &&
        grant.status === "active" &&
        grant.sessionExpiresAt &&
        new Date(grant.sessionExpiresAt).getTime() > Date.now() &&
        String(grant.supportUserId) === String(decoded.impersonation.supportUserId);
      if (!live) {
        return res.status(401).json({
          success: false,
          message: "Impersonation session has ended.",
          code: "impersonation_ended",
        });
      }
      req.impersonation = {
        grantId: String(decoded.impersonation.grantId),
        supportUserId: String(decoded.impersonation.supportUserId),
        ticket: grant.ticket,
      };
    }

    req.user = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      roles: user.roles || [],
      customRoleIds: user.customRoleIds || [],
      // Propagate impersonation claims so audit logs can attribute
      // actions to the real platform operator rather than the
      // impersonated tenant user. Undefined on non-impersonation tokens.
      impersonatedBy: decoded.impersonatedBy,
      impersonationReason: decoded.impersonationReason,
    };

    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Authentication failed." });
  }
};

/**
 * Optional authentication — does not fail if token is missing.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyJWT(token);

    if (decoded) {
      // If the host resolver has already bound this request to a tenant
      // (public storefront/API routes do this), NEVER let the bearer
      // token swap the tenant context out from under it. A customer of
      // Tenant A sending their token to Tenant B's host must not cause
      // handlers to read/write against Tenant A. If the token's tenant
      // doesn't match the host tenant, ignore the token entirely.
      const hostTenantId = req.tenantId ? String(req.tenantId) : null;
      const tokenTenantId = String(decoded.tenantId);

      if (hostTenantId && hostTenantId !== tokenTenantId) {
        // Cross-tenant token on a host-bound route — ignore silently.
        return next();
      }

      const Tenant = mongoose.model("Tenant");
      const tenant = await Tenant.findById(decoded.tenantId);

      if (tenant && tenant.isActive) {
        const models = req.models || createScopedModels(mongoose.connection, tenant._id);
        // Revalidate user is still active AND the token's version
        // matches the user's current epoch — same defense as the
        // strict middleware, just silent on failure.
        const user = await models.User.findById(decoded.userId).select(
          "isActive tokenVersion roles"
        );
        const currentVersion = user?.tokenVersion ?? 0;
        const tokenVersion = decoded.tokenVersion ?? 0;
        if (user && user.isActive && tokenVersion === currentVersion) {
          req.user = {
            userId: decoded.userId,
            tenantId: decoded.tenantId,
            // Roles re-hydrated from the DB so a demoted user loses
            // privileges immediately, not on next token refresh.
            roles: user.roles || [],
          };
          // Only populate tenant context if the host resolver didn't
          // already. Never overwrite an existing host-resolved binding.
          if (!req.tenantId) {
            req.tenantId = tenant._id;
            req.tenant = tenant;
            req.models = models;
          }
        }
      }
    }

    next();
  } catch (error) {
    logger.error(`Optional authentication error: ${error.message}`);
    next();
  }
};
