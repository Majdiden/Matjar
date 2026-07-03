import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { createScopedModels } from "../utils/scopedModel.js";
import {
  createThemeRepo,
  getThemeByIdRepo,
  getThemeBySlugRepo,
  getDefaultThemeRepo,
  getActiveThemesRepo,
  getThemesRepo,
  updateThemeRepo,
  updateThemeSettingsRepo,
  updateThemeStatusRepo,
  deleteThemeRepo,
  setDefaultThemeRepo,
  incrementThemeInstallsRepo,
  decrementThemeInstallsRepo,
  searchThemesRepo,
  getThemesByCategoryRepo,
  getPopularThemesRepo,
  getLatestThemesRepo,
  themeSlugExistsRepo,
} from "../repositories/theme.js";
import { APIError } from "../middlewares/errorHandler.js";
import { getThemeManifest, getBuiltInThemeSlugs } from "./themeManifestRegistry.js";
import { seedThemeDemoData } from "./themeDemoData.js";

/**
 * Append an audit row to ThemeCustomizationVersion for a
 * non-publish event (install, uninstall, theme switch). Version
 * numbering is monotonic on the unique (tenantId, version) index;
 * this helper does a max+1 read and retries on collision so two
 * near-simultaneous installs can't corrupt the sequence.
 *
 * We deliberately use `createScopedModels` to get the ThemeCustomizationVersion
 * model with the tenant filter baked in — install/uninstall run
 * outside the normal request-scoped pipeline (they're called from
 * tenant setup, controllers, and from installDefaultTheme) so we
 * don't have a `req.models` to thread through.
 *
 * Failures here are logged and swallowed: a broken audit write must
 * not take down a theme install, because losing one history row is
 * recoverable but losing the ability to install a theme is not.
 */
async function recordThemeAuditEvent(tenantId, source, payload) {
  try {
    const models = createScopedModels(mongoose.connection, tenantId);
    const VersionModel = models.ThemeCustomizationVersion;
    if (!VersionModel) return;
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await VersionModel.findOne({}).sort({ version: -1 }).lean();
      const nextVersion = last?.version ? last.version + 1 : 1;
      try {
        await VersionModel.create({
          ...payload,
          version: nextVersion,
          source,
          publishedAt: new Date(),
        });
        return;
      } catch (err) {
        if (err && (err.code === 11000 || err.code === 11001)) continue;
        throw err;
      }
    }
  } catch (err) {
    logger.warn("Failed to record theme audit event", {
      tenantId: tenantId?.toString(),
      source,
      error: err.message,
    });
  }
}

/**
 * Build the tenant-shaped customization payload from a theme's bundled
 * manifest. Ensures that activating/reactivating a theme immediately renders
 * the correct default sections on the storefront, instead of showing a blank
 * page until the merchant edits+publishes something (which was the old bug —
 * stale `published.sections` from the previous theme would hang around and
 * produce unknown section IDs in the new theme's registry).
 */
const buildCustomizationFromManifest = (themeSlug) => {
  const manifest = getThemeManifest(themeSlug);
  const templateSections = manifest?.templates?.index || [];

  const sections = templateSections.map((s, i) => ({
    id: s.id,
    type: s.type,
    enabled: s.disabled !== true,
    order: i,
    layout: s.layout || "full-width",
    settings: s.settings || {},
    elements: s.elements || [],
    blocks: s.blocks || [],
  }));

  const settings = {
    colors: manifest?.colors || {},
    typography: manifest?.typography || {},
    layout: {},
  };

  return { sections, settings };
};

export const createThemeService = async (themeData) => {
  const slugExists = await themeSlugExistsRepo(themeData.slug);
  if (slugExists) throw new APIError("Theme with this slug already exists", 400);
  return await createThemeRepo(themeData);
};

export const getThemeService = async (themeId) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  return theme;
};

export const getThemeBySlugService = async (slug) => {
  const theme = await getThemeBySlugRepo(slug);
  if (!theme) throw new APIError("Theme not found", 404);
  return theme;
};

export const getDefaultThemeService = async () => {
  const theme = await getDefaultThemeRepo();
  if (!theme) throw new APIError("No default theme configured", 404);
  return theme;
};

// ─── Theme preview images ────────────────────────────────────────
//
// Each built theme ships a homepage screenshot at `dist/preview.jpg`
// (authored as `public/preview.jpg`; Vite copies it into dist). The
// dashboard renders it via `GET /api/themes/:slug/preview`. Until the
// catalog sync (audit 2.4) persists `previewImage` on Theme rows, the
// list endpoints overlay the URL for any theme whose file exists.

const __theme_service_dirname = path.dirname(fileURLToPath(import.meta.url));
const THEMES_ROOT = path.resolve(__theme_service_dirname, "..", "storefront-themes");
const PREVIEW_IMAGE_FILENAME = "preview.jpg";
// Same FS-boundary rule as middlewares/storefrontServe.js: slugs are
// concatenated into a filesystem path, so reject anything that isn't a
// plain kebab-case identifier before touching the FS.
const THEME_SLUG_RE = /^[a-z0-9_-]+$/;

/**
 * Resolve the absolute path of a theme's built preview image, or null.
 * Only slugs known to the manifest registry are served, and the
 * resolved path must stay inside the theme's dist folder.
 */
export const getThemePreviewImagePathService = (slug) => {
  if (
    typeof slug !== "string" ||
    slug.length === 0 ||
    slug.length > 64 ||
    !THEME_SLUG_RE.test(slug)
  ) {
    return null;
  }
  if (!getBuiltInThemeSlugs().includes(slug)) return null;
  const distDir = path.resolve(THEMES_ROOT, slug, "dist");
  const filePath = path.resolve(distDir, PREVIEW_IMAGE_FILENAME);
  if (!filePath.startsWith(distDir + path.sep)) return null;
  return fs.existsSync(filePath) ? filePath : null;
};

/**
 * Return a plain-object copy of a theme with `previewImage` filled in
 * from the built screenshot when the DB row doesn't carry one.
 * Accepts Mongoose docs or plain objects; null passes through.
 */
export const withThemePreviewImage = (theme) => {
  if (!theme) return theme;
  const obj = typeof theme.toObject === "function" ? theme.toObject() : { ...theme };
  if (!obj.previewImage && obj.slug && getThemePreviewImagePathService(obj.slug)) {
    obj.previewImage = `/api/themes/${obj.slug}/preview`;
  }
  return obj;
};

export const getActiveThemesService = async (filters = {}) => {
  const themes = await getActiveThemesRepo(filters);
  return themes.map(withThemePreviewImage);
};

export const getThemesService = async (options = {}) => {
  return await getThemesRepo(options);
};

export const updateThemeService = async (themeId, updates) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  if (updates.slug && updates.slug !== theme.slug) {
    const slugExists = await themeSlugExistsRepo(updates.slug, themeId);
    if (slugExists) throw new APIError("Theme with this slug already exists", 400);
  }
  return await updateThemeRepo(themeId, updates);
};

export const updateThemeSettingsService = async (themeId, settings) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  return await updateThemeSettingsRepo(themeId, { ...theme.settings, ...settings });
};

export const updateThemeStatusService = async (themeId, status) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  return await updateThemeStatusRepo(themeId, status);
};

export const deleteThemeService = async (themeId) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  if (theme.isDefault) throw new APIError("Cannot delete default theme", 400);
  return await deleteThemeRepo(themeId);
};

export const setDefaultThemeService = async (themeId) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  if (theme.status !== "active") throw new APIError("Only active themes can be set as default", 400);
  return await setDefaultThemeRepo(themeId);
};

export const installThemeService = async (themeId, tenantId) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  if (theme.status !== "active") throw new APIError("Only active themes can be installed", 400);

  const Tenant = mongoose.model("Tenant");
  const currentTenant = await Tenant.findById(tenantId);
  if (!currentTenant) throw new APIError("Tenant not found", 404);

  const previousThemeId = currentTenant.themeCustomization?.themeId;
  if (previousThemeId && previousThemeId.toString() === themeId.toString()) return theme;

  if (previousThemeId) await decrementThemeInstallsRepo(previousThemeId);

  const { sections, settings } = buildCustomizationFromManifest(theme.slug);
  const now = new Date();

  await Tenant.findByIdAndUpdate(tenantId, {
    $set: {
      "settings.activeTheme": theme.slug,
      "themeCustomization.themeId": theme._id,
      "themeCustomization.isDraft": false,
      "themeCustomization.settings": settings,
      "themeCustomization.sections": sections,
      "themeCustomization.customCSS": "",
      "themeCustomization.published.themeSlug": theme.slug,
      "themeCustomization.published.settings": settings,
      "themeCustomization.published.sections": sections,
      "themeCustomization.published.customCSS": "",
      "themeCustomization.published.publishedAt": now,
      "themeCustomization.lastPublishedAt": now,
      "themeCustomization.updatedAt": now,
      // Switching themes nukes any outstanding preview — the old draft
      // was bound to a different section schema and the token would
      // either 404 or render garbage against the new theme's manifest.
      "themeCustomization.previewToken": null,
      "themeCustomization.previewTokenExpiry": null,
    },
    $inc: { "themeCustomization.published.version": 1 },
  });

  await incrementThemeInstallsRepo(themeId);

  // NOTE: activating a theme intentionally does NOT seed demo data. The
  // merchant's real products / categories / collections must be preserved
  // verbatim so they can switch themes to see their OWN store re-skinned.
  // Demo content is shown only in the theme PREVIEW (see the preview flow),
  // never persisted into the live store.

  // Audit: record the install/switch event so the dashboard timeline
  // shows when a tenant adopted a theme, and the snapshot matches
  // the first state the storefront rendered under this theme. The
  // event is recorded as "install" for the first install or
  // "theme_switch" when there was a previous theme installed.
  await recordThemeAuditEvent(tenantId, previousThemeId ? "theme_switch" : "install", {
    themeSlug: theme.slug,
    settings: {
      colors: settings.colors || {},
      typography: settings.typography || {},
      layout: settings.layout || {},
    },
    sections,
    customCSS: "",
    label: previousThemeId ? `Switched to ${theme.name}` : `Installed ${theme.name}`,
  });

  return theme;
};

export const uninstallThemeService = async (themeId, tenantId) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);

  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId).select("themeCustomization");
  if (!tenant) throw new APIError("Tenant not found", 404);

  // Guard: only clear the tenant's active theme if the uninstall request
  // is for the theme they actually have installed. Without this check,
  // calling /uninstall with an arbitrary theme id would wipe the live
  // storefront for any tenant regardless of which theme is running —
  // a silent way to take a store down with a single wrong API call.
  const installedThemeId = tenant.themeCustomization?.themeId?.toString();
  if (!installedThemeId || installedThemeId !== themeId.toString()) {
    throw new APIError(
      "Cannot uninstall: theme is not the tenant's currently installed theme",
      400
    );
  }

  await Tenant.findByIdAndUpdate(tenantId, {
    $set: {
      "settings.activeTheme": null,
      "themeCustomization.themeId": null,
      "themeCustomization.settings": { colors: {}, typography: {}, layout: {} },
      "themeCustomization.sections": [],
      "themeCustomization.customCSS": "",
      "themeCustomization.published.themeSlug": null,
      "themeCustomization.published.settings": { colors: {}, typography: {}, layout: {} },
      "themeCustomization.published.sections": [],
      "themeCustomization.published.customCSS": "",
      "themeCustomization.published.publishedAt": null,
      "themeCustomization.updatedAt": new Date(),
      "themeCustomization.previewToken": null,
      "themeCustomization.previewTokenExpiry": null,
    },
  });

  await decrementThemeInstallsRepo(themeId);

  // Audit: record the uninstall as a distinct event so the timeline
  // shows the storefront was taken offline until a new theme is
  // installed. The snapshot is intentionally empty.
  await recordThemeAuditEvent(tenantId, "uninstall", {
    themeSlug: theme.slug,
    settings: { colors: {}, typography: {}, layout: {} },
    sections: [],
    customCSS: "",
    label: `Uninstalled ${theme.name}`,
  });

  return theme;
};

export const searchThemesService = async (searchQuery, options = {}) => {
  if (!searchQuery?.trim()) throw new APIError("Search query is required", 400);
  return await searchThemesRepo(searchQuery, options);
};

export const getThemesByCategoryService = async (category, options = {}) => getThemesByCategoryRepo(category, options);
export const getPopularThemesService = async (limit = 10) => getPopularThemesRepo(limit);
export const getLatestThemesService = async (limit = 10) => getLatestThemesRepo(limit);

export const getThemePublicConfigService = async (themeId) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  return theme.getPublicConfig ? theme.getPublicConfig() : theme;
};

/**
 * Minimal bootstrap payload so a stood-up environment with an empty
 * Themes collection can still complete tenant setup instead of failing
 * on "No default theme available". Matches the shape `scripts/seed-themes.js`
 * produces for `modern` (the canonical default) so the first registered
 * tenant lands on the same baseline as a properly seeded instance.
 *
 * This is intentionally a last-resort — ops should run `node scripts/seed-themes.js`
 * at deploy time. But in environments where that hasn't run yet (fresh
 * staging, CI databases, integration tests) the backstop below guarantees
 * `setupStatus.steps.theme_installation` reaches `completed` instead of
 * `skipped` with an error that blocks the merchant flow.
 */
const FALLBACK_DEFAULT_THEME = {
  name: "Modern",
  slug: "modern",
  version: "1.0.0",
  description: "Default theme bootstrapped automatically.",
  author: { name: "Matjar", email: "themes@matjar.io", website: "" },
  status: "active",
  isDefault: true,
  isPublished: true,
  storagePath: "storefront-themes/modern",
  categories: ["general"],
  tags: ["minimal", "clean", "modern", "responsive"],
  features: ["responsive-design", "ajax-cart", "live-search"],
  settings: {
    colors: { primary: "#2563eb", secondary: "#1e40af", accent: "#f59e0b", background: "#f9fafb", text: "#111827" },
    typography: { fontFamily: "'Inter', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Inter', sans-serif" },
  },
};

async function ensureDefaultThemeExists() {
  try {
    const existing = await getDefaultThemeRepo();
    if (existing) return existing;
  } catch {
    // Model may throw if `getDefault()` is unimplemented in a new deploy
    // — fall through to the active-themes cascade below.
  }
  const active = await getActiveThemesRepo({});
  if (active?.length) return active[0];
  // Truly empty — bootstrap.
  logger.warn("Theme catalog is empty, bootstrapping fallback default", { slug: FALLBACK_DEFAULT_THEME.slug });
  try {
    return await createThemeRepo(FALLBACK_DEFAULT_THEME);
  } catch (err) {
    // A race with another bootstrap (parallel registrations on a cold
    // deploy) — the other process won; re-read and return whatever landed.
    if (err?.code === 11000) {
      const raced = await getThemeBySlugRepo(FALLBACK_DEFAULT_THEME.slug);
      if (raced) return raced;
    }
    throw err;
  }
}

/**
 * Install default theme for a new tenant
 */
export async function installDefaultTheme(tenant) {
  try {
    // Honor the theme the merchant picked during onboarding (stored at
    // registration in `settings.activeTheme`). Falls back to the platform
    // default only when no pick was made or the chosen slug is missing.
    const requestedSlug = tenant?.settings?.activeTheme;
    let defaultTheme = null;
    if (requestedSlug) {
      try {
        defaultTheme = await getThemeBySlugRepo(requestedSlug);
        if (defaultTheme && defaultTheme.status !== "active") defaultTheme = null;
      } catch {
        defaultTheme = null;
      }
    }
    if (!defaultTheme) defaultTheme = await ensureDefaultThemeExists();

    if (!defaultTheme) {
      return { success: false, error: "No default theme available" };
    }

    const Tenant = mongoose.model("Tenant");
    const { sections, settings } = buildCustomizationFromManifest(defaultTheme.slug);
    const now = new Date();

    await Tenant.findByIdAndUpdate(tenant._id, {
      $set: {
        "settings.activeTheme": defaultTheme.slug,
        "themeCustomization.themeId": defaultTheme._id,
        "themeCustomization.isDraft": false,
        "themeCustomization.settings": settings,
        "themeCustomization.sections": sections,
        "themeCustomization.customCSS": "",
        "themeCustomization.published.themeSlug": defaultTheme.slug,
        "themeCustomization.published.settings": settings,
        "themeCustomization.published.sections": sections,
        "themeCustomization.published.customCSS": "",
        "themeCustomization.published.publishedAt": now,
        "themeCustomization.lastPublishedAt": now,
        "themeCustomization.updatedAt": now,
      },
      $inc: { "themeCustomization.published.version": 1 },
    });

    await incrementThemeInstallsRepo(defaultTheme._id);

    // Demo data is NOT seeded on install — it belongs to the theme preview
    // only (see preview flow). A new store stays clean; the merchant adds
    // their own products, or previews themes to see them populated.

    // Audit: fresh tenants get an "install" row so the version
    // timeline has a starting point even before the merchant makes
    // their first publish.
    await recordThemeAuditEvent(tenant._id, "install", {
      themeSlug: defaultTheme.slug,
      settings: {
        colors: settings.colors || {},
        typography: settings.typography || {},
        layout: settings.layout || {},
      },
      sections,
      customCSS: "",
      label: `Installed default theme ${defaultTheme.name}`,
    });

    return { success: true, theme: defaultTheme };
  } catch (error) {
    logger.error("Failed to install default theme", { error: error.message });
    return { success: false, error: error.message };
  }
}
