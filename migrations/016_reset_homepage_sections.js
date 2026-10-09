/**
 * 016_reset_homepage_sections
 *
 * PBI 10: every theme's homepage is now the hero, new arrivals and featured
 * products, with one top strip on every page (the layout bar, theme setting
 * `announcement_text`). The user chose to reset existing stores too.
 *
 * For every tenant with a theme customization, each stored homepage list
 * (draft and published, the legacy flat copies, and the per-theme snapshots
 * kept for theme switching) is rebuilt from that theme's new
 * `templates.index` with utils/homepageReset.js: sections the store keeps
 * carry the merchant's settings over; other sections leave the homepage but
 * remain available in the advanced editor.
 *
 * Text from a retired theme top-strip section (beauxe, glowing, milmaa,
 * nutreko) moves into the theme-level `announcement_text` when the store
 * hasn't set one, so the strip keeps saying what the merchant wrote.
 *
 * Needs the built theme manifests (dist/manifest.json), which the Render
 * build step produces before preDeploy runs migrations. A theme whose
 * manifest can't be loaded is skipped and logged, never emptied.
 *
 * Theme-level settings a theme stopped declaring in the same change
 * (techhub `home_variant`, linen `announcement_text_2/_3`, atelier's strip
 * rotation) are removed from the saved draft and published buckets: the
 * customization validator rejects unknown keys, which would block the
 * merchant's next publish.
 *
 * Idempotent: a list already in the new shape is left alone, so a re-run
 * writes nothing. down() is a no-op: the old lists are not kept.
 */
import { getThemeManifest } from "../services/themeManifestRegistry.js";
import { resetHomepageList, sameHomepageShape, stripTextFrom, undeclaredThemeKeys } from "../utils/homepageReset.js";

export const description = "Reset store homepages to hero, new arrivals and featured products (PBI 10)";

const has = (v) => typeof v === "string" && v.trim() !== "";

export async function up(db, { logger, session } = {}) {
  const sessionOpt = session ? { session } : undefined;
  const indexCache = new Map();
  const globalsCache = new Map();
  const globalsOf = (slug) => {
    if (!globalsCache.has(slug)) {
      const manifest = getThemeManifest(slug);
      globalsCache.set(slug, manifest ? manifest.settings || [] : null);
    }
    return globalsCache.get(slug);
  };
  const indexOf = (slug) => {
    if (!indexCache.has(slug)) {
      const index = getThemeManifest(slug)?.templates?.index;
      indexCache.set(slug, Array.isArray(index) && index.length ? index : null);
    }
    return indexCache.get(slug);
  };

  const cursor = db.collection("tenants").find(
    { themeCustomization: { $exists: true } },
    { projection: { themeCustomization: 1, "settings.activeTheme": 1 }, ...(sessionOpt || {}) }
  );

  let scanned = 0;
  let updated = 0;
  const skipped = new Set();

  while (await cursor.hasNext()) {
    const tenant = await cursor.next();
    scanned += 1;
    const tc = tenant.themeCustomization || {};
    const set = {};

    const resetAt = (path, list, slug) => {
      const index = indexOf(slug);
      if (!index) {
        skipped.add(slug);
        return;
      }
      if (!Array.isArray(list)) return;
      const next = resetHomepageList(list, index);
      if (!sameHomepageShape(list, next)) set[path] = next;
    };

    const draftSlug = tenant.settings?.activeTheme || tc.themeSlug || "modern";
    const draftList = tc.sectionsByTemplate?.index;
    resetAt("themeCustomization.sectionsByTemplate.index", draftList, draftSlug);
    if (Array.isArray(tc.sections) && tc.sections.length) {
      resetAt("themeCustomization.sections", tc.sections, draftSlug);
    }

    const pub = tc.published || {};
    const pubSlug = pub.themeSlug || draftSlug;
    resetAt("themeCustomization.published.sectionsByTemplate.index", pub.sectionsByTemplate?.index, pubSlug);
    if (Array.isArray(pub.sections) && pub.sections.length) {
      resetAt("themeCustomization.published.sections", pub.sections, pubSlug);
    }

    for (const [slug, snap] of Object.entries(tc.savedByTheme || {})) {
      if (!snap || typeof snap !== "object") continue;
      resetAt(`themeCustomization.savedByTheme.${slug}.draft.sectionsByTemplate.index`, snap.draft?.sectionsByTemplate?.index, slug);
      resetAt(`themeCustomization.savedByTheme.${slug}.published.sectionsByTemplate.index`, snap.published?.sectionsByTemplate?.index, slug);
    }

    // Carry a retired strip section's text into the layout strip.
    const carryStrip = (bucketPath, settings, list) => {
      const text = stripTextFrom(list);
      const current = { ...(settings || {}), ...(settings?.theme || {}) };
      if (!text || has(current.announcement_text) || has(current.announcement_text__ar)) return;
      for (const [key, value] of Object.entries(text)) set[`${bucketPath}.${key}`] = value;
    };
    carryStrip("themeCustomization.settings.theme", tc.settings, draftList);
    carryStrip("themeCustomization.published.settings.theme", pub.settings, pub.sectionsByTemplate?.index);

    // Drop theme-level keys the theme no longer declares.
    const unset = {};
    const dropUndeclared = (bucketPath, bucket, slug) => {
      const defs = globalsOf(slug);
      if (!defs) return;
      for (const key of undeclaredThemeKeys(bucket, defs)) unset[`${bucketPath}.${key}`] = "";
    };
    dropUndeclared("themeCustomization.settings.theme", tc.settings?.theme, draftSlug);
    dropUndeclared("themeCustomization.published.settings.theme", pub.settings?.theme, pubSlug);

    if (Object.keys(set).length || Object.keys(unset).length) {
      const update = {};
      if (Object.keys(set).length) update.$set = set;
      if (Object.keys(unset).length) update.$unset = unset;
      await db.collection("tenants").updateOne({ _id: tenant._id }, update, sessionOpt);
      updated += 1;
    }
  }

  if (skipped.size) logger?.warn?.(`migrate 016: no manifest for ${[...skipped].join(", ")} — those lists were left alone`);
  logger?.info?.(`migrate 016: done — scanned=${scanned} updated=${updated}`);
}

export async function down(db, { logger } = {}) {
  logger?.info?.("migrate 016 down: no-op — previous homepage lists are not kept");
}
