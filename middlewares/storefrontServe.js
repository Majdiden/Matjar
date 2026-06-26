import path from "path";
import fs from "fs";
import express from "express";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";
import config from "../config/index.js";
import { resolveTenantByHost } from "../services/domainRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THEMES_DIR = path.resolve(__dirname, "../storefront-themes");
const DEFAULT_THEME = "modern";

// Strict slug validator. Theme slugs are tenant-controlled (set via the
// dashboard) and we then concatenate them into a filesystem path — any
// `..`, slash, or null byte must be rejected before we touch the FS.
const SLUG_RE = /^[a-z0-9_-]+$/;
const isSafeSlug = (slug) =>
  typeof slug === "string" && slug.length > 0 && slug.length <= 64 && SLUG_RE.test(slug);

// Cache resolved theme paths to avoid repeated fs checks.
//
// Positive hits (resolved dist path) are cached for the process
// lifetime — a built theme doesn't unbuild itself, and on rebuild the
// build pipeline calls `clearThemeCache()` directly.
//
// Negative hits (theme exists in config but isn't built yet) are
// cached with a short TTL. Without the TTL, the first request for
// a not-yet-built theme would poison the cache forever and the
// operator would have to restart the process after `npm run build`
// finished. With the TTL, the build completes and the next request
// after the TTL expires picks up the new dist folder automatically.
const THEME_PATH_CACHE_NEG_TTL_MS = 30 * 1000;
const themePathCache = new Map();

/**
 * Check if a theme's dist folder exists and is built. Returns null
 * for any slug that fails the allowlist or whose resolved path
 * escapes `THEMES_DIR` (defense in depth on top of the regex).
 */
function getThemeDistPath(themeSlug) {
  if (!isSafeSlug(themeSlug)) return null;

  const cached = themePathCache.get(themeSlug);
  if (cached) {
    // Positive entry — cached forever.
    if (cached.value) return cached.value;
    // Negative entry — honour only while fresh, then fall through
    // and re-check the filesystem.
    if (cached.expiresAt && cached.expiresAt > Date.now()) return null;
  }

  const distPath = path.resolve(THEMES_DIR, themeSlug, "dist");
  if (!distPath.startsWith(THEMES_DIR + path.sep)) {
    themePathCache.set(themeSlug, { value: null, expiresAt: Date.now() + THEME_PATH_CACHE_NEG_TTL_MS });
    return null;
  }
  const indexPath = path.join(distPath, "index.html");

  if (fs.existsSync(indexPath)) {
    themePathCache.set(themeSlug, { value: distPath, expiresAt: 0 });
    return distPath;
  }

  themePathCache.set(themeSlug, { value: null, expiresAt: Date.now() + THEME_PATH_CACHE_NEG_TTL_MS });
  return null;
}

/**
 * Clear theme path cache (call after theme rebuild).
 */
export function clearThemeCache() {
  themePathCache.clear();
}

/**
 * Resolve which theme slug a tenant should use.
 */
async function resolveThemeSlug(tenant) {
  if (!tenant) return DEFAULT_THEME;

  // Check tenant's active theme setting
  const activeTheme = tenant.settings?.activeTheme;
  if (activeTheme) {
    const distPath = getThemeDistPath(activeTheme);
    if (distPath) return activeTheme;
    logger.warn("Storefront theme not built, falling back to default", { theme: activeTheme });
  }

  return DEFAULT_THEME;
}

/**
 * Storefront serving middleware.
 *
 * Mounts at "/" — resolves tenant from hostname, looks up their activeTheme,
 * and serves that theme's built static files. Falls back to default theme.
 *
 * API routes (/api, /storefront, /dashboard) should be mounted BEFORE this.
 */
export function createStorefrontMiddleware() {
  const router = express.Router();

  router.use(async (req, res, next) => {
    // Skip API, dashboard, and platform-admin routes — they're mounted
    // before this. Without the /platform guard, a shopper request to
    // a tenant host with a stray /platform URL would fall through to
    // the tenant's theme SPA and render a broken storefront page
    // instead of the operator UI.
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/storefront") ||
      req.path.startsWith("/dashboard") ||
      req.path.startsWith("/platform")
    ) {
      return next();
    }

    // Platform hosts (apex, www, app) are NOT storefronts — they front the
    // merchant dashboard. Redirect them into the dashboard SPA instead of
    // resolving them as a (non-existent) tenant and serving the default
    // theme. /api, /dashboard, /platform and /storefront are already
    // handled above, so only stray non-app paths reach here. Real tenant
    // subdomains and custom domains fall through to normal theme serving.
    const platformDomain = (config.platformDomain || "").toLowerCase();
    const reqHost = (req.hostname || req.headers.host || "")
      .toLowerCase()
      .split(":")[0];
    if (
      platformDomain &&
      (reqHost === platformDomain ||
        reqHost === `www.${platformDomain}` ||
        reqHost === `app.${platformDomain}`)
    ) {
      return res.redirect(302, "/dashboard" + req.originalUrl);
    }

    // When the dashboard editor loads the storefront inside its preview
    // iframe, it appends `?preview=<token>` to the URL. The storefront
    // and the dashboard sit on different origins (e.g. tech-hubs.localhost
    // vs localhost:5173 in dev, and separate tenant/admin domains in
    // prod), so helmet's default `X-Frame-Options: SAMEORIGIN` and CSP
    // `frame-ancestors 'self'` block the embed. Relax both headers for
    // HTML responses that carry a preview token — the token itself is
    // the authorization and the content is a read-only preview, so the
    // clickjacking surface is negligible.
    if (typeof req.query.preview === "string" && req.query.preview.length > 0) {
      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Security-Policy", "frame-ancestors *");
    }

    try {
      const hostname = req.hostname || req.headers.host;
      // Unified resolution via the Domain registry — same code path
      // used by middlewares/tenantContext.js so there is exactly one
      // place where hostname → tenant logic lives.
      const tenant = await resolveTenantByHost(hostname);

      if (!tenant) {
        // No tenant found — serve default theme with a "no store" state
        const distPath = getThemeDistPath(DEFAULT_THEME);
        if (distPath) {
          return res.sendFile(path.join(distPath, "index.html"));
        }
        return res.status(404).send("No store found. Register a store first.");
      }

      const themeSlug = await resolveThemeSlug(tenant);
      let distPath = getThemeDistPath(themeSlug);

      // Graceful degradation: if the tenant's active theme isn't built,
      // fall back to the platform default rather than 500ing the shopper.
      // A 500 here is catastrophic — it means a theme CI miss or a rename
      // takes every merchant on that theme offline. A shopper seeing the
      // default theme is strictly better than "Theme is not built."
      if (!distPath && themeSlug !== DEFAULT_THEME) {
        logger.error("Theme dist missing, falling back to default", {
          tenantId: tenant._id?.toString?.(),
          themeSlug,
          fallback: DEFAULT_THEME,
        });
        distPath = getThemeDistPath(DEFAULT_THEME);
      }

      if (!distPath) {
        // Even the platform default is unbuilt — serve a static,
        // branded "store temporarily unavailable" page with a 503
        // so uptime checks and retries behave correctly. 500 was wrong
        // here: the request isn't malformed, the backend is healthy,
        // we just don't have a theme artifact to serve.
        res.status(503);
        res.setHeader("Retry-After", "300");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(
          `<!doctype html><html><head><meta charset="utf-8"><title>Store temporarily unavailable</title>` +
          `<meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;` +
          `align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#111827}` +
          `.c{text-align:center;padding:2rem;max-width:28rem}h1{font-size:1.5rem;margin:0 0 .5rem}` +
          `p{color:#6b7280;line-height:1.5}</style></head><body><div class="c">` +
          `<h1>Store temporarily unavailable</h1><p>We're setting things up. Please check back shortly.</p>` +
          `</div></body></html>`
        );
      }

      // Serve static assets (JS, CSS, images). Containment check: even
      // though Express normalizes most `..` segments, we explicitly
      // verify the resolved path stays inside the theme's dist folder
      // before touching the filesystem. Anything that escapes falls
      // through to a 404 instead of leaking files.
      if (req.path !== "/") {
        const requestedAsset = path.resolve(distPath, "." + req.path);
        if (requestedAsset.startsWith(distPath + path.sep)) {
          if (fs.existsSync(requestedAsset) && fs.statSync(requestedAsset).isFile()) {
            return res.sendFile(requestedAsset);
          }
        }

        // Asset-looking paths (Vite's /assets/ folder, or any path with a
        // file extension) that miss must 404 — NOT fall through to the
        // SPA index.html. Serving HTML for missing JS/CSS/images is the
        // classic "broken images + syntax errors in console" bug because
        // the browser gets <!doctype html> where it expected a JS bundle.
        if (req.path.startsWith("/assets/") || /\.[a-z0-9]{1,6}$/i.test(req.path)) {
          return res.status(404).send("Not Found");
        }
      }

      // SPA fallback — serve index.html for all non-asset routes
      return res.sendFile(path.join(distPath, "index.html"));
    } catch (error) {
      logger.error("Storefront error serving theme", { error: error.message });
      next(error);
    }
  });

  return router;
}
