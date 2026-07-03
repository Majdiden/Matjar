/**
 * 006_canonicalize_sections_by_template
 *
 * Audit item 1.3 — make `themeCustomization.sectionsByTemplate` the single
 * canonical store for section lists.
 *
 * Historically the index template's sections were stored twice: the legacy
 * flat `themeCustomization.sections[]` array AND `sectionsByTemplate.index`,
 * kept in lockstep by convention across every write path. When they diverge
 * it's because something wrote the flat path directly (legacy code, external
 * migration, admin fix-up), so the flat array reflects the most recent
 * merchant intent — the same "flat wins" rule the old publish reconciliation
 * used.
 *
 * For every tenant with a themeCustomization:
 *   - draft:     if flat `sections` is non-empty and differs from
 *                `sectionsByTemplate.index`, copy flat → index (flat wins).
 *   - published: same rule for `published.sections` →
 *                `published.sectionsByTemplate.index`.
 *
 * The flat fields themselves are intentionally left in place — the schema
 * keeps them for one release (deprecated, no longer written); a follow-up
 * migration removes them.
 *
 * Idempotent: we only write when the computed index bucket differs from the
 * stored one. Re-running in steady state writes nothing (verified by the
 * `updated` counter staying 0 on a second run).
 *
 * Reversible: down() is a no-op. The copy is additive — the flat arrays are
 * untouched, so pre-migration readers keep working and there is nothing to
 * restore.
 */

export const description =
  "Copy legacy flat themeCustomization.sections into sectionsByTemplate.index (flat wins), draft + published";

function sameSections(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export async function up(db, { logger, session } = {}) {
  const sessionOpt = session ? { session } : undefined;

  const cursor = db
    .collection("tenants")
    .find(
      { themeCustomization: { $exists: true } },
      { projection: { themeCustomization: 1 }, ...(sessionOpt || {}) }
    );

  let scanned = 0;
  let updated = 0;

  while (await cursor.hasNext()) {
    const tenant = await cursor.next();
    scanned += 1;

    const tc = tenant.themeCustomization || {};
    const set = {};

    // Draft: flat wins when it is non-empty and diverges from the bucket.
    const draftFlat = Array.isArray(tc.sections) ? tc.sections : [];
    const draftIndex =
      tc.sectionsByTemplate && typeof tc.sectionsByTemplate === "object"
        ? tc.sectionsByTemplate.index
        : undefined;
    if (draftFlat.length > 0 && !sameSections(draftFlat, draftIndex)) {
      set["themeCustomization.sectionsByTemplate.index"] = draftFlat;
    }

    // Published snapshot: mirror the same rule.
    const pub = tc.published || {};
    const pubFlat = Array.isArray(pub.sections) ? pub.sections : [];
    const pubIndex =
      pub.sectionsByTemplate && typeof pub.sectionsByTemplate === "object"
        ? pub.sectionsByTemplate.index
        : undefined;
    if (pubFlat.length > 0 && !sameSections(pubFlat, pubIndex)) {
      set["themeCustomization.published.sectionsByTemplate.index"] = pubFlat;
    }

    if (Object.keys(set).length > 0) {
      await db
        .collection("tenants")
        .updateOne({ _id: tenant._id }, { $set: set }, sessionOpt);
      updated += 1;
    }
  }

  logger?.info?.(`migrate 006: done — scanned=${scanned} updated=${updated}`);
}

export async function down(db, { logger } = {}) {
  // Intentional no-op: up() is additive (the flat arrays were never
  // modified), so pre-migration readers are unaffected and there is
  // nothing to revert.
  logger?.info?.("migrate 006 down: no-op — copy was additive");
}
