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
import { getAllowedThemeSlugs } from "./featureFlags.js";

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
 * stale published sections from the previous theme would hang around and
 * produce unknown section IDs in the new theme's registry).
 *
 * Seeds `sectionsByTemplate` for EVERY template the manifest declares
 * (index, product, collection, cart, search, page, ...) — not just the
 * homepage — so multi-template themes render their curated defaults on
 * all routes immediately after install.
 */
export const buildCustomizationFromManifest = (themeSlug) => {
  const manifest = getThemeManifest(themeSlug);

  const mapTemplateSections = (templateSections) =>
    (Array.isArray(templateSections) ? templateSections : []).map((s, i) => ({
      id: s.id,
      type: s.type,
      enabled: s.disabled !== true,
      order: typeof s.order === "number" ? s.order : i,
      layout: s.layout || "full-width",
      settings: s.settings || {},
      elements: s.elements || [],
      blocks: s.blocks || [],
    }));

  const sectionsByTemplate = {};
  const manifestTemplates =
    manifest?.templates && typeof manifest.templates === "object"
      ? manifest.templates
      : {};
  for (const [templateId, templateSections] of Object.entries(manifestTemplates)) {
    sectionsByTemplate[templateId] = mapTemplateSections(templateSections);
  }
  if (!Array.isArray(sectionsByTemplate.index)) sectionsByTemplate.index = [];

  const settings = {
    colors: manifest?.colors || {},
    typography: manifest?.typography || {},
    layout: {},
    // Manifest-level global settings bucket. Stored empty — the read
    // path (getThemeCustomizationService / storefront) layers each
    // manifest-declared default on top at render time, so persisting
    // them here would only freeze stale copies.
    theme: {},
  };

  return { sectionsByTemplate, settings };
};

export const createThemeService = async (themeData) => {
  const slugExists = await themeSlugExistsRepo(themeData.slug);
  if (slugExists) throw new APIError("Theme with this slug already exists", 400);
  return await createThemeRepo(themeData);
};

// `enforceAllowlist` is opt-in so the shared getters stay usable for
// internal/rendering lookups (e.g. resolving a tenant's current active
// theme) even when that theme isn't in the catalog allowlist. Only the
// public catalog endpoints pass `{ enforceAllowlist: true }`, which 404s
// a disallowed slug so it can't be browsed.
export const getThemeService = async (themeId, { enforceAllowlist = false } = {}) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  if (enforceAllowlist && !(await isSlugAllowed(theme.slug))) {
    throw new APIError("Theme not found", 404);
  }
  return theme;
};

export const getThemeBySlugService = async (slug, { enforceAllowlist = false } = {}) => {
  const theme = await getThemeBySlugRepo(slug);
  if (!theme) throw new APIError("Theme not found", 404);
  if (enforceAllowlist && !(await isSlugAllowed(theme.slug))) {
    throw new APIError("Theme not found", 404);
  }
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
// dashboard renders it via `GET /api/themes/:slug/preview`. The boot
// catalog sync (services/themeCatalogSync.js) persists that URL onto
// Theme rows; the decoration below remains as a safety net for rows
// written before a sync ran (DB value wins when present).

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

// ─── Theme catalog allowlist ─────────────────────────────────────
//
// When the platform's `themes.catalogAll` flag is OFF, only the
// allow-listed slugs (`themes.allowedSlugs`, default modern + starter)
// are offered/installable. `getAllowedThemeSlugs()` returns `null` when
// the full catalog is enabled (unrestricted). Restriction is applied at
// presentation + install time only — the `themes` collection itself is
// never filtered, so flipping the flag ON instantly reveals every theme,
// and tenants already on a non-allowlisted theme keep rendering it
// (storefront serving reads manifests, not this filter).

/** Keep only allow-listed themes; unrestricted (null allowlist) passes through. */
async function filterByAllowlist(themes) {
  const allowed = await getAllowedThemeSlugs();
  if (!allowed) return themes;
  const set = new Set(allowed);
  return (themes || []).filter((t) => t && set.has(t.slug));
}

/** True when a slug is offered under the current allowlist. */
async function isSlugAllowed(slug) {
  const allowed = await getAllowedThemeSlugs();
  return !allowed || allowed.includes(slug);
}

export const getActiveThemesService = async (filters = {}) => {
  const themes = await getActiveThemesRepo(filters);
  const allowed = await filterByAllowlist(themes);
  return allowed.map(withThemePreviewImage);
};

export const getThemesService = async (options = {}) => {
  const result = await getThemesRepo(options);
  // getThemesRepo may return either a bare array or a paginated
  // `{ themes, ... }` envelope — filter the theme list in either shape.
  if (Array.isArray(result)) return await filterByAllowlist(result);
  if (result && Array.isArray(result.themes)) {
    return { ...result, themes: await filterByAllowlist(result.themes) };
  }
  return result;
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
  if (!(await isSlugAllowed(theme.slug))) throw new APIError("Theme not available", 403);

  const Tenant = mongoose.model("Tenant");
  const currentTenant = await Tenant.findById(tenantId);
  if (!currentTenant) throw new APIError("Tenant not found", 404);

  const previousThemeId = currentTenant.themeCustomization?.themeId;
  if (previousThemeId && previousThemeId.toString() === themeId.toString()) return theme;

  if (previousThemeId) await decrementThemeInstallsRepo(previousThemeId);

  const { sectionsByTemplate, settings } = buildCustomizationFromManifest(theme.slug);
  const now = new Date();

  await Tenant.findByIdAndUpdate(tenantId, {
    $set: {
      "settings.activeTheme": theme.slug,
      "themeCustomization.themeId": theme._id,
      "themeCustomization.isDraft": false,
      "themeCustomization.settings": settings,
      "themeCustomization.sectionsByTemplate": sectionsByTemplate,
      "themeCustomization.customCSS": "",
      "themeCustomization.published.themeSlug": theme.slug,
      "themeCustomization.published.settings": settings,
      "themeCustomization.published.sectionsByTemplate": sectionsByTemplate,
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
    // Deprecated flat mirrors — clear residue from the previous theme so
    // nothing stale can surface; no code path writes these any more.
    $unset: {
      "themeCustomization.sections": "",
      "themeCustomization.published.sections": "",
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
      theme: settings.theme || {},
    },
    sectionsByTemplate,
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

  // Reset ALL four settings buckets — including `theme` (manifest-level
  // global settings such as home_variant / color_mode), which was
  // previously left behind and could leak into the next installed theme.
  const emptySettings = { colors: {}, typography: {}, layout: {}, theme: {} };

  await Tenant.findByIdAndUpdate(tenantId, {
    $set: {
      "settings.activeTheme": null,
      "themeCustomization.themeId": null,
      "themeCustomization.settings": emptySettings,
      "themeCustomization.sectionsByTemplate": {},
      "themeCustomization.customCSS": "",
      "themeCustomization.published.themeSlug": null,
      "themeCustomization.published.settings": emptySettings,
      "themeCustomization.published.sectionsByTemplate": {},
      "themeCustomization.published.customCSS": "",
      "themeCustomization.published.publishedAt": null,
      "themeCustomization.updatedAt": new Date(),
      "themeCustomization.previewToken": null,
      "themeCustomization.previewTokenExpiry": null,
    },
    // Deprecated flat mirrors — clear residue; nothing writes them now.
    $unset: {
      "themeCustomization.sections": "",
      "themeCustomization.published.sections": "",
    },
  });

  await decrementThemeInstallsRepo(themeId);

  // Audit: record the uninstall as a distinct event so the timeline
  // shows the storefront was taken offline until a new theme is
  // installed. The snapshot is intentionally empty.
  await recordThemeAuditEvent(tenantId, "uninstall", {
    themeSlug: theme.slug,
    settings: emptySettings,
    sectionsByTemplate: {},
    customCSS: "",
    label: `Uninstalled ${theme.name}`,
  });

  return theme;
};

export const searchThemesService = async (searchQuery, options = {}) => {
  if (!searchQuery?.trim()) throw new APIError("Search query is required", 400);
  return await filterByAllowlist(await searchThemesRepo(searchQuery, options));
};

export const getThemesByCategoryService = async (category, options = {}) =>
  filterByAllowlist(await getThemesByCategoryRepo(category, options));
export const getPopularThemesService = async (limit = 10) =>
  filterByAllowlist(await getPopularThemesRepo(limit));
export const getLatestThemesService = async (limit = 10) =>
  filterByAllowlist(await getLatestThemesRepo(limit));

/**
 * Public theme configuration. The legacy `Theme.settings`/`features`
 * blobs are retired (audit 1.2) — everything a client needs to render
 * or describe a theme now comes from its built manifest, so this reads
 * identity from the catalog row and configuration from the registry.
 */
export const getThemePublicConfigService = async (themeId) => {
  const theme = await getThemeByIdRepo(themeId);
  if (!theme) throw new APIError("Theme not found", 404);
  const manifest = getThemeManifest(theme.slug) || {};
  return {
    name: theme.name,
    slug: theme.slug,
    version: theme.version,
    colors: manifest.colors || {},
    typography: manifest.typography || {},
    layout: manifest.layout || {},
    settings: manifest.settings || [],
  };
};

/**
 * Minimal bootstrap payload so a stood-up environment with an empty
 * Themes collection can still complete tenant setup instead of failing
 * on "No default theme available".
 *
 * This is intentionally a last-resort — the boot-time catalog sync
 * (services/themeCatalogSync.js) normally upserts one row per built
 * theme manifest before the first request. This backstop only fires
 * when NO theme is built at all (fresh clone before
 * `scripts/build-themes.sh`, bare CI databases) and guarantees
 * `setupStatus.steps.theme_installation` reaches `completed` instead of
 * `skipped` with an error that blocks the merchant flow.
 */
const FALLBACK_DEFAULT_THEME = {
  name: "Modern",
  slug: "modern",
  version: "1.0.0",
  description: "Default theme bootstrapped automatically.",
  author: { name: "Matjar", email: "themes@matjar.to", website: "" },
  status: "active",
  isDefault: true,
  isPublished: true,
  storagePath: "storefront-themes/modern",
  categories: ["general"],
  tags: ["minimal", "clean", "modern", "responsive"],
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
    const { sectionsByTemplate, settings } = buildCustomizationFromManifest(defaultTheme.slug);
    const now = new Date();

    await Tenant.findByIdAndUpdate(tenant._id, {
      $set: {
        "settings.activeTheme": defaultTheme.slug,
        "themeCustomization.themeId": defaultTheme._id,
        "themeCustomization.isDraft": false,
        "themeCustomization.settings": settings,
        "themeCustomization.sectionsByTemplate": sectionsByTemplate,
        "themeCustomization.customCSS": "",
        "themeCustomization.published.themeSlug": defaultTheme.slug,
        "themeCustomization.published.settings": settings,
        "themeCustomization.published.sectionsByTemplate": sectionsByTemplate,
        "themeCustomization.published.customCSS": "",
        "themeCustomization.published.publishedAt": now,
        "themeCustomization.lastPublishedAt": now,
        "themeCustomization.updatedAt": now,
      },
      // Deprecated flat mirrors — never written for new tenants.
      $unset: {
        "themeCustomization.sections": "",
        "themeCustomization.published.sections": "",
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
        theme: settings.theme || {},
      },
      sectionsByTemplate,
      customCSS: "",
      label: `Installed default theme ${defaultTheme.name}`,
    });

    return { success: true, theme: defaultTheme };
  } catch (error) {
    logger.error("Failed to install default theme", { error: error.message });
    return { success: false, error: error.message };
  }
}
