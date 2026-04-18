import mongoose from "mongoose";
import { DOMAIN_STATUSES } from "../schemas/domain.js";
import config from "../config/index.js";

/**
 * Canonical-host redirect middleware.
 *
 * When a tenant has multiple domains attached (apex + www, or
 * subdomain + custom), exactly one is flagged `isPrimary` in the
 * Domain registry and the others 301 to it. This avoids duplicate
 * storefront URLs in search indexes and gives merchants the
 * www-vs-apex canonicalization they expect.
 *
 * The middleware:
 *   1. Looks up the inbound host in the Domain registry.
 *   2. If found and NOT primary, finds the tenant's primary row and
 *      redirects with a 301 to the same path on that hostname.
 *   3. Respects `redirects.forceHttps` — upgrades http→https when set.
 *   4. Skips API/dashboard/storefront-api paths so admin tooling on
 *      non-primary hosts keeps working.
 *   5. Is a no-op if the Domain model isn't registered (dev boot
 *      before migrations) or the host isn't in the registry.
 *
 * Mounted BEFORE the storefront middleware but AFTER the API/dashboard
 * routes, so storefront traffic gets redirected while dashboard
 * traffic on a subdomain still works.
 */
export function createCanonicalRedirectMiddleware() {
  return async (req, res, next) => {
    // Skip non-storefront paths so merchants can always reach the
    // dashboard/API regardless of which host they're on.
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/dashboard") ||
      req.path.startsWith("/storefront") ||
      req.path.startsWith("/.well-known")
    ) {
      return next();
    }

    let Domain;
    try {
      Domain = mongoose.model("Domain");
    } catch {
      return next();
    }

    const hostHeader = req.headers.host || req.hostname;
    if (!hostHeader) return next();
    const host = String(hostHeader).split(":")[0].toLowerCase().replace(/\.$/, "");

    let inboundRow;
    try {
      // Only ACTIVE rows can trigger redirects or HTTPS upgrades.
      // Matching dns_verified or provisioning_ssl would hand the
      // visitor an https:// URL before the cert is actually issued
      // (guaranteed TLS error) or a 301 to a primary that isn't
      // ready yet. Stay silent until the row is active.
      inboundRow = await Domain.findOne({
        hostname: host,
        status: DOMAIN_STATUSES.ACTIVE,
      }).lean();
    } catch {
      return next();
    }
    if (!inboundRow) return next();

    // Upgrade http → https when the inbound row demands it. Skip in
    // development where TLS isn't usually terminated locally.
    if (
      inboundRow.redirects?.forceHttps &&
      req.protocol === "http" &&
      config.isProduction
    ) {
      return res.redirect(301, `https://${host}${req.originalUrl}`);
    }

    if (inboundRow.isPrimary) return next();

    // Find the tenant's primary row to redirect to. If there isn't
    // one (malformed state), fall through rather than 404 — better
    // to serve the non-canonical URL than break traffic.
    const primary = await Domain.findOne({
      tenantId: inboundRow.tenantId,
      isPrimary: true,
      status: DOMAIN_STATUSES.ACTIVE,
    }).lean();
    if (!primary || primary.hostname === host) return next();

    const scheme =
      config.isProduction && primary.redirects?.forceHttps !== false
        ? "https"
        : req.protocol;
    return res.redirect(301, `${scheme}://${primary.hostname}${req.originalUrl}`);
  };
}
