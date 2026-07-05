import config from "../config/index.js";

/**
 * Dashboard host policy.
 *
 * The merchant dashboard now lives on a single, tenant-agnostic host —
 * `app.<platformDomain>` (e.g. app.matjar.to, or app.localhost:3000 in dev).
 * One PWA install, one login, switch between all your stores in-app; the
 * active tenant rides the JWT.
 *
 * This middleware runs AFTER the host tenant resolver and BEFORE the dashboard
 * SPA router, deciding where a `/dashboard/*` request is served:
 *
 *   1. On the app host        → serve the dashboard (req.isAppHost is set).
 *   2. On a tenant subdomain  → 302-redirect to the app host, preserving the
 *      path + query and appending a `?store=<slug>` hint so the app can
 *      select that store if the visitor's token isn't set yet. The storefront
 *      (the subdomain's root and non-/dashboard paths) is UNTOUCHED.
 *   3. On a bare/dev host     → serve the dashboard (keeps `localhost:3000`
 *      login working in dev).
 *
 * This is additive and non-breaking: the old per-store dashboard URL keeps
 * responding — it just redirects to the new canonical home.
 */
export function dashboardHostRedirect(req, res, next) {
  const rawHost = req.hostname || req.headers.host;

  // Already on the canonical app host → serve normally.
  if (req.isAppHost || config.isAppHost(rawHost)) return next();

  // A real tenant was resolved from the Host (platform subdomain or verified
  // custom domain) → the dashboard belongs on the app host. Redirect there.
  if (req.tenant) {
    const proto = /localhost|127\.0\.0\.1|::1/.test(config.platformDomain) ? "http" : "https";
    let target;
    try {
      const url = new URL(req.originalUrl, `${proto}://${config.appHost}`);
      const slug = req.tenant.slug || req.tenant.domains?.subdomain?.name;
      if (slug) url.searchParams.set("store", String(slug));
      target = url.toString();
    } catch {
      target = `${proto}://${config.appHost}${req.originalUrl}`;
    }
    return res.redirect(302, target);
  }

  // Bare host with no tenant (dev `localhost:3000`) → serve the dashboard.
  next();
}
