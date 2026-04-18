import express from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import {
  getThemeCustomization,
  updateThemeSettings,
  updateThemeSetting,
  updateThemeSections,
  toggleSection,
  reorderSections,
  updateCustomCSS,
  generatePreviewToken,
  publishCustomization,
  resetCustomization,
  addSection,
  removeSection,
  updateSectionSettings,
  updateSectionElements,
  duplicateSection,
  getAvailableSections,
  getManifest,
  getManifestSchema,
  listThemeManifests,
  listCustomizationVersions,
  getCustomizationVersion,
  rollbackCustomization,
  listThemeTemplates,
} from "../controllers/themeCustomization.js";

const router = express.Router();

// Every route here is dashboard-side store configuration. Even read
// endpoints expose merchant-only metadata (draft state, available section
// types, manifest internals) so we gate the entire router on
// admin/manager — customer accounts must never reach these handlers.
router.use(authenticate, requirePermission("themes.write"));

// Get current customization
router.get("/", getThemeCustomization);

// Get available section types
router.get("/available-sections", getAvailableSections);

// List supported templates for the page selector in the dashboard
// editor — the active theme's declared templates intersected with the
// platform allow-list.
router.get("/templates", listThemeTemplates);

// Theme manifest endpoints
router.get("/themes", listThemeManifests);
router.get("/manifest/:themeSlug", getManifest);
router.get("/manifest/:themeSlug/schema", getManifestSchema);

// Update settings (bulk — colors / typography / layout / theme buckets)
router.put("/settings", updateThemeSettings);

// Update a single manifest-level global setting by id. PATCH path lets
// the dashboard fire per-control saves (each checkbox / color / range
// change is an atomic write) without having to send the full bag.
router.patch("/theme-settings/:key", updateThemeSetting);

// Section management
router.put("/sections", updateThemeSections);
router.post("/sections/add", addSection);
router.post("/sections/reorder", reorderSections);
router.post("/sections/:sectionId/toggle", toggleSection);
router.patch("/sections/:sectionId/settings", updateSectionSettings);
router.patch("/sections/:sectionId/elements", updateSectionElements);
router.post("/sections/:sectionId/duplicate", duplicateSection);
router.delete("/sections/:sectionId", removeSection);

// Update custom CSS
router.put("/custom-css", updateCustomCSS);

// Preview and publish
router.post("/preview", generatePreviewToken);
router.post("/publish", publishCustomization);

// Version history & rollback. Listing/reading is admin/manager (managers
// need to inspect what's live before staging promotional changes); the
// rollback action is admin-only because it overwrites the working draft.
router.get("/versions", listCustomizationVersions);
router.get("/versions/:version", getCustomizationVersion);
router.post("/versions/:version/rollback", requirePermission("themes.write"), rollbackCustomization);

// Reset to defaults
router.post("/reset", resetCustomization);

export default router;
