/**
 * Theme Manifest Registry
 * ───────────────────────
 *
 * Loads each storefront theme's authored manifest from its build-time
 * artifact at `storefront-themes/<slug>/dist/manifest.json`. The artifact
 * is emitted by the shared Vite plugin at
 * `storefront-themes/_shared/build/emitManifest.mjs`, which serializes
 * the theme's `src/theme.manifest.ts` into JSON during `vite build`.
 *
 * Why an artifact instead of a hand-maintained backend copy:
 *
 *   - Single source of truth. The authored TS file is the only place a
 *     theme's sections, settings, and templates are declared. The
 *     backend, dashboard editor, publish validation, and storefront
 *     renderer all consume the same bytes.
 *   - Third-party themes just drop a built `dist/` folder with a
 *     manifest — the registry picks them up automatically.
 *   - Publish-time validation is guaranteed consistent with what the
 *     storefront renders, because both read from the same manifest.
 *
 * Loading strategy:
 *
 *   - At module init, scan `storefront-themes/*\/dist/manifest.json`
 *     synchronously. Keep the parsed manifests in an in-memory map.
 *   - In development (`NODE_ENV !== 'production'`), a file watcher
 *     reloads any manifest that changes on disk, so developers can
 *     rebuild a theme and see the registry update without restarting
 *     the node process.
 *   - Missing artifacts are logged and skipped; the server still boots
 *     even if no themes are built yet.
 *
 * Public API (unchanged from the previous hand-coded version):
 *
 *   - `getThemeManifest(slug)`
 *   - `getAllThemeManifests()`
 *   - `getThemeSections(slug)`
 *   - `getThemeSettingsSchema(slug)`
 *   - `getBuiltInThemeSlugs()`
 *   - `reloadThemeManifest(slug)` — force a reload of a single theme
 *   - `reloadAllManifests()` — force a full rescan
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import logger from "../utils/logger.js";
import config from "../config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THEMES_ROOT = path.resolve(__dirname, "..", "storefront-themes");
const MANIFEST_FILENAME = "manifest.json";
const MANIFEST_REL_PATH = path.join("dist", MANIFEST_FILENAME);

/** @type {Map<string, object>} */
const MANIFESTS = new Map();

/**
 * Discover candidate theme directories by listing the storefront-themes
 * folder. Anything starting with an underscore (e.g. `_shared`) is
 * excluded — those are runtime packages, not themes.
 */
function listThemeDirs() {
  if (!fs.existsSync(THEMES_ROOT)) return [];
  return fs
    .readdirSync(THEMES_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => e.name);
}

function manifestPathFor(slug) {
  return path.join(THEMES_ROOT, slug, MANIFEST_REL_PATH);
}

/**
 * Load one theme manifest from disk. Returns the parsed manifest on
 * success, or null on failure (missing file, invalid JSON, missing slug).
 * Errors are logged but not thrown — a single broken theme must not
 * take down the server.
 */
function loadManifestFromDisk(slug) {
  const filePath = manifestPathFor(slug);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const manifest = JSON.parse(raw);
    if (!manifest || typeof manifest !== "object") {
      logger.warn(`[themeManifestRegistry] ${slug}: manifest is not an object`);
      return null;
    }
    if (manifest.slug !== slug) {
      logger.warn(
        `[themeManifestRegistry] ${slug}: manifest.slug="${manifest.slug}" does not match directory name`
      );
    }
    return manifest;
  } catch (err) {
    logger.error(`[themeManifestRegistry] failed to load ${slug}`, {
      error: err.message,
      path: filePath,
    });
    return null;
  }
}

/**
 * Rescan the filesystem and rebuild the in-memory manifest map from
 * scratch. Themes present in the map but no longer on disk are
 * evicted.
 */
export function reloadAllManifests() {
  const dirs = listThemeDirs();
  const seen = new Set();

  for (const slug of dirs) {
    const manifest = loadManifestFromDisk(slug);
    if (manifest) {
      MANIFESTS.set(slug, manifest);
      seen.add(slug);
    }
  }

  // Evict manifests whose directory or artifact was removed.
  for (const slug of Array.from(MANIFESTS.keys())) {
    if (!seen.has(slug)) MANIFESTS.delete(slug);
  }

  logger.info(
    `[themeManifestRegistry] loaded ${MANIFESTS.size} theme manifest(s): ${Array.from(
      MANIFESTS.keys()
    ).join(", ")}`
  );

  return MANIFESTS.size;
}

/**
 * Reload a single theme's manifest. Used by the dev file watcher and
 * by administrative endpoints that trigger a refresh after installing
 * a third-party theme.
 */
export function reloadThemeManifest(slug) {
  const manifest = loadManifestFromDisk(slug);
  if (manifest) {
    MANIFESTS.set(slug, manifest);
    return manifest;
  }
  MANIFESTS.delete(slug);
  return null;
}

// ─── Dev-mode file watcher ───────────────────────────────────────
//
// In development we watch each theme's `dist/manifest.json` so that
// rebuilding a theme automatically refreshes the in-memory registry.
// Production servers don't watch — they load once at startup and
// expect operators to restart on theme deploys.

function startDevWatcher() {
  if (config.isProduction) return;
  if (!fs.existsSync(THEMES_ROOT)) return;

  for (const slug of listThemeDirs()) {
    const distDir = path.join(THEMES_ROOT, slug, "dist");
    if (!fs.existsSync(distDir)) continue;

    try {
      // Watch the dist directory; fire reload when manifest.json appears
      // or changes. `fs.watch` is cheap and does not hold the directory
      // open on macOS/Linux.
      fs.watch(distDir, { persistent: false }, (_eventType, filename) => {
        if (filename === MANIFEST_FILENAME) {
          // Debounce by eating repeated events in the same tick.
          queueMicrotask(() => {
            const prev = MANIFESTS.get(slug);
            const next = reloadThemeManifest(slug);
            if (!prev || !next || prev.version !== next.version) {
              logger.info(
                `[themeManifestRegistry] hot-reloaded ${slug}${
                  next ? ` v${next.version}` : " (removed)"
                }`
              );
            }
          });
        }
      });
    } catch (err) {
      // Watcher failures are non-fatal — the registry still serves the
      // last-loaded manifest until the next explicit reload.
      logger.warn(`[themeManifestRegistry] watcher for ${slug} failed`, {
        error: err.message,
      });
    }
  }
}

// ─── Initial load ────────────────────────────────────────────────

reloadAllManifests();
startDevWatcher();

// ─── Public API ──────────────────────────────────────────────────

/**
 * Get the full manifest for a theme by slug.
 *
 * The returned object is a deep-cloned copy so callers can safely
 * mutate it (e.g. to overlay tenant settings) without corrupting the
 * cached manifest.
 */
export function getThemeManifest(themeSlug) {
  const m = MANIFESTS.get(themeSlug);
  if (!m) return null;
  return structuredClone(m);
}

/**
 * Get a lightweight summary of every loaded theme manifest, suitable
 * for the dashboard's theme-picker grid. Excludes heavy fields
 * (sections, templates, settings) — call `getThemeManifest(slug)` for
 * those.
 */
export function getAllThemeManifests() {
  return Array.from(MANIFESTS.values()).map((m) => ({
    slug: m.slug,
    name: m.name,
    version: m.version,
    description: m.description,
    author: m.author,
    categories: m.categories,
    colors: m.colors,
    typography: m.typography,
  }));
}

/**
 * Get the section definitions for a theme — the catalog of section
 * types the editor can offer, including universal sections merged in
 * at build time by `defineTheme()` on the frontend.
 */
export function getThemeSections(themeSlug) {
  const manifest = MANIFESTS.get(themeSlug);
  if (!manifest) return [];
  return structuredClone(manifest.sections || []);
}

/**
 * Get the full settings schema for a theme. Used by the dashboard
 * editor to render global + section + template controls.
 */
export function getThemeSettingsSchema(themeSlug) {
  const manifest = MANIFESTS.get(themeSlug);
  if (!manifest) return null;
  return {
    name: manifest.name,
    global: manifest.settings || [],
    colors: manifest.colors,
    // Unique human labels per colour token (filled by defineTheme at
    // build time). The editor renders these with a humanized-key fallback.
    colorLabels: manifest.colorLabels || {},
    typography: manifest.typography,
    layout: manifest.layout,
    // Theme-shipped font choices, merged ahead of the platform font
    // list by the dashboard typography selects.
    fonts: structuredClone(manifest.fonts || []),
    sections: structuredClone(manifest.sections || []),
    templates: structuredClone(manifest.templates || {}),
  };
}

/**
 * List of all loaded theme slugs. "Built-in" is a legacy name — the
 * registry actually loads *any* theme with a valid manifest artifact,
 * built-in or third-party.
 */
export function getBuiltInThemeSlugs() {
  return Array.from(MANIFESTS.keys());
}
