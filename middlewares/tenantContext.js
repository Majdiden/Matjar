import mongoose from "mongoose";
import { createScopedModels } from "../utils/scopedModel.js";
import { resolveTenantByHost } from "../services/domainRegistry.js";
import config from "../config/index.js";

/**
 * Resolve tenant from the request hostname.
 *
 * Delegates to the Domain Registry service so there is exactly one
 * copy of hostname-resolution logic in the codebase — the storefront
 * serve middleware and the API tenant middleware must never diverge.
 *
 * Supports:
 *   - slug.localhost:3000        (local dev with subdomains)
 *   - slug.matjar.to            (production subdomains)
 *   - custom-domain.com          (custom domains, via Domain registry)
 *   - localhost:3000             (dev fallback → first active tenant)
 */
async function resolveTenant(hostname) {
  return resolveTenantByHost(hostname);
}

/**
 * Storefront tenant resolver — resolves tenant from subdomain/hostname.
 * Injects req.tenant, req.tenantId, req.models (scoped).
 */
export const storefrontTenantResolver = async (req, res, next) => {
  try {
    const hostname = req.hostname || req.headers.host;

    // App host (`app.<platformDomain>`) is tenant-agnostic — it serves the
    // single merchant dashboard for EVERY store. We deliberately skip
    // host-based tenant resolution here so the tenant is decided by the
    // authenticated JWT (see middlewares/auth.js: with no host-bound
    // req.tenantId, the token's tenantId is trusted). Public endpoints that
    // need no tenant (auth login/register/otp, vapid key) still work because
    // they never require req.tenant. This must NOT fall through to
    // resolveTenant — otherwise a tenant whose slug is literally "app" would
    // hijack the whole dashboard host.
    if (config.isAppHost(hostname)) {
      req.isAppHost = true;
      return next();
    }

    const tenant = await resolveTenant(hostname);

    if (!tenant) {
      // No tenant — allow registration routes through without context
      return next();
    }

    req.tenant = tenant;
    req.tenantId = tenant._id;
    req.models = createScopedModels(mongoose.connection, tenant._id);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * API tenant resolver — resolves tenant from JWT payload (req.tenantId set by auth middleware).
 * Creates scoped models for the authenticated tenant.
 */
/**
 * Guard middleware — returns 404 if tenant context was not resolved.
 * Use on route groups that require a tenant (e.g. storefront, dashboard).
 */
export const requireTenant = (req, res, next) => {
  if (!req.tenant || !req.models) {
    return res.status(404).json({
      success: false,
      message: "Store not found. Please check the URL.",
    });
  }
  next();
};

export const apiTenantResolver = (req, res, next) => {
  if (!req.tenantId) {
    return res.status(401).json({ error: "Tenant context missing. Authentication required." });
  }
  req.models = createScopedModels(mongoose.connection, req.tenantId);
  next();
};
