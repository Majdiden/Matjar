import apiRouter from "../routes/index.js";
import platformAdminRouter from "../routes/platformAdmin.js";
import platformAdminAppRouter from "../routes/platformAdminApp.js";
import storefrontRouter from "../routes/storefront.js";
import ogRouter from "../routes/og.js";
import dashboardRouter from "../routes/dashboard.js";
import { storefrontTenantResolver } from "../middlewares/tenantContext.js";
import { subscriptionGate } from "../middlewares/subscriptionGate.js";
import { createStorefrontMiddleware } from "../middlewares/storefrontServe.js";
import { createCanonicalRedirectMiddleware } from "../middlewares/canonicalRedirect.js";
import { dashboardHostRedirect } from "../middlewares/dashboardHost.js";
import config from "../config/index.js";

export default function (app) {
  // App host (`app.<platformDomain>`) is the tenant-agnostic dashboard home
  // and has NO storefront. Bounce its root to the dashboard so a bare visit to
  // app.invoila.io lands on the login/shell instead of the storefront 404.
  app.get("/", (req, res, next) => {
    if (config.isAppHost(req.hostname || req.headers.host)) {
      return res.redirect(302, "/dashboard");
    }
    next();
  });
  // Platform admin surface — cross-tenant, NOT host-bound. Mount
  // BEFORE the tenant resolver so operators can hit /api/platform
  // from the canonical platform host without a subdomain context.
  app.use("/api/platform", platformAdminRouter);

  // API routes (under /api prefix with tenant resolution from subdomain).
  // subscriptionGate runs after tenant resolution so mutating calls to a
  // suspended/cancelled/deleting tenant return 402/410 instead of silently
  // writing to a store the merchant no longer owns.
  app.use("/api", storefrontTenantResolver, subscriptionGate, apiRouter);

  // Storefront public API (headless — consumed by React theme apps)
  app.use("/storefront", storefrontTenantResolver, storefrontRouter);

  // Dashboard routes (serves the built SPA). The host resolver runs first so
  // dashboardHostRedirect knows whether we're on the app host, a tenant
  // subdomain (→ redirect to the app host), or a bare dev host (→ serve).
  app.use("/dashboard", storefrontTenantResolver, dashboardHostRedirect, dashboardRouter);

  // Platform-admin SPA (cross-tenant operator UI). Mounted at /platform
  // with no tenant resolver so it loads on any host — including the
  // canonical platform domain — and the SPA itself talks to /api/platform.
  // Mounted BEFORE the storefront catch-all so /platform/* never falls
  // through to tenant theme serving.
  app.use("/platform", platformAdminAppRouter);

  // Public OG share-card image (host-resolved to a tenant). Mounted BEFORE
  // the storefront catch-all so `/og/store-card.png` returns the composed PNG
  // instead of falling through to the theme SPA. No tenant resolver here — the
  // handler resolves the tenant from the request host itself (subdomain OR
  // custom domain), matching the storefront serving path.
  app.use("/og", ogRouter);

  // Canonical-host redirect — after API/dashboard so admin tooling
  // on non-primary hosts still works, before storefront so shopper
  // traffic gets 301'd to the primary domain.
  app.use(createCanonicalRedirectMiddleware());

  // Storefront theme serving — catch-all AFTER API routes
  // Resolves tenant from hostname → serves their active theme's built files
  app.use(createStorefrontMiddleware());
}
