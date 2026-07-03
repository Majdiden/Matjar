import mongoose from "mongoose";

const Tenant = () => mongoose.model("Tenant");

/**
 * Read the tenant's customization. `sectionsByTemplate` is the single
 * canonical store for section lists (migration 006 copied any legacy
 * flat `sections` data into `sectionsByTemplate.index`); we only
 * normalise the map to a plain object so downstream callers never
 * have to null-check it.
 */
export const getTenantCustomizationRepo = async (tenantId) => {
  const raw = await Tenant()
    .findById(tenantId)
    .select("themeCustomization domains domain settings")
    .lean();
  if (!raw) return raw;
  const tc = raw.themeCustomization;
  if (tc) {
    tc.sectionsByTemplate =
      tc.sectionsByTemplate && typeof tc.sectionsByTemplate === "object"
        ? { ...tc.sectionsByTemplate }
        : {};
    if (tc.published) {
      tc.published.sectionsByTemplate =
        tc.published.sectionsByTemplate && typeof tc.published.sectionsByTemplate === "object"
          ? { ...tc.published.sectionsByTemplate }
          : {};
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
 * Persist the sections for a specific template. Only the canonical
 * per-template bucket is written — the deprecated flat `sections`
 * field is no longer maintained (see migration 006).
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
          "themeCustomization.sectionsByTemplate": {},
          "themeCustomization.customCSS": "",
          "themeCustomization.previewToken": null,
          "themeCustomization.previewTokenExpiry": null,
          "themeCustomization.updatedAt": new Date(),
          updatedAt: new Date(),
        },
        // Deprecated flat mirror of sectionsByTemplate.index — no code
        // writes it any more (migration 006 canonicalized on the map);
        // drop any legacy residue so a reset truly returns to defaults.
        $unset: { "themeCustomization.sections": "" },
      },
      { new: true }
    )
    .select("themeCustomization");
};
