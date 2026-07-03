/**
 * Theme catalog sync (audit item 2.4)
 * ───────────────────────────────────
 *
 * Single-sources catalog metadata from theme manifests. The hand-written
 * array that used to live in `scripts/seed-themes.js` duplicated
 * name/description/colors/author from every theme's manifest and drifted
 * constantly; this service replaces it by converging the `themes`
 * collection onto whatever the manifest registry discovered on disk
 * (`storefront-themes/<slug>/dist/manifest.json`).
 *
 * Runs:
 *   - at boot (index.js, right after connectDb registers models — the
 *     registry itself loads at module init), and
 *   - on demand (`scripts/seed-themes.js` is now a thin trigger; a future
 *     manifest-reload endpoint can call `syncThemeCatalog()` too).
 *
 * Ownership rules per field:
 *   - MANIFEST-OWNED (overwritten on every sync): name, version,
 *     description, author, tags, categories, previewImage, thumbnail,
 *     screenshots, compatibility.minPlatformVersion, storagePath.
 *   - DB-OWNED (preserved on update, only defaulted on first insert):
 *     statistics, pricing, status, isDefault, isPublished.
 *
 * Disappearance: rows whose manifest is no longer on disk are flipped to
 * status "inactive" with a `catalogSync.missingSince` stamp. If the
 * manifest reappears, the sync re-activates ONLY rows carrying that stamp
 * — an operator's manual deactivation (no stamp) is never overridden.
 *
 * Preview images: themes ship `public/preview.jpg` → `dist/preview.jpg`
 * and (newer builds) declare `previewImage: "/preview.jpg"` in the
 * manifest. Relative in-dist paths are rewritten to the API route that
 * actually serves the file (`GET /api/themes/:slug/preview`); absolute
 * URLs pass through untouched. When the manifest doesn't declare one yet
 * but the screenshot exists in dist, we still persist the API URL so the
 * dashboard gets real screenshots either way.
 */

import logger from "../utils/logger.js";
import { getTenantsRepo } from "../repositories/tenant.js";
import {
  getBuiltInThemeSlugs,
  getThemeManifest,
} from "./themeManifestRegistry.js";
import { getThemePreviewImagePathService } from "./theme.js";
import {
  upsertThemeBySlugRepo,
  reactivateSyncedThemeRepo,
  markMissingThemesInactiveRepo,
  countDefaultThemesRepo,
  setThemeDefaultBySlugRepo,
} from "../repositories/theme.js";

/**
 * The slug promoted to platform default when no active default exists
 * (fresh database, or the previous default's manifest disappeared).
 */
const PREFERRED_DEFAULT_SLUG = "modern";

/**
 * Resolve a manifest-declared image reference to a URL the dashboard can
 * actually load. In-dist relative paths ("/preview.jpg", "preview.jpg")
 * become the API preview route; absolute http(s) URLs pass through.
 */
function resolveManifestImage(slug, ref) {
  if (typeof ref !== "string" || ref.trim().length === 0) return null;
  const value = ref.trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `/api/themes/${slug}/preview`;
}

/**
 * Build the manifest-owned `$set` payload for one theme row.
 */
function buildManifestFields(slug, manifest, now) {
  const set = {
    name: manifest.name || slug,
    version: manifest.version || "1.0.0",
    description: manifest.description || "",
    author: {
      name: manifest.author?.name || "",
      email: manifest.author?.email || "",
      website: manifest.author?.website || "",
    },
    tags: Array.isArray(manifest.tags) ? manifest.tags : [],
    categories: Array.isArray(manifest.categories) ? manifest.categories : [],
    storageType: "local",
    storagePath: `storefront-themes/${slug}`,
    "catalogSync.lastSyncedAt": now,
  };

  // Presentation — previewImage from the manifest when declared, else
  // from the built screenshot on disk (both resolve to the API route).
  const declaredPreview = resolveManifestImage(slug, manifest.previewImage);
  const distPreview = getThemePreviewImagePathService(slug)
    ? `/api/themes/${slug}/preview`
    : null;
  const previewImage = declaredPreview || distPreview;
  if (previewImage) set.previewImage = previewImage;

  const thumbnail = resolveManifestImage(slug, manifest.thumbnail);
  if (thumbnail) set.thumbnail = thumbnail;

  if (Array.isArray(manifest.screenshots)) {
    set.screenshots = manifest.screenshots
      .map((s) => resolveManifestImage(slug, s))
      .filter(Boolean)
      .map((url) => ({ url }));
  }

  if (typeof manifest.minPlatformVersion === "string" && manifest.minPlatformVersion) {
    set["compatibility.minPlatformVersion"] = manifest.minPlatformVersion;
  }

  return set;
}

/**
 * DB-owned defaults applied only when the row is first created.
 * (`statistics`/`pricing` sub-fields also have schema defaults; setting
 * them explicitly here keeps upserted documents complete even through
 * the raw-driver reads migrations and scripts perform.)
 */
function buildInsertDefaults() {
  return {
    status: "active",
    isDefault: false,
    isPublished: true,
    statistics: {
      installCount: 0,
      activeInstalls: 0,
      rating: 0,
      reviewCount: 0,
      downloads: 0,
    },
    pricing: {
      isFree: true,
      price: 0,
      currency: "SDG",
      licenseType: "unlimited",
    },
  };
}

/**
 * Audit tenants' active themes against the loaded manifest registry and
 * log LOUDLY for any tenant whose active theme has no manifest on disk
 * (audit 1.6c). This is the "unbuilt active theme" case the storefront
 * silently degrades from at request time (middlewares/storefrontServe.js
 * falls back to the default theme) — here we surface it once, at boot and
 * after every reload, so operators notice a missing bundle instead of only
 * seeing merchants mysteriously render the default theme.
 *
 * Best-effort: a failure here must never block boot or the reload endpoint.
 *
 * @returns {Promise<{missing: number}>}
 */
export async function auditTenantThemeManifests() {
  try {
    const loaded = new Set(getBuiltInThemeSlugs());
    // Only tenants that have explicitly picked an active theme.
    const tenants = await getTenantsRepo(
      { name: 1, domain: 1, "settings.activeTheme": 1 },
      { "settings.activeTheme": { $nin: [null, ""] } }
    );

    let missing = 0;
    for (const tenant of tenants) {
      const slug = tenant?.settings?.activeTheme;
      if (slug && !loaded.has(slug)) {
        missing += 1;
        logger.error(
          `[themeCatalogSync] tenant active theme "${slug}" has NO manifest on disk — ` +
            `storefront will fall back to the default theme`,
          {
            tenantId: tenant?._id?.toString?.(),
            domain: tenant?.domain,
            themeSlug: slug,
          }
        );
      }
    }

    if (missing === 0) {
      logger.info("[themeCatalogSync] tenant active-theme audit clean");
    } else {
      logger.error(
        `[themeCatalogSync] ${missing} tenant(s) reference an unbuilt/missing theme manifest`
      );
    }
    return { missing };
  } catch (err) {
    logger.warn("[themeCatalogSync] tenant theme audit failed", {
      error: err.message,
    });
    return { missing: 0 };
  }
}

/**
 * Converge the theme catalog onto the manifests currently loaded in the
 * registry. Idempotent — re-running against an unchanged registry only
 * refreshes `catalogSync.lastSyncedAt`.
 *
 * @returns {Promise<{synced: string[], deactivated: number}>}
 */
export async function syncThemeCatalog() {
  const now = new Date();
  const slugs = getBuiltInThemeSlugs();
  const synced = [];

  for (const slug of slugs) {
    const manifest = getThemeManifest(slug);
    if (!manifest) continue;
    try {
      await upsertThemeBySlugRepo(slug, {
        set: buildManifestFields(slug, manifest, now),
        setOnInsert: buildInsertDefaults(),
      });
      // Un-hide rows this sync previously deactivated because their
      // manifest had gone missing (e.g. a theme deleted then rebuilt).
      await reactivateSyncedThemeRepo(slug);
      synced.push(slug);
    } catch (err) {
      // One broken theme must not block the rest of the catalog.
      logger.error(`[themeCatalogSync] failed to sync "${slug}"`, {
        error: err.message,
      });
    }
  }

  // Rows whose manifest disappeared → inactive (stamped so a future
  // reappearance can auto-reactivate them).
  let deactivated = 0;
  if (synced.length > 0) {
    const res = await markMissingThemesInactiveRepo(synced, now);
    deactivated = res?.modifiedCount || 0;
  }

  // Guarantee a usable default for tenant onboarding: if no active
  // default exists (fresh DB, or the default's manifest vanished),
  // promote "modern" — falling back to the first synced theme.
  try {
    const defaults = await countDefaultThemesRepo();
    if (defaults === 0 && synced.length > 0) {
      const candidate = synced.includes(PREFERRED_DEFAULT_SLUG)
        ? PREFERRED_DEFAULT_SLUG
        : synced[0];
      await setThemeDefaultBySlugRepo(candidate);
      logger.info(`[themeCatalogSync] promoted "${candidate}" to default theme`);
    }
  } catch (err) {
    logger.warn("[themeCatalogSync] failed to ensure a default theme", {
      error: err.message,
    });
  }

  logger.info(
    `[themeCatalogSync] synced ${synced.length} theme(s)` +
      (deactivated ? `, deactivated ${deactivated} missing` : "")
  );

  return { synced, deactivated };
}
