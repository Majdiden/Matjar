import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  getThemeCustomizationService,
  updateThemeSettingsService,
  updateThemeSettingService,
  updateThemeSectionsService,
  toggleSectionService,
  reorderSectionsService,
  updateCustomCSSService,
  generatePreviewTokenService,
  publishCustomizationService,
  resetCustomizationService,
  listCustomizationVersionsService,
  getCustomizationVersionService,
  rollbackCustomizationService,
  addSectionService,
  removeSectionService,
  updateSectionSettingsService,
  updateSectionElementsService,
  duplicateSectionService,
} from "../services/themeCustomization.js";
import {
  getThemeManifest,
  getAllThemeManifests,
  getThemeSettingsSchema,
} from "../services/themeManifestRegistry.js";
import { listThemeTemplatesService } from "../services/themeCustomization.js";

/**
 * Helper: read a `template` query parameter, default to "index",
 * reject anything outside the platform allow-list. Used by every
 * section-mutation handler to resolve which template bucket to hit.
 */
function resolveTemplateId(req) {
  const raw = typeof req.query.template === "string" ? req.query.template.trim() : "";
  return raw || "index";
}

/**
 * @route   GET /api/theme-customization
 * @desc    Get current tenant's theme customization
 * @access  Private (Tenant Admin)
 */
export const getThemeCustomization = asyncHandler(async (req, res) => {
  const customization = await getThemeCustomizationService(

    req.tenant._id
  );

  res.json({
    success: true,
    data: { customization },
  });
});

/**
 * @route   PUT /api/theme-customization/settings
 * @desc    Update theme settings (colors, typography, layout)
 * @access  Private (Tenant Admin)
 */
export const updateThemeSettings = asyncHandler(async (req, res) => {
  const { settings } = req.body;

  const customization = await updateThemeSettingsService(

    req.tenant._id,
    settings
  );

  res.json({
    success: true,
    message: "Theme settings updated successfully",
    data: { customization },
  });
});

/**
 * @route   PATCH /api/theme-customization/theme-settings/:key
 * @desc    Update one manifest-level global setting (e.g. show_announcement_bar)
 * @access  Private (Tenant Admin)
 *
 * Body: { value: any } — shape depends on the manifest-declared type
 * for this setting. The service validates against manifest.settings[]
 * so unknown keys and out-of-range values fail 400.
 */
export const updateThemeSetting = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  const customization = await updateThemeSettingService(
    req.tenant._id,
    key,
    value
  );
  res.json({
    success: true,
    message: "Theme setting updated",
    data: { customization },
  });
});

/**
 * @route   PUT /api/theme-customization/sections
 * @desc    Update section configuration
 * @access  Private (Tenant Admin)
 */
export const updateThemeSections = asyncHandler(async (req, res) => {
  const { sections } = req.body;

  const customization = await updateThemeSectionsService(
    req.tenant._id,
    sections,
    resolveTemplateId(req)
  );

  res.json({
    success: true,
    message: "Sections updated successfully",
    data: { customization },
  });
});

/**
 * @route   POST /api/theme-customization/sections/:sectionId/toggle
 * @desc    Enable/disable a specific section
 * @access  Private (Tenant Admin)
 */
export const toggleSection = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;
  const { enabled } = req.body;

  const customization = await toggleSectionService(
    req.tenant._id,
    sectionId,
    enabled,
    resolveTemplateId(req)
  );

  res.json({
    success: true,
    message: `Section ${enabled ? "enabled" : "disabled"} successfully`,
    data: { customization },
  });
});

/**
 * @route   POST /api/theme-customization/sections/reorder
 * @desc    Reorder sections
 * @access  Private (Tenant Admin)
 */
export const reorderSections = asyncHandler(async (req, res) => {
  const { sectionIds } = req.body; // Array of section IDs in new order

  const customization = await reorderSectionsService(
    req.tenant._id,
    sectionIds,
    resolveTemplateId(req)
  );

  res.json({
    success: true,
    message: "Sections reordered successfully",
    data: { customization },
  });
});

/**
 * @route   PUT /api/theme-customization/custom-css
 * @desc    Update custom CSS
 * @access  Private (Tenant Admin)
 */
export const updateCustomCSS = asyncHandler(async (req, res) => {
  const { css } = req.body;

  const customization = await updateCustomCSSService(

    req.tenant._id,
    css
  );

  res.json({
    success: true,
    message: "Custom CSS updated successfully",
    data: { customization },
  });
});

/**
 * @route   POST /api/theme-customization/preview
 * @desc    Generate preview token for viewing draft changes
 * @access  Private (Tenant Admin)
 */
export const generatePreviewToken = asyncHandler(async (req, res) => {
  const { expiryMinutes = 60 } = req.body;

  const result = await generatePreviewTokenService(

    req.tenant._id,
    expiryMinutes
  );

  res.json({
    success: true,
    message: "Preview token generated successfully",
    data: result,
  });
});

/**
 * @route   POST /api/theme-customization/publish
 * @desc    Publish draft customization changes
 * @access  Private (Tenant Admin)
 */
export const publishCustomization = asyncHandler(async (req, res) => {
  const { label } = req.body || {};
  const customization = await publishCustomizationService(req.tenant._id, {
    models: req.models,
    userId: req.user?._id || req.user?.userId || null,
    label,
  });

  res.json({
    success: true,
    message: "Theme customization published successfully",
    data: { customization },
  });
});

/**
 * @route   GET /api/theme-customization/versions
 * @desc    List published versions for the current tenant (newest first)
 * @access  Private (admin/manager)
 */
export const listCustomizationVersions = asyncHandler(async (req, res) => {
  const versions = await listCustomizationVersionsService(req.models);
  res.json({ success: true, data: { versions } });
});

/**
 * @route   GET /api/theme-customization/versions/:version
 * @desc    Fetch a specific published version snapshot
 * @access  Private (admin/manager)
 */
export const getCustomizationVersion = asyncHandler(async (req, res) => {
  const snapshot = await getCustomizationVersionService(req.models, req.params.version);
  res.json({ success: true, data: { version: snapshot } });
});

/**
 * @route   POST /api/theme-customization/versions/:version/rollback
 * @desc    Restore a prior version into the draft (does not auto-publish)
 * @access  Private (admin)
 */
export const rollbackCustomization = asyncHandler(async (req, res) => {
  const result = await rollbackCustomizationService(req.tenant._id, req.params.version, {
    models: req.models,
    userId: req.user?._id || req.user?.userId || null,
  });
  res.json({
    success: true,
    message: `Restored draft to version ${result.rolledBackTo}`,
    data: result,
  });
});

/**
 * @route   POST /api/theme-customization/reset
 * @desc    Reset customization to theme defaults
 * @access  Private (Tenant Admin)
 */
export const resetCustomization = asyncHandler(async (req, res) => {
  const customization = await resetCustomizationService(req.tenant._id, {
    models: req.models,
    userId: req.user?._id,
  });

  res.json({
    success: true,
    message: "Theme customization reset to defaults",
    data: { customization },
  });
});

/**
 * @route   POST /api/theme-customization/sections/add
 * @desc    Add a new section
 * @access  Private (Tenant Admin)
 */
export const addSection = asyncHandler(async (req, res) => {
  const { sectionType, settings, position } = req.body;

  const customization = await addSectionService(
    req.tenant._id,
    sectionType,
    settings,
    position,
    resolveTemplateId(req)
  );

  res.json({
    success: true,
    message: "Section added successfully",
    data: { customization },
  });
});

/**
 * @route   DELETE /api/theme-customization/sections/:sectionId
 * @desc    Remove a section
 * @access  Private (Tenant Admin)
 */
export const removeSection = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;

  const customization = await removeSectionService(
    req.tenant._id,
    sectionId,
    resolveTemplateId(req)
  );

  res.json({
    success: true,
    message: "Section removed successfully",
    data: { customization },
  });
});

/**
 * @route   PATCH /api/theme-customization/sections/:sectionId/settings
 * @desc    Update section settings
 * @access  Private (Tenant Admin)
 */
export const updateSectionSettings = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;
  const { settings, blocks } = req.body;

  const customization = await updateSectionSettingsService(
    req.tenant._id,
    sectionId,
    settings,
    blocks,
    resolveTemplateId(req)
  );

  res.json({
    success: true,
    message: "Section settings updated successfully",
    data: { customization },
  });
});

/**
 * @route   PATCH /api/theme-customization/sections/:sectionId/elements
 * @desc    Update section elements
 * @access  Private (Tenant Admin)
 */
export const updateSectionElements = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;
  const { elements } = req.body;

  const customization = await updateSectionElementsService(
    req.tenant._id,
    sectionId,
    elements,
    resolveTemplateId(req)
  );

  res.json({
    success: true,
    message: "Section elements updated successfully",
    data: { customization },
  });
});

/**
 * @route   POST /api/theme-customization/sections/:sectionId/duplicate
 * @desc    Duplicate an existing section
 * @access  Private (Tenant Admin)
 */
export const duplicateSection = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;

  const customization = await duplicateSectionService(
    req.tenant._id,
    sectionId,
    resolveTemplateId(req)
  );

  res.json({
    success: true,
    message: "Section duplicated successfully",
    data: { customization },
  });
});

/**
 * @route   GET /api/theme-customization/available-sections
 * @desc    Get available section types for the tenant's active theme
 * @access  Private (Tenant Admin)
 *
 * The section library the dashboard editor offers MUST come from the
 * active theme's manifest. Offering sections from a legacy global
 * catalog would let the merchant add section types the running theme
 * can't render, which then fails publish validation (or worse,
 * silently renders nothing). The active theme's manifest already
 * merges universal sections at build time via defineTheme(), so this
 * one call returns the complete picker list.
 */
export const getAvailableSections = asyncHandler(async (req, res) => {
  const activeSlug = req.tenant?.settings?.activeTheme;
  const manifest = activeSlug ? getThemeManifest(activeSlug) : null;
  if (!manifest) {
    return res.json({ success: true, data: { sections: [] } });
  }

  // Shape the response to match what SectionLibrary.tsx expects:
  // a list with `type`, `name`, `description`, and (optionally) a
  // thumbnail or preview url. We project only the fields the editor
  // cares about — the full setting schemas are fetched separately
  // via GET /manifest/:themeSlug when the merchant opens a section.
  const sections = (manifest.sections || []).map((s) => ({
    type: s.type,
    name: s.name,
    description: s.description || "",
    target: s.target || "body",
    limit: s.limit || null,
  }));

  res.json({
    success: true,
    data: { sections },
  });
});

/**
 * @route   GET /api/theme-customization/manifest/:themeSlug
 * @desc    Get the full manifest/schema for a theme (used by dashboard editor)
 * @access  Private (Tenant Admin)
 */
export const getManifest = asyncHandler(async (req, res) => {
  const { themeSlug } = req.params;
  const manifest = getThemeManifest(themeSlug);

  if (!manifest) {
    return res.status(404).json({
      success: false,
      message: `Theme '${themeSlug}' not found`,
    });
  }

  res.json({
    success: true,
    data: { manifest },
  });
});

/**
 * @route   GET /api/theme-customization/manifest/:themeSlug/schema
 * @desc    Get the settings schema for a theme (global settings + section definitions)
 * @access  Private (Tenant Admin)
 */
export const getManifestSchema = asyncHandler(async (req, res) => {
  const { themeSlug } = req.params;
  const schema = getThemeSettingsSchema(themeSlug);

  if (!schema) {
    return res.status(404).json({
      success: false,
      message: `Theme '${themeSlug}' not found`,
    });
  }

  res.json({
    success: true,
    data: { schema },
  });
});

/**
 * @route   GET /api/theme-customization/themes
 * @desc    List all available built-in themes with metadata
 * @access  Private (Tenant Admin)
 */
export const listThemeManifests = asyncHandler(async (req, res) => {
  const themes = getAllThemeManifests();

  res.json({
    success: true,
    data: { themes },
  });
});

/**
 * @route   GET /api/theme-customization/templates
 * @desc    List the templates the dashboard page selector should offer.
 *          Returns platform allow-list entries annotated with whether
 *          the active theme declares defaults for that template.
 * @access  Private (Tenant Admin)
 */
export const listThemeTemplates = asyncHandler(async (req, res) => {
  const result = await listThemeTemplatesService(req.tenant._id);
  res.json({
    success: true,
    data: result,
  });
});
