import crypto from "crypto";
import mongoose from "mongoose";
import config from "../config/index.js";
import {
  getTenantCustomizationRepo,
  updateTenantCustomizationSettingsRepo,
  updateTenantThemeSettingRepo,
  updateTenantCustomizationSectionsRepo,
  updateTenantCustomCSSRepo,
  generatePreviewTokenRepo,
  publishCustomizationRepo,
  resetCustomizationRepo,
} from "../repositories/themeCustomization.js";
import { getBuiltInThemeSlugs, getThemeManifest } from "./themeManifestRegistry.js";
import {
  validateCustomization,
  validateGlobalSettings,
  assertValidTemplateId,
  ALLOWED_TEMPLATE_IDS,
} from "./themeValidator.js";
import { validateCustomCSS } from "./cssPolicy.js";
import { sanitizePageHtml } from "../utils/sanitizePageHtml.js";
import { APIError } from "../middlewares/errorHandler.js";

/**
 * Sanitize any `richtext`-typed section settings before they are
 * persisted (audit 6.8.1). This is the customization write-path security
 * boundary: the values are later rendered on the storefront via
 * dangerouslySetInnerHTML, so we run them through the SAME allowlist as
 * CMS pages (6.2 — utils/sanitizePageHtml.js). Non-richtext settings are
 * left untouched; plain-text bodies survive verbatim (plain text is
 * valid HTML), so pre-existing values render unchanged.
 *
 * The set of richtext keys is derived from the active theme's manifest
 * section definition, so it automatically tracks any section type that
 * declares a richtext setting.
 */
function sanitizeSectionRichTextSettings(themeSlug, sectionType, settings) {
  if (!settings || typeof settings !== "object") return settings;
  const manifest = getThemeManifest(themeSlug);
  const def = (manifest?.sections || []).find((s) => s.type === sectionType);
  if (!def) return settings;
  const richKeys = (def.settings || [])
    .filter((s) => s.type === "richtext")
    .map((s) => s.id);
  if (richKeys.length === 0) return settings;
  const out = { ...settings };
  for (const key of richKeys) {
    if (typeof out[key] === "string") out[key] = sanitizePageHtml(out[key]);
  }
  return out;
}

/**
 * Retry budget for concurrent publish attempts. Two merchants clicking
 * publish at the same time is the realistic contention case — one wins
 * on the first insert, the other collides on the unique (tenantId,
 * version) index and retries with max+1. Beyond three retries means
 * something else is wrong (clock skew, replica lag) and we fail loud.
 */
const VERSION_WRITE_MAX_RETRIES = 5;

/**
 * Append a new ThemeCustomizationVersion row with max-plus-one numbering
 * under concurrency. The caller supplies a `basePayload` missing only
 * `version`, `publishedAt`, and `label`. We read the current max, build
 * the label via the supplied resolver (so the auto-diff label sees the
 * prior row, not a stale cached copy), and attempt an insert. On an
 * E11000 duplicate-key error we re-read max and try again.
 *
 * The unique compound index on (tenantId, version) is the primary
 * integrity guarantee — this retry loop is the liveness property on
 * top of it.
 */
async function writeVersionRowWithRetry(VersionModel, basePayload, labelResolver) {
  let lastErr;
  for (let attempt = 0; attempt < VERSION_WRITE_MAX_RETRIES; attempt++) {
    const last = await VersionModel.findOne({}).sort({ version: -1 }).lean();
    const nextVersion = last?.version ? last.version + 1 : 1;
    const label = typeof labelResolver === "function" ? labelResolver(last) : "";
    const doc = {
      ...basePayload,
      version: nextVersion,
      publishedAt: new Date(),
      label,
    };
    try {
      const created = await VersionModel.create(doc);
      return created.toObject ? created.toObject() : { ...doc };
    } catch (err) {
      lastErr = err;
      // Mongo duplicate-key (unique index collision) — retry.
      if (err && (err.code === 11000 || err.code === 11001)) {
        continue;
      }
      throw err;
    }
  }
  throw (
    lastErr ||
    new APIError("Failed to write version row after multiple attempts", 500)
  );
}

/**
 * Compare two customization snapshots and produce a short, human-readable
 * change summary used as the version label when the merchant doesn't
 * provide one. We deliberately keep this terse: a long auto-label clutters
 * the version history list.
 *
 * Examples:
 *   "Added 1 section, removed 2 sections"
 *   "Updated colors, edited 3 sections"
 *   "Restored from version 4"
 */
/**
 * Flatten a snapshot's per-template section map into a single list for
 * diffing. Legacy version rows (pre sectionsByTemplate) only carry the
 * flat `sections` array — fall back to it so labels for rollbacks to
 * old versions stay meaningful.
 */
function collectSnapshotSections(snapshot) {
  const byTpl = snapshot?.sectionsByTemplate;
  if (byTpl && typeof byTpl === "object") {
    const lists = Object.values(byTpl).filter(Array.isArray);
    if (lists.length > 0) return lists.flat();
  }
  return Array.isArray(snapshot?.sections) ? snapshot.sections : [];
}

export function summarizeCustomizationDiff(prev, next) {
  if (!prev) return "Initial publish";

  const prevSections = collectSnapshotSections(prev);
  const nextSections = collectSnapshotSections(next);
  const prevIds = new Set(prevSections.map((s) => s.id));
  const nextIds = new Set(nextSections.map((s) => s.id));

  const added = [...nextIds].filter((id) => !prevIds.has(id));
  const removed = [...prevIds].filter((id) => !nextIds.has(id));

  // For sections present in both, count those whose settings differ.
  let edited = 0;
  for (const s of nextSections) {
    if (!prevIds.has(s.id)) continue;
    const prior = prevSections.find((p) => p.id === s.id);
    if (!prior) continue;
    if (JSON.stringify(prior.settings || {}) !== JSON.stringify(s.settings || {})) {
      edited += 1;
    }
    if ((prior.enabled !== false) !== (s.enabled !== false)) edited += 1;
  }

  const colorsChanged =
    JSON.stringify(prev.settings?.colors || {}) !==
    JSON.stringify(next.settings?.colors || {});
  const typoChanged =
    JSON.stringify(prev.settings?.typography || {}) !==
    JSON.stringify(next.settings?.typography || {});
  const cssChanged = (prev.customCSS || "") !== (next.customCSS || "");

  const parts = [];
  if (added.length) parts.push(`Added ${added.length} section${added.length === 1 ? "" : "s"}`);
  if (removed.length) parts.push(`Removed ${removed.length} section${removed.length === 1 ? "" : "s"}`);
  if (edited) parts.push(`Edited ${edited} section${edited === 1 ? "" : "s"}`);
  if (colorsChanged) parts.push("Updated colors");
  if (typoChanged) parts.push("Updated typography");
  if (cssChanged) parts.push("Updated custom CSS");

  if (parts.length === 0) return "No content changes";
  return parts.join(", ");
}

/**
 * Build default sections from a theme manifest's template + section definitions.
 * Each section gets its default settings from the manifest section definition.
 */
function buildSectionsFromManifestTemplate(manifest, templateId = "index") {
  if (!manifest) return [];

  const templateSections = manifest.templates?.[templateId] || [];
  const sectionDefs = manifest.sections || [];

  return templateSections.map((tmpl, i) => {
    // Find the section definition to extract default settings
    const def = sectionDefs.find((s) => s.type === tmpl.type);
    const defaultSettings = {};
    if (def?.settings) {
      for (const setting of def.settings) {
        if (setting.default !== undefined) {
          defaultSettings[setting.id] = setting.default;
        }
      }
    }

    return {
      id: tmpl.id,
      type: tmpl.type,
      enabled: tmpl.disabled !== true,
      order: i,
      settings: { ...defaultSettings, ...tmpl.settings },
      elements: tmpl.elements || [],
      blocks: tmpl.blocks || [],
    };
  });
}

function buildDefaultSectionsFromManifest(manifest) {
  return buildSectionsFromManifestTemplate(manifest, "index");
}

function cloneSection(section) {
  return JSON.parse(JSON.stringify(section));
}

function mergeSectionsWithManifestDefaults(persistedSections, manifest, templateId = "index") {
  const persisted = Array.isArray(persistedSections) ? persistedSections.map(cloneSection) : [];
  const defaults = buildSectionsFromManifestTemplate(manifest, templateId);
  if (defaults.length === 0) return persisted;
  if (persisted.length === 0) return defaults.map(cloneSection);

  const seen = new Set(persisted.map((s) => s?.id).filter(Boolean));
  const maxOrder = persisted.reduce((max, s, i) => {
    const order = Number.isFinite(Number(s?.order)) ? Number(s.order) : i;
    return Math.max(max, order);
  }, -1);

  let nextOrder = maxOrder + 1;
  for (const section of defaults) {
    if (!section?.id || seen.has(section.id)) continue;
    persisted.push({ ...cloneSection(section), order: nextOrder++ });
  }

  return persisted;
}

function findManifestSectionForTenant(tenantDoc, sectionId, templateId = "index") {
  const activeTheme = tenantDoc.settings?.activeTheme || "modern";
  const candidateSlugs = Array.from(new Set([activeTheme, ...getBuiltInThemeSlugs()]));

  for (const slug of candidateSlugs) {
    const manifest = getThemeManifest(slug);
    const sections = buildSectionsFromManifestTemplate(manifest, templateId);
    const section = sections.find((s) => s.id === sectionId);
    if (section) return cloneSection(section);
  }

  return null;
}

function materializeMissingManifestSection(tenantDoc, list, sectionId, templateId = "index") {
  const section = findManifestSectionForTenant(tenantDoc, sectionId, templateId);
  if (!section) return null;

  const maxOrder = list.reduce((max, s, i) => {
    const order = Number.isFinite(Number(s?.order)) ? Number(s.order) : i;
    return Math.max(max, order);
  }, -1);
  section.order = maxOrder + 1;
  list.push(section);
  return section;
}

/**
 * Get current tenant's theme customization
 */
export const getThemeCustomizationService = async (tenantId) => {
  const tenant = await getTenantCustomizationRepo(tenantId);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const themeSlug = tenant.settings?.activeTheme || "modern";
  const manifest = getThemeManifest(themeSlug);

  // Build defaults from the theme's manifest
  const manifestColors = manifest?.colors || {};
  const manifestTypography = manifest?.typography || {};

  // Manifest-declared global theme settings (Shopify-style theme.settings[]).
  // Each declared setting contributes its `default` value so the dashboard
  // gets a complete bag to render controls against, even when the merchant
  // hasn't touched anything yet. Merchant overrides layer on top below.
  const manifestThemeDefaults = {};
  for (const setting of manifest?.settings || []) {
    if (setting && typeof setting.id === "string" && "default" in setting) {
      manifestThemeDefaults[setting.id] = setting.default;
    }
  }

  const defaultCustomization = {
    themeId: null,
    isDraft: false,
    settings: {
      colors: {
        primary: "#667eea",
        secondary: "#764ba2",
        accent: "#f093fb",
        background: "#ffffff",
        text: "#1a202c",
        textSecondary: "#718096",
        border: "#e2e8f0",
        success: "#48bb78",
        warning: "#ed8936",
        error: "#f56565",
        ...manifestColors,
      },
      typography: {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSizeBase: "16px",
        headingFontFamily: "Inter, system-ui, sans-serif",
        lineHeight: "1.6",
        ...manifestTypography,
      },
      layout: {
        containerWidth: "1200px",
        headerHeight: "80px",
        sidebarWidth: "250px",
        borderRadius: "8px",
      },
      // Seed with manifest-declared global settings so the editor has a
      // complete bag to render against on first open.
      theme: { ...manifestThemeDefaults },
    },
    sections: buildDefaultSectionsFromManifest(manifest),
    customCSS: "",
    previewToken: null,
    previewTokenExpiry: null,
    lastPublishedAt: null,
    updatedAt: new Date(),
  };

  // GET is a pure read. We do NOT persist manifest defaults into the
  // draft on open — that would silently flip `isDraft: true` every
  // time the editor mounts, making every dashboard session look like
  // the merchant had unpublished work. Theme-switch and fresh-install
  // paths already seed the draft at write time (see services/theme.js
  // installThemeService + installDefaultTheme), so by the time the
  // editor opens the draft is already populated.
  //
  // If a tenant somehow lands here with an empty draft (legacy data,
  // failed install, manual DB edit), the editor just renders the
  // manifest template defaults in-memory for this one response —
  // nothing is written. Any subsequent section add/edit through the
  // proper mutation APIs will populate the draft for real.
  //
  // Assemble the per-template map for the dashboard.
  // `sectionsByTemplate` is the canonical store (migration 006); the
  // manifest can also declare section defaults for non-index templates
  // (e.g. a theme could ship with a curated product page). Those
  // defaults are surfaced when the merchant hasn't yet touched the
  // bucket.
  const rawByTpl =
    (tenant.themeCustomization?.sectionsByTemplate &&
      typeof tenant.themeCustomization.sectionsByTemplate === "object"
      ? { ...tenant.themeCustomization.sectionsByTemplate }
      : {}) || {};
  const persistedSections = Array.isArray(rawByTpl.index) ? rawByTpl.index : [];
  const fallbackToManifest =
    persistedSections.length === 0 && defaultCustomization.sections.length > 0;
  const manifestTemplates = (manifest?.templates && typeof manifest.templates === "object")
    ? manifest.templates
    : {};
  const sectionsByTemplate = {};
  for (const tpl of ALLOWED_TEMPLATE_IDS) {
    const persisted = rawByTpl[tpl];
    const tplManifest = manifest;
    if (Array.isArray(persisted) && persisted.length > 0) {
      sectionsByTemplate[tpl] = mergeSectionsWithManifestDefaults(persisted, tplManifest, tpl);
      continue;
    }
    if (tpl === "index") {
      sectionsByTemplate.index = fallbackToManifest
        ? defaultCustomization.sections
        : mergeSectionsWithManifestDefaults(persistedSections, tplManifest, "index");
      continue;
    }
    // Use manifest-declared template defaults when the tenant hasn't
    // authored the bucket yet.
    const tplDefaults = Array.isArray(manifestTemplates[tpl]) ? manifestTemplates[tpl] : [];
    sectionsByTemplate[tpl] = tplDefaults.map((s, i) => ({
      id: s.id,
      type: s.type,
      enabled: s.disabled !== true,
      order: typeof s.order === "number" ? s.order : i,
      layout: s.layout || "full-width",
      settings: s.settings || {},
      elements: s.elements || [],
      blocks: s.blocks || [],
    }));
  }

  const merged = {
    ...defaultCustomization,
    ...(tenant.themeCustomization || {}),
    themeSlug,
    settings: {
      colors: {
        ...defaultCustomization.settings.colors,
        ...(tenant.themeCustomization?.settings?.colors || {}),
      },
      typography: {
        ...defaultCustomization.settings.typography,
        ...(tenant.themeCustomization?.settings?.typography || {}),
      },
      layout: {
        ...defaultCustomization.settings.layout,
        ...(tenant.themeCustomization?.settings?.layout || {}),
      },
      // Merge: manifest-declared defaults first, merchant overrides
      // layered on top. Storefront reads this bag and resolves per-id
      // against manifest.settings[] at render time — unknown keys from
      // legacy data are harmless because the storefront ignores them.
      theme: {
        ...manifestThemeDefaults,
        ...(tenant.themeCustomization?.settings?.theme || {}),
      },
    },
    sections: fallbackToManifest
      ? defaultCustomization.sections
      : mergeSectionsWithManifestDefaults(persistedSections, manifest, "index"),
    sectionsByTemplate,
    availableTemplates: ALLOWED_TEMPLATE_IDS.slice(),
    // Expose the manifest-declared setting schema alongside the values
    // so the dashboard has the full definition (type, label, options,
    // default, min/max) without a second request. The storefront
    // doesn't need this — it reads the manifest directly — but the
    // dashboard consumes the same JSON for rendering controls.
    themeSettingsSchema: Array.isArray(manifest?.settings) ? manifest.settings : [],
  };

  // Annotate every returned section instance with `known` — whether its
  // `type` is still declared by the active theme's manifest (audit 1.7b).
  // A persisted section whose type was removed from a rebuilt manifest is
  // `known: false`; the dashboard editor flags it (warning row, no guessed
  // controls) and the storefront skips it. Additive read-time only — we do
  // not restructure the merge above or persist anything.
  const knownTypes = new Set(
    (Array.isArray(manifest?.sections) ? manifest.sections : [])
      .map((d) => d?.type)
      .filter(Boolean)
  );
  const annotateKnown = (list) =>
    Array.isArray(list)
      ? list.map((s) =>
          s && typeof s === "object" ? { ...s, known: knownTypes.has(s.type) } : s
        )
      : list;

  merged.sections = annotateKnown(merged.sections);
  if (merged.sectionsByTemplate && typeof merged.sectionsByTemplate === "object") {
    const annotatedByTpl = {};
    for (const [tpl, list] of Object.entries(merged.sectionsByTemplate)) {
      annotatedByTpl[tpl] = annotateKnown(list);
    }
    merged.sectionsByTemplate = annotatedByTpl;
  }

  return merged;
};

/**
 * Update theme settings (colors, typography, layout)
 */
export const updateThemeSettingsService = async (
  tenantId,
  settings
) => {
  // Validate settings structure — only the four known buckets are
  // writeable from this endpoint. `theme` carries manifest-level
  // global settings (Shopify-style), the other three are the
  // structural CSS-variable buckets.
  const allowedKeys = ["colors", "typography", "layout", "theme"];
  const providedKeys = Object.keys(settings);
  const invalidKeys = providedKeys.filter((key) => !allowedKeys.includes(key));

  if (invalidKeys.length > 0) {
    throw new APIError(`Invalid settings keys: ${invalidKeys.join(", ")}`, 400);
  }

  // Strict, CSS-safe validation against the active theme's manifest.
  // Rejects unknown manifest.settings keys, bad colors, malformed
  // lengths, font-stack injection, out-of-range values. This is the
  // single gate that keeps the <style> tag on the storefront trustable.
  const Tenant = mongoose.model("Tenant");
  const tenant0 = await Tenant.findById(tenantId).select("settings.activeTheme").lean();
  if (!tenant0) throw new APIError("Tenant not found", 404);
  const themeSlug = tenant0.settings?.activeTheme || "modern";
  const { valid, errors } = validateGlobalSettings(themeSlug, settings);
  if (!valid) {
    throw new APIError(`Invalid theme settings: ${errors.join("; ")}`, 400);
  }

  // Update settings and mark as draft
  const tenant = await updateTenantCustomizationSettingsRepo(
    tenantId,
    settings
  );

  if (!tenant) {
    throw new APIError("Tenant not found", 404);
  }

  return tenant.themeCustomization;
};

/**
 * Update a single manifest-level global setting (one control in the
 * dashboard — e.g. flip `show_announcement_bar`, pick a new
 * `accent_color`). The key must be declared by the active theme's
 * manifest; value is validated against that declared type.
 */
export const updateThemeSettingService = async (tenantId, key, value) => {
  if (typeof key !== "string" || key.length === 0) {
    throw new APIError("Setting key is required", 400);
  }
  const Tenant = mongoose.model("Tenant");
  const tenant0 = await Tenant.findById(tenantId).select("settings.activeTheme").lean();
  if (!tenant0) throw new APIError("Tenant not found", 404);
  const themeSlug = tenant0.settings?.activeTheme || "modern";
  // Validate the whole bag as if it contained just this one key — the
  // bucket validator checks against manifest.settings[] and rejects
  // unknown ids. This is the same rule path the bulk PUT takes.
  const { valid, errors } = validateGlobalSettings(themeSlug, {
    theme: { [key]: value },
  });
  if (!valid) {
    throw new APIError(`Invalid theme setting: ${errors.join("; ")}`, 400);
  }
  const tenant = await updateTenantThemeSettingRepo(tenantId, key, value);
  if (!tenant) throw new APIError("Tenant not found", 404);
  return tenant.themeCustomization;
};

/**
 * Normalise a tenant doc's `sectionsByTemplate` into a plain object
 * with an entry for `templateId` (which may be absent if the merchant
 * has never touched that template). `sectionsByTemplate` is the single
 * canonical store — migration 006 folded any legacy flat `sections`
 * data into the `index` bucket.
 */
function readTemplateSections(tenantDoc, templateId) {
  const tc = tenantDoc.themeCustomization || {};
  const map = (tc.sectionsByTemplate && typeof tc.sectionsByTemplate === "object")
    ? tc.sectionsByTemplate
    : {};
  const themeSlug = tenantDoc.settings?.activeTheme || "modern";
  const manifest = getThemeManifest(themeSlug);
  if (Array.isArray(map[templateId]) && map[templateId].length > 0) {
    return mergeSectionsWithManifestDefaults(map[templateId], manifest, templateId);
  }
  // If the tenant has not authored this template yet, fall back to the
  // active theme manifest. The editor renders these manifest defaults
  // as selectable sections; saving one of them must materialize the
  // template bucket instead of throwing "Section not found".
  return buildSectionsFromManifestTemplate(manifest, templateId).map((s) => ({ ...s }));
}

/**
 * Persist `sections` into the tenant doc for the given template. Only
 * the canonical per-template bucket is written — the deprecated flat
 * `sections` field is no longer maintained.
 */
async function writeTemplateSections(TenantModel, tenantId, templateId, sections) {
  const set = {
    [`themeCustomization.sectionsByTemplate.${templateId}`]: sections,
    "themeCustomization.isDraft": true,
    "themeCustomization.updatedAt": new Date(),
  };
  await TenantModel.updateOne({ _id: tenantId }, { $set: set });
}

/**
 * Update section configuration
 */
export const updateThemeSectionsService = async (

  tenantId,
  sections,
  templateId = "index"
) => {
  assertValidTemplateId(templateId);
  // Validate sections array
  if (!Array.isArray(sections)) {
    throw new Error("Sections must be an array");
  }

  // Validate each section
  for (const section of sections) {
    if (!section.id || !section.type || section.order === undefined) {
      throw new Error("Each section must have id, type, and order properties");
    }
  }

  // Strict manifest validation — catch unknown section types, unknown
  // setting keys, range/enum/URL/color violations before the draft is
  // persisted. The editor gets immediate feedback instead of discovering
  // the mismatch at publish time.
  const Tenant = mongoose.model("Tenant");
  const tenant0 = await Tenant.findById(tenantId).select("settings.activeTheme").lean();
  const themeSlug = tenant0?.settings?.activeTheme || "modern";
  const { valid, errors } = validateCustomization(themeSlug, { sections });
  if (!valid) {
    throw new APIError(`Invalid section configuration: ${errors.join("; ")}`, 400);
  }

  // Sanitize richtext settings on this bulk write path too (audit 6.8.1)
  // before persisting — the values render as raw HTML on the storefront.
  const sanitizedSections = sections.map((sec) => ({
    ...sec,
    settings: sanitizeSectionRichTextSettings(themeSlug, sec.type, sec.settings),
  }));

  const tenant = await updateTenantCustomizationSectionsRepo(
    tenantId,
    sanitizedSections,
    templateId
  );

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant.themeCustomization;
};

/**
 * Toggle section enabled/disabled
 */
export const toggleSectionService = async (
  tenantId,
  sectionId,
  enabled,
  templateId = "index"
) => {
  assertValidTemplateId(templateId);
  const tenant = await getTenantCustomizationRepo(tenantId);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const sections = readTemplateSections(tenant, templateId);
  const section =
    sections.find((s) => s.id === sectionId) ||
    materializeMissingManifestSection(tenant, sections, sectionId, templateId);

  if (!section) {
    throw new Error(`Section not found: ${sectionId}`);
  }

  section.enabled = enabled;

  // Update sections and mark as draft
  const updatedTenant = await updateTenantCustomizationSectionsRepo(
    tenantId,
    sections,
    templateId
  );

  return updatedTenant.themeCustomization;
};

/**
 * Reorder sections
 */
export const reorderSectionsService = async (tenantId, sectionIds, templateId = "index") => {
  assertValidTemplateId(templateId);
  if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
    throw new Error("Section IDs must be a non-empty array");
  }

  const tenant = await getTenantCustomizationRepo(tenantId);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const sections = readTemplateSections(tenant, templateId);

  // Create a map of sections by ID
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  // Reorder sections based on provided IDs
  const reorderedSections = sectionIds.map((id, index) => {
    const section = sectionMap.get(id);
    if (!section) {
      const materialized = materializeMissingManifestSection(tenant, sections, id, templateId);
      if (!materialized) throw new Error(`Section not found: ${id}`);
      sectionMap.set(id, materialized);
      return {
        ...materialized,
        order: index,
      };
    }
    return {
      ...section,
      order: index,
    };
  });

  // Update sections
  const updatedTenant = await updateTenantCustomizationSectionsRepo(
    tenantId,
    reorderedSections,
    templateId
  );

  return updatedTenant.themeCustomization;
};

/**
 * Update custom CSS
 */
export const updateCustomCSSService = async (tenantId, css) => {
  // Full CSS policy validation (size cap, forbidden constructs,
  // url() scheme allowlist). See services/cssPolicy.js for the
  // full list and rationale. A rejected draft write is infinitely
  // better than stored XSS on the live storefront.
  const { valid, errors } = validateCustomCSS(css);
  if (!valid) {
    throw new APIError(`Invalid custom CSS: ${errors.join("; ")}`, 400);
  }

  const tenant = await updateTenantCustomCSSRepo(tenantId, css);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant.themeCustomization;
};

/**
 * Constant-time validation of an EDITOR preview token (audit 1.8 token
 * duality — this is `themeCustomization.previewToken`, NOT the stable
 * store owner-draft `settings.previewToken`). Returns true only when the
 * supplied token matches the stored one AND it hasn't expired.
 *
 * This is the exact check /store-info runs for `?preview=`; extracted so
 * the CMS page-preview endpoint (audit 6.4) can reuse it verbatim rather
 * than minting a new token type. Comparison is constant-time to deny a
 * timing oracle even though the 32-byte CSPRNG token makes enumeration
 * infeasible anyway.
 */
export function isValidEditorPreviewToken(tenant, token) {
  const tc = tenant?.themeCustomization || {};
  if (!token || typeof token !== "string" || !tc.previewToken || !tc.previewTokenExpiry) {
    return false;
  }
  const storedBuf = Buffer.from(tc.previewToken, "utf8");
  const providedBuf = Buffer.from(token, "utf8");
  let match = false;
  if (storedBuf.length === providedBuf.length) {
    match = crypto.timingSafeEqual(storedBuf, providedBuf);
  }
  const notExpired = new Date(tc.previewTokenExpiry).getTime() > Date.now();
  return match && notExpired;
}

// Preview token policy constants. The merchant can ask for a shorter
// or longer expiry from the dashboard, but we clamp to these bounds so
// a stale preview link can't linger forever and expose a draft after
// the merchant has moved on. 32 bytes of random entropy → 64 hex chars;
// treated as a single-use per-generation secret (generating a new token
// replaces the previous one, even if it hadn't yet expired).
export const PREVIEW_TOKEN_DEFAULT_MINUTES = 120;
export const PREVIEW_TOKEN_MAX_MINUTES = 240;

/**
 * Generate preview token for viewing draft changes
 */
export const generatePreviewTokenService = async (
  tenantId,
  expiryMinutes = PREVIEW_TOKEN_DEFAULT_MINUTES
) => {
  // Clamp caller-supplied expiry to the policy window.
  let minutes = Number(expiryMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) minutes = PREVIEW_TOKEN_DEFAULT_MINUTES;
  if (minutes > PREVIEW_TOKEN_MAX_MINUTES) minutes = PREVIEW_TOKEN_MAX_MINUTES;

  // Generate secure random token (32 bytes of CSPRNG entropy).
  const token = crypto.randomBytes(32).toString("hex");

  // Calculate expiry time
  const expiryDate = new Date();
  expiryDate.setMinutes(expiryDate.getMinutes() + minutes);

  const tenant = await generatePreviewTokenRepo(tenantId, token, expiryDate);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Build the preview URL as an ABSOLUTE URL pointing at the tenant's
  // storefront origin.
  //
  // A relative URL doesn't work in every dev setup: when the merchant
  // runs the dashboard via Vite on a separate port (e.g. localhost:5173)
  // while Express serves the storefront on localhost:3000, an iframe
  // `src="/?preview=<token>"` resolves against the Vite origin and the
  // dashboard's SPA catch-all serves itself into the iframe instead of
  // the storefront. The absolute URL avoids that.
  //
  // We deliberately avoid `tenant.getActiveDomain()` here because it
  // reads the denormalized `domains.subdomain.fullDomain` field, which
  // can go stale if the operator changes BASE_DOMAIN/DOMAIN_SUFFIX in
  // .env after tenants already exist in the DB — exactly the
  // "Firefox can't open this page" failure the user just reported.
  // Instead we recompute the host from the live `subdomain.name` plus
  // the current `config.baseDomain`, so changing .env immediately
  // changes every generated preview URL.
  //
  // Scheme is http in dev, https in prod. If a custom verified domain
  // is active, prefer that (merchants deliberately point it somewhere
  // routable and that's how real shoppers reach the store).
  const subdomainName = tenant.domains?.subdomain?.name;
  const customDomain =
    tenant.domains?.primaryDomain === "custom" &&
    tenant.domains?.customDomain?.name &&
    tenant.domains?.customDomain?.isVerified
      ? tenant.domains.customDomain.name
      : null;
  // Prefer the platform subdomain for the editor preview even when the store's
  // primary domain is a custom one: the storefront serves identically there,
  // and the dashboard's CSP frame-src allows `*.<platformDomain>` (a static
  // wildcard can't enumerate arbitrary custom domains), so the preview is
  // always embeddable in the editor iframe.
  const host = subdomainName
    ? `${subdomainName}.${config.baseDomain}`
    : customDomain || config.baseDomain;
  const scheme = config.isProduction ? "https" : "http";
  const previewUrl = `${scheme}://${host}/?preview=${token}`;

  return {
    token,
    expiryDate,
    previewUrl,
  };
};

/**
 * Publish draft customization changes.
 *
 * Flow:
 *   1. Load the tenant + draft customization.
 *   2. Validate the draft against the active theme's manifest. Reject on
 *      any structural mismatch — a broken draft must never become the
 *      published version.
 *   3. Compute the next version number (max existing + 1) and write a
 *      snapshot row to ThemeCustomizationVersion.
 *   4. Copy the draft into `tenant.themeCustomization.published` so the
 *      storefront serves it.
 *   5. Mark `isDraft = false` and stamp `lastPublishedAt`.
 *
 * The version write happens BEFORE the published-snapshot write. If the
 * version write fails, we abort and the live storefront keeps serving the
 * previous version. If the snapshot write fails after the version write,
 * the version table has an orphaned row — that's fine, it's append-only
 * audit data and re-publishing will just create another row.
 */
export const publishCustomizationService = async (
  tenantId,
  { models, userId, label } = {}
) => {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new APIError("Tenant not found", 404);
  if (!tenant.themeCustomization) {
    throw new APIError("No customization to publish", 400);
  }

  const themeSlug = tenant.settings?.activeTheme || "modern";
  const draft = tenant.themeCustomization;

  // Per-template buckets are the single canonical store — migration 006
  // folded any legacy flat `sections` data into `sectionsByTemplate.index`
  // and no write path maintains the flat array any more.
  const draftByTpl = (draft.sectionsByTemplate && typeof draft.sectionsByTemplate === "object")
    ? { ...draft.sectionsByTemplate }
    : {};

  // Strict manifest validation — rejects unknown section types, unknown
  // setting keys, out-of-range values, bad colors/URLs, block limit
  // violations, etc. No silent stripping: if the draft is broken the
  // editor gets a precise error list and the merchant fixes it before
  // the snapshot can become live.
  const { valid, errors } = validateCustomization(themeSlug, {
    ...draft,
    sectionsByTemplate: draftByTpl,
  });
  if (!valid) {
    throw new APIError(`Cannot publish: ${errors.join("; ")}`, 400);
  }
  // Re-validate custom CSS at publish time as well. A draft written
  // before the policy existed (legacy data) must not slip through
  // onto the live storefront under any circumstance.
  if (draft.customCSS) {
    const { valid: cssValid, errors: cssErrors } = validateCustomCSS(draft.customCSS);
    if (!cssValid) {
      throw new APIError(`Cannot publish: ${cssErrors.join("; ")}`, 400);
    }
  }
  // 1. Snapshot the draft into the version history collection with a
  //    concurrency-safe retry. Two merchants clicking publish at the
  //    same time would otherwise race on max+1 and collide on the
  //    unique (tenantId, version) index. On collision, we re-read
  //    max and retry; bounded to a small number because the second
  //    publish will almost always win on the first retry and we
  //    never want a publish to loop forever.
  let createdVersion = null;
  let previousSnapshot = null;
  const basePayload = {
    themeSlug,
    settings: {
      colors: { ...(draft.settings?.colors || {}) },
      typography: { ...(draft.settings?.typography || {}) },
      layout: { ...(draft.settings?.layout || {}) },
      // Manifest-level global settings — snapshotted so rollback can
      // faithfully restore the merchant's Shopify-style theme options
      // (show_announcement_bar, accent_color, logo_width, ...).
      theme: { ...(draft.settings?.theme || {}) },
    },
    sectionsByTemplate: JSON.parse(JSON.stringify(draftByTpl)),
    customCSS: draft.customCSS || "",
    publishedBy: userId || null,
    source: "publish",
  };

  if (models?.ThemeCustomizationVersion) {
    createdVersion = await writeVersionRowWithRetry(
      models.ThemeCustomizationVersion,
      basePayload,
      (prev) => {
        previousSnapshot = prev;
        return (
          label ||
          summarizeCustomizationDiff(prev, {
            settings: basePayload.settings,
            sectionsByTemplate: basePayload.sectionsByTemplate,
            customCSS: basePayload.customCSS,
          })
        );
      }
    );
  }
  const nextVersion = createdVersion?.version ?? 1;
  const snapshotPayload = createdVersion || {
    ...basePayload,
    version: nextVersion,
    publishedAt: new Date(),
    label: label || summarizeCustomizationDiff(previousSnapshot, {
      settings: basePayload.settings,
      sectionsByTemplate: basePayload.sectionsByTemplate,
      customCSS: basePayload.customCSS,
    }),
  };

  // 3. Copy the snapshot into the published block on the tenant doc.
  // Use $set on the nested path so Mongoose reliably tracks the Mixed
  // sections array — assigning to `tenant.themeCustomization.published =
  // {...}` doesn't always mark sub-paths dirty when the parent is a plain
  // nested object with Mixed children, leading to silent no-op saves.
  const now = new Date();
  const Tenant2 = mongoose.model("Tenant");
  await Tenant2.updateOne(
    { _id: tenantId },
    {
      $set: {
        "themeCustomization.published.themeSlug": themeSlug,
        "themeCustomization.published.settings": snapshotPayload.settings,
        "themeCustomization.published.sectionsByTemplate": snapshotPayload.sectionsByTemplate || {},
        "themeCustomization.published.customCSS": snapshotPayload.customCSS,
        "themeCustomization.published.version": nextVersion,
        "themeCustomization.published.publishedAt": now,
        "themeCustomization.published.publishedBy": userId || null,
        "themeCustomization.sectionsByTemplate": draftByTpl,
        "themeCustomization.isDraft": false,
        "themeCustomization.lastPublishedAt": now,
        "themeCustomization.updatedAt": now,
        // Publish supersedes any outstanding preview — the draft the
        // token was bound to is now live, so its entire reason for
        // existing is gone. Force the merchant to regenerate if they
        // want a preview of the *next* draft.
        "themeCustomization.previewToken": null,
        "themeCustomization.previewTokenExpiry": null,
      },
    }
  );
  // Refresh the in-memory tenant doc so the return value reflects the write.
  const refreshed = await Tenant2.findById(tenantId);
  if (refreshed) {
    tenant.themeCustomization = refreshed.themeCustomization;
  }

  return tenant.themeCustomization;
};

/**
 * List published versions for the tenant, newest first. The list view
 * powers the "version history" panel in the dashboard so the merchant can
 * see what they've published and roll back if something looks wrong.
 */
export const listCustomizationVersionsService = async (models) => {
  if (!models?.ThemeCustomizationVersion) return [];
  const versions = await models.ThemeCustomizationVersion
    .find({})
    .sort({ version: -1 })
    .select("version themeSlug publishedAt publishedBy source label")
    .lean();
  return versions;
};

/**
 * Fetch a single version (full snapshot) by its version number.
 */
export const getCustomizationVersionService = async (models, version) => {
  if (!models?.ThemeCustomizationVersion) {
    throw new APIError("Version history not available", 500);
  }
  const v = parseInt(version, 10);
  if (!Number.isFinite(v) || v < 1) {
    throw new APIError("Invalid version number", 400);
  }
  const found = await models.ThemeCustomizationVersion.findOne({ version: v }).lean();
  if (!found) throw new APIError("Version not found", 404);
  return found;
};

/**
 * Roll the *draft* back to a prior published version. We deliberately do
 * NOT auto-republish — instead the merchant restores the snapshot into
 * the editor, has a chance to preview, then hits publish again. This
 * matches Shopify's "restore" semantics and keeps the audit trail
 * accurate (the rollback shows up as a *new* version row, not as a
 * rewrite of an old one).
 */
export const rollbackCustomizationService = async (
  tenantId,
  version,
  { models, userId } = {}
) => {
  const snapshot = await getCustomizationVersionService(models, version);

  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new APIError("Tenant not found", 404);

  // Restore draft fields from the snapshot via $set so the Mixed
  // sections array is reliably persisted.
  const restoredSettings = {
    colors: { ...(snapshot.settings?.colors || {}) },
    typography: { ...(snapshot.settings?.typography || {}) },
    layout: { ...(snapshot.settings?.layout || {}) },
    theme: { ...(snapshot.settings?.theme || {}) },
  };
  // Restore from the per-template snapshot. Legacy version rows written
  // before sectionsByTemplate existed only carry the flat `sections`
  // array (the index template) — surface that as the index bucket so
  // rollbacks to old versions still work.
  const restoredByTpl = snapshot.sectionsByTemplate && typeof snapshot.sectionsByTemplate === "object"
    ? JSON.parse(JSON.stringify(snapshot.sectionsByTemplate))
    : {};
  if (!Array.isArray(restoredByTpl.index) && Array.isArray(snapshot.sections)) {
    restoredByTpl.index = JSON.parse(JSON.stringify(snapshot.sections));
  }
  await Tenant.updateOne(
    { _id: tenantId },
    {
      $set: {
        "themeCustomization.settings": restoredSettings,
        "themeCustomization.sectionsByTemplate": restoredByTpl,
        "themeCustomization.customCSS": snapshot.customCSS || "",
        "themeCustomization.isDraft": true,
        "themeCustomization.updatedAt": new Date(),
      },
    }
  );

  // Record the rollback as its own audit row so the dashboard
  // timeline shows "rolled back to v1" as a distinct event — the
  // snapshot restored is the one the merchant targeted, so the
  // rollback row is a full copy of that version's contents under a
  // new monotonic version number with source="rollback".
  if (models?.ThemeCustomizationVersion) {
    await writeVersionRowWithRetry(
      models.ThemeCustomizationVersion,
      {
        themeSlug: snapshot.themeSlug,
        settings: restoredSettings,
        sectionsByTemplate: restoredByTpl,
        customCSS: snapshot.customCSS || "",
        publishedBy: userId || null,
        source: "rollback",
      },
      () => `Rolled back to version ${snapshot.version}`
    );
  }

  const refreshed = await Tenant.findById(tenantId);
  return {
    rolledBackTo: snapshot.version,
    customization: refreshed?.themeCustomization,
  };
};

/**
 * Reset customization to theme defaults.
 *
 * Resets ONLY the draft side of customization — the `published`
 * snapshot (i.e. whatever the live storefront is serving) is left
 * untouched. An audit row is appended so the timeline shows "reset"
 * as a distinct event; the row carries empty sections/settings since
 * that's the new state of the draft.
 */
export const resetCustomizationService = async (
  tenantId,
  { models, userId } = {}
) => {
  const tenant = await resetCustomizationRepo(tenantId);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  if (models?.ThemeCustomizationVersion) {
    const themeSlug = tenant.settings?.activeTheme || "modern";
    await writeVersionRowWithRetry(
      models.ThemeCustomizationVersion,
      {
        themeSlug,
        settings: { colors: {}, typography: {}, layout: {}, theme: {} },
        sectionsByTemplate: {},
        customCSS: "",
        publishedBy: userId || null,
        source: "reset",
      },
      () => "Draft reset to theme defaults"
    );
  }

  return tenant.themeCustomization;
};

/**
 * Add a new section to the draft.
 *
 * Section defaults are pulled from the **active theme's manifest** — never
 * from the legacy `sectionLibrary` — so the resulting section is guaranteed
 * to publish-validate cleanly. Each setting in the manifest contributes its
 * `default` value (or undefined if none); merchant-supplied `customSettings`
 * override on top, but only for keys the manifest actually declares.
 */
export const addSectionService = async (
  tenantId,
  sectionType,
  customSettings = {},
  position = null,
  templateId = "index"
) => {
  assertValidTemplateId(templateId);
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new APIError("Tenant not found", 404);

  const themeSlug = tenant.settings?.activeTheme || "modern";
  const manifest = getThemeManifest(themeSlug);
  if (!manifest) throw new APIError(`Unknown theme: ${themeSlug}`, 400);

  const def = (manifest.sections || []).find((s) => s.type === sectionType);
  if (!def) {
    throw new APIError(
      `Section type "${sectionType}" is not declared by theme "${themeSlug}"`,
      400
    );
  }

  // Build defaults from the manifest's setting list.
  const defaultSettings = {};
  for (const setting of def.settings || []) {
    if (setting.default !== undefined) defaultSettings[setting.id] = setting.default;
  }
  // Allow caller overrides, but only for keys the manifest knows about.
  const allowedKeys = new Set((def.settings || []).map((s) => s.id));
  const filteredCustom = {};
  for (const [k, v] of Object.entries(customSettings || {})) {
    if (allowedKeys.has(k)) filteredCustom[k] = v;
  }

  // Default blocks (e.g. trust-badges ships 3 starter badges).
  const defaultBlocks = Array.isArray(def.defaultBlocks)
    ? JSON.parse(JSON.stringify(def.defaultBlocks))
    : undefined;

  const { v4: uuidv4 } = await import("uuid");
  const sectionId = `${sectionType}-${uuidv4().slice(0, 8)}`;
  const newSection = {
    id: sectionId,
    type: sectionType,
    enabled: true,
    order: 0,
    // Sanitize any richtext settings supplied at add time (audit 6.8.1).
    settings: sanitizeSectionRichTextSettings(
      themeSlug,
      sectionType,
      { ...defaultSettings, ...filteredCustom }
    ),
    ...(defaultBlocks ? { blocks: defaultBlocks } : {}),
  };

  // Initialize themeCustomization if needed
  if (!tenant.themeCustomization) {
    tenant.themeCustomization = {
      sectionsByTemplate: {},
      settings: {},
      customCSS: "",
      isDraft: false,
    };
  }

  // Pick the current list for this template (manifest defaults when the
  // merchant hasn't authored the bucket yet).
  const list = readTemplateSections(tenant, templateId);

  if (position === null || position === undefined) {
    newSection.order = list.length;
    list.push(newSection);
  } else {
    newSection.order = position;
    for (const s of list) {
      if (s.order >= position) s.order += 1;
    }
    list.push(newSection);
  }

  await writeTemplateSections(Tenant, tenantId, templateId, list);

  // Refresh and return so the response mirrors persisted state.
  const refreshed = await Tenant.findById(tenantId).lean();
  return refreshed?.themeCustomization;
};

/**
 * Remove a section
 */
export const removeSectionService = async (tenantId, sectionId, templateId = "index") => {
  assertValidTemplateId(templateId);
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);

  if (!tenant) throw new Error("Tenant not found");

  const list = readTemplateSections(tenant, templateId);
  const sectionIndex = list.findIndex((s) => s.id === sectionId);
  if (sectionIndex === -1) {
    materializeMissingManifestSection(tenant, list, sectionId, templateId);
  }

  const resolvedIndex = list.findIndex((s) => s.id === sectionId);
  if (resolvedIndex === -1) throw new Error("Section not found");

  const removedSection = list[resolvedIndex];
  list.splice(resolvedIndex, 1);
  for (const s of list) {
    if (s.order > removedSection.order) s.order -= 1;
  }

  await writeTemplateSections(Tenant, tenantId, templateId, list);

  const refreshed = await Tenant.findById(tenantId).lean();
  return refreshed?.themeCustomization;
};

/**
 * Update section settings
 */
export const updateSectionSettingsService = async (
  tenantId,
  sectionId,
  settings,
  blocks,
  templateId = "index"
) => {
  assertValidTemplateId(templateId);
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);

  if (!tenant) throw new Error("Tenant not found");

  const list = readTemplateSections(tenant, templateId);
  const section =
    list.find((s) => s.id === sectionId) ||
    materializeMissingManifestSection(tenant, list, sectionId, templateId);
  if (!section) throw new Error("Section not found");

  // Sanitize richtext settings on the write path (audit 6.8.1) before
  // they are persisted and later injected into the storefront DOM.
  const themeSlug = tenant.settings?.activeTheme || "modern";
  section.settings = sanitizeSectionRichTextSettings(themeSlug, section.type, settings || {});
  if (Array.isArray(blocks)) section.blocks = blocks;

  await writeTemplateSections(Tenant, tenantId, templateId, list);
  const refreshed = await Tenant.findById(tenantId).lean();
  return refreshed?.themeCustomization;
};

/**
 * Update section elements
 */
export const updateSectionElementsService = async (
  tenantId,
  sectionId,
  elements,
  templateId = "index"
) => {
  assertValidTemplateId(templateId);
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);

  if (!tenant) throw new Error("Tenant not found");

  const list = readTemplateSections(tenant, templateId);
  const section =
    list.find((s) => s.id === sectionId) ||
    materializeMissingManifestSection(tenant, list, sectionId, templateId);
  if (!section) throw new Error("Section not found");

  section.elements = elements;

  await writeTemplateSections(Tenant, tenantId, templateId, list);
  const refreshed = await Tenant.findById(tenantId).lean();
  return refreshed?.themeCustomization;
};

/**
 * Duplicate a section
 */
export const duplicateSectionService = async (tenantId, sectionId, templateId = "index") => {
  assertValidTemplateId(templateId);
  const { v4: uuidv4 } = await import("uuid");

  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);

  if (!tenant) throw new Error("Tenant not found");

  const list = readTemplateSections(tenant, templateId);
  const originalSection =
    list.find((s) => s.id === sectionId) ||
    materializeMissingManifestSection(tenant, list, sectionId, templateId);
  if (!originalSection) throw new Error("Section not found");

  const duplicatedSection = {
    ...JSON.parse(JSON.stringify(originalSection)),
    id: `${originalSection.type}-${uuidv4().slice(0, 8)}`,
    order: originalSection.order + 1,
  };

  if (duplicatedSection.elements && duplicatedSection.elements.length > 0) {
    duplicatedSection.elements = duplicatedSection.elements.map((element) => ({
      ...element,
      id: `${duplicatedSection.id}-${element.type}-${uuidv4().slice(0, 8)}`,
    }));
  }

  for (const s of list) {
    if (s.order > originalSection.order) s.order += 1;
  }
  list.push(duplicatedSection);

  await writeTemplateSections(Tenant, tenantId, templateId, list);
  const refreshed = await Tenant.findById(tenantId).lean();
  return refreshed?.themeCustomization;
};

/**
 * List templates the dashboard page selector should offer. We return
 * the union of (a) the active theme's declared `manifest.templates`
 * keys and (b) the platform allow-list — so a merchant can compose
 * section layouts for any of the supported templates even when the
 * theme ships empty defaults for most of them.
 */
export const listThemeTemplatesService = async (tenantId) => {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId).select("settings.activeTheme").lean();
  if (!tenant) throw new APIError("Tenant not found", 404);
  const themeSlug = tenant.settings?.activeTheme || "modern";
  const manifest = getThemeManifest(themeSlug);
  const manifestKeys = manifest?.templates ? Object.keys(manifest.templates) : [];
  // Preserve allow-list ordering (index first), dedupe with any
  // manifest-declared extras that still fall inside the allow-list.
  const declared = new Set(manifestKeys.filter((k) => ALLOWED_TEMPLATE_IDS.includes(k)));
  const result = ALLOWED_TEMPLATE_IDS.map((tpl) => ({
    id: tpl,
    declaredByTheme: declared.has(tpl),
  }));
  return { themeSlug, templates: result };
};
