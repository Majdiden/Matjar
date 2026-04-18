import mongoose from "mongoose";

const Tenant = () => mongoose.model("Tenant");

/**
 * Read shim — surface the tenant's customization with
 * `sectionsByTemplate` normalised. When a tenant's DB doc only has
 * the legacy flat `sections` array (older pods, pre-migration),
 * we surface that list as `sectionsByTemplate.index` so downstream
 * callers can treat the Map as the single source of truth.
 *
 * The flat `sections` field is intentionally preserved on the doc —
 * older pods still reading it stay functional until a cleanup
 * migration ships.
 */
export const getTenantCustomizationRepo = async (tenantId) => {
  const raw = await Tenant()
    .findById(tenantId)
    .select("themeCustomization domains domain settings")
    .lean();
  if (!raw) return raw;
  const tc = raw.themeCustomization;
  if (tc) {
    const byTpl = tc.sectionsByTemplate && typeof tc.sectionsByTemplate === "object"
      ? { ...tc.sectionsByTemplate }
      : {};
    // Back-fill index from the flat sections array when the per-
    // template bucket hasn't been populated yet. Never overwrite an
    // existing explicit index bucket — those are the canonical value.
    if (
      (!byTpl.index || (Array.isArray(byTpl.index) && byTpl.index.length === 0)) &&
      Array.isArray(tc.sections) &&
      tc.sections.length > 0
    ) {
      byTpl.index = tc.sections;
    }
    tc.sectionsByTemplate = byTpl;

    // Same shim on the published snapshot.
    if (tc.published) {
      const pubByTpl = tc.published.sectionsByTemplate && typeof tc.published.sectionsByTemplate === "object"
        ? { ...tc.published.sectionsByTemplate }
        : {};
      if (
        (!pubByTpl.index || (Array.isArray(pubByTpl.index) && pubByTpl.index.length === 0)) &&
        Array.isArray(tc.published.sections) &&
        tc.published.sections.length > 0
      ) {
        pubByTpl.index = tc.published.sections;
      }
      tc.published.sectionsByTemplate = pubByTpl;
    }
  }
  return raw;
};

export const updateTenantCustomizationSettingsRepo = async (tenantId, settings) => {
  const updateQuery = {
    updatedAt: new Date(),
    "themeCustomization.isDraft": true,
    "themeCustomization.updatedAt": new Date(),
  };

  if (settings.colors) {
    Object.keys(settings.colors).forEach((key) => {
      updateQuery[`themeCustomization.settings.colors.${key}`] = settings.colors[key];
    });
  }
  if (settings.typography) {
    Object.keys(settings.typography).forEach((key) => {
      updateQuery[`themeCustomization.settings.typography.${key}`] = settings.typography[key];
    });
  }
  if (settings.layout) {
    Object.keys(settings.layout).forEach((key) => {
      updateQuery[`themeCustomization.settings.layout.${key}`] = settings.layout[key];
    });
  }
  if (settings.theme) {
    Object.keys(settings.theme).forEach((key) => {
      updateQuery[`themeCustomization.settings.theme.${key}`] = settings.theme[key];
    });
  }

  return await Tenant()
    .findByIdAndUpdate(tenantId, { $set: updateQuery }, { new: true })
    .select("themeCustomization");
};

export const updateTenantThemeSettingRepo = async (tenantId, key, value) => {
  return await Tenant()
    .findByIdAndUpdate(
      tenantId,
      {
        $set: {
          [`themeCustomization.settings.theme.${key}`]: value,
          "themeCustomization.isDraft": true,
          "themeCustomization.updatedAt": new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    )
    .select("themeCustomization");
};

/**
 * Persist the sections for a specific template.
 *
 * The index template is special-cased: the flat legacy `sections`
 * field is kept in lockstep so older readers continue to work. For
 * any other template, only the per-template bucket is written.
 */
export const updateTenantCustomizationSectionsRepo = async (
  tenantId,
  sections,
  templateId = "index"
) => {
  const set = {
    [`themeCustomization.sectionsByTemplate.${templateId}`]: sections,
    "themeCustomization.isDraft": true,
    "themeCustomization.updatedAt": new Date(),
    updatedAt: new Date(),
  };
  if (templateId === "index") {
    set["themeCustomization.sections"] = sections;
  }
  return await Tenant()
    .findByIdAndUpdate(tenantId, { $set: set }, { new: true })
    .select("themeCustomization");
};

export const updateTenantCustomCSSRepo = async (tenantId, css) => {
  return await Tenant()
    .findByIdAndUpdate(
      tenantId,
      {
        $set: {
          "themeCustomization.customCSS": css,
          "themeCustomization.isDraft": true,
          "themeCustomization.updatedAt": new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    )
    .select("themeCustomization");
};

export const generatePreviewTokenRepo = async (tenantId, token, expiryDate) => {
  return await Tenant()
    .findByIdAndUpdate(
      tenantId,
      {
        $set: {
          "themeCustomization.previewToken": token,
          "themeCustomization.previewTokenExpiry": expiryDate,
          updatedAt: new Date(),
        },
      },
      { new: true }
    )
    .select("themeCustomization domains domain");
};

export const publishCustomizationRepo = async (tenantId) => {
  return await Tenant()
    .findByIdAndUpdate(
      tenantId,
      {
        $set: {
          "themeCustomization.isDraft": false,
          "themeCustomization.lastPublishedAt": new Date(),
          "themeCustomization.updatedAt": new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    )
    .select("themeCustomization");
};

/**
 * Reset the draft side of a tenant's customization. All per-template
 * buckets are cleared so a new composition starts from scratch; the
 * `published` snapshot is intentionally left alone.
 */
export const resetCustomizationRepo = async (tenantId) => {
  return await Tenant()
    .findByIdAndUpdate(
      tenantId,
      {
        $set: {
          "themeCustomization.isDraft": false,
          "themeCustomization.settings": { colors: {}, typography: {}, layout: {}, theme: {} },
          "themeCustomization.sections": [],
          "themeCustomization.sectionsByTemplate": {},
          "themeCustomization.customCSS": "",
          "themeCustomization.previewToken": null,
          "themeCustomization.previewTokenExpiry": null,
          "themeCustomization.updatedAt": new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    )
    .select("themeCustomization");
};
