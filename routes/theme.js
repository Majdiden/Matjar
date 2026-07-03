import express from "express";
import { authenticate, optionalAuth } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import {
  platformAuthenticate,
  requireScope,
  PLATFORM_SCOPES,
} from "../middlewares/platformAdmin.js";
import {
  createTheme,
  reloadManifests,
  getThemes,
  getActiveThemes,
  getPopularThemes,
  getLatestThemes,
  getDefaultTheme,
  getThemeById,
  getThemeBySlug,
  getThemeConfig,
  updateTheme,
  updateThemeStatus,
  setDefaultTheme,
  deleteTheme,
  installTheme,
  uninstallTheme,
  searchThemes,
  getThemesByCategory,
  getThemePreviewImage,
} from "../controllers/theme.js";

const router = express.Router();

// Platform-admin ops endpoint (audit 1.6) — cross-tenant, NOT gated by the
// tenant `authenticate` below. Reloads theme manifests from disk + re-syncs
// the catalog after a bundle deploy, no process restart required. Gated by
// the platform-admin token (own auth stack) and the tenant-lifecycle scope,
// which is the platform's "mutating platform-wide operation" scope.
router.post(
  "/reload-manifests",
  platformAuthenticate,
  requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE),
  reloadManifests
);

// Public routes (viewable by anyone, optional auth for tenant context)
router.get("/", optionalAuth, getThemes);
router.get("/active", optionalAuth, getActiveThemes);
router.get("/popular", optionalAuth, getPopularThemes);
router.get("/latest", optionalAuth, getLatestThemes);
router.get("/default", optionalAuth, getDefaultTheme);
router.get("/search", optionalAuth, searchThemes);
router.get("/category/:category", optionalAuth, getThemesByCategory);
router.get("/slug/:slug", optionalAuth, getThemeBySlug);
// Preview screenshot is a public static image — no auth or tenant context.
router.get("/:slug/preview", getThemePreviewImage);
router.get("/:id", optionalAuth, getThemeById);
router.get("/:id/config", optionalAuth, getThemeConfig);

// Protected routes - Require authentication
router.use(authenticate);

// Theme installation activates/swaps the storefront theme for the entire
// tenant — that's a merchant-only action, never something a customer
// account should be allowed to trigger.
router.post("/:id/install", requirePermission("themes.write"), installTheme);
router.post("/:id/uninstall", requirePermission("themes.write"), uninstallTheme);

// Admin only routes
router.post("/", requirePermission("themes.write"), createTheme);
router.put("/:id", requirePermission("themes.write"), updateTheme);
// NOTE: the legacy PATCH /:id/settings endpoint was removed with the
// retirement of Theme.settings (audit 1.2) — theme configuration lives
// in the built manifest, not on catalog rows.
router.patch("/:id/status", requirePermission("themes.write"), updateThemeStatus);
router.patch("/:id/set-default", requirePermission("themes.write"), setDefaultTheme);
router.delete("/:id", requirePermission("themes.write"), deleteTheme);
export default router;
