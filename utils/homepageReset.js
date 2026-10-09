/**
 * Homepage reset to a theme's default list (PBI 10, "homepage = top strip,
 * hero, new arrivals, featured products"). Pure: no DB, no registry.
 *
 * Used by migrations/016_reset_homepage_sections.js. Each stored homepage
 * list becomes the theme's `templates.index`. A section the merchant
 * already had (same id, else same type) keeps their settings and blocks,
 * on top of the manifest instance's own settings, and is shown. Sections
 * left out stay addable from the advanced editor; they just stop being on
 * the homepage.
 */
import { resolveI18nTwin } from "./themeManifestRules.js";

/** A homepage list rebuilt from the manifest's default instances. */
export function resetHomepageList(oldList, manifestIndex) {
  const previous = Array.isArray(oldList) ? oldList.filter((s) => s && typeof s === "object") : [];
  const used = new Set();
  const take = (predicate) => {
    const found = previous.find((s, i) => !used.has(i) && predicate(s));
    if (found) used.add(previous.indexOf(found));
    return found;
  };
  return (Array.isArray(manifestIndex) ? manifestIndex : []).map((inst, order) => {
    const old = take((s) => s.id === inst.id) || take((s) => s.type === inst.type);
    const oldBlocks = Array.isArray(old?.blocks) && old.blocks.length ? old.blocks : null;
    return {
      id: inst.id,
      type: inst.type,
      enabled: true,
      order,
      layout: old?.layout || inst.layout || "full-width",
      settings: { ...(inst.settings || {}), ...(old?.settings || {}) },
      elements: old?.elements || inst.elements || [],
      blocks: oldBlocks || inst.blocks || [],
    };
  });
}

/** Same ids, types and visibility in the same order (settings aside). */
export function sameHomepageShape(a, b) {
  const shape = (list) =>
    JSON.stringify((Array.isArray(list) ? list : []).map((s) => [s?.id, s?.type, s?.enabled !== false && s?.disabled !== true]));
  return shape(a) === shape(b);
}

// Theme "top strip" sections retired in favour of the layout bar.
const STRIP_SECTION_TYPE = /(^|-)top-(strip|bar)$/;

/**
 * The text of a retired top-strip section in `oldList` (base and Arabic
 * twin), to carry into the theme-level `announcement_text`. Null when there
 * is none or it is empty.
 */
export function stripTextFrom(oldList) {
  const strip = (Array.isArray(oldList) ? oldList : []).find(
    (s) => s && STRIP_SECTION_TYPE.test(String(s.type || "")) && s.enabled !== false && s.disabled !== true
  );
  const text = typeof strip?.settings?.text === "string" ? strip.settings.text.trim() : "";
  const twin = typeof strip?.settings?.text__ar === "string" ? strip.settings.text__ar.trim() : "";
  if (!text && !twin) return null;
  return { announcement_text: text || twin, ...(twin ? { announcement_text__ar: twin } : {}) };
}

/**
 * Keys of a saved theme-level settings bucket that the theme's manifest no
 * longer declares. `<id>__<lang>` twins of declared text settings count as
 * declared (same rule as the customization validator).
 */
export function undeclaredThemeKeys(bucket, globalDefs) {
  if (!bucket || typeof bucket !== "object") return [];
  const defs = new Map((globalDefs || []).map((d) => [d.id, d]));
  return Object.keys(bucket).filter((key) => !defs.has(key) && !resolveI18nTwin(key, defs));
}
