/**
 * 007_retire_theme_settings_features
 *
 * Audit item 1.2 — retire the legacy `Theme.settings` blob and `features`
 * enum from the theme catalog collection. Both predate the manifest system:
 * a theme's colors/typography/settings schema and feature list now live in
 * its built manifest (`storefront-themes/<slug>/dist/manifest.json`, loaded
 * by services/themeManifestRegistry.js) and are synced into catalog rows by
 * services/themeCatalogSync.js. Nothing in the storefront, editor, or
 * dashboard reads these fields any more.
 *
 * `Theme` is an admin-scope model on the shared database (see
 * utils/scopedModel.js ADMIN_MODELS) — one global `themes` collection, no
 * per-tenant iteration required.
 *
 * Idempotent: $unset on an absent field is a no-op; re-running matches
 * zero documents needing changes.
 *
 * Reversible: down() is a no-op. The removed values were static seed data
 * duplicated from theme manifests — the manifests remain the source of
 * truth and the catalog sync repopulates everything a row needs on boot.
 */

export const description =
  "Remove legacy settings blob and features array from theme catalog rows";

export async function up(db, { logger, session } = {}) {
  const sessionOpt = session ? { session } : undefined;

  const result = await db.collection("themes").updateMany(
    {
      $or: [{ settings: { $exists: true } }, { features: { $exists: true } }],
    },
    { $unset: { settings: "", features: "" } },
    sessionOpt
  );

  logger?.info?.(
    `migrate 007: done — matched=${result.matchedCount} modified=${result.modifiedCount}`
  );
}

export async function down(db, { logger } = {}) {
  // Intentional no-op: the removed fields were denormalized copies of
  // manifest data; the manifest registry + catalog sync own that data now.
  logger?.info?.(
    "migrate 007 down: no-op — manifest registry is the source of truth"
  );
}
