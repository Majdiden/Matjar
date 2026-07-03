import { asyncHandler } from "../middlewares/errorHandler.js";
import logger from "../utils/logger.js";
import {
  createThemeService,
  getThemeService,
  getThemeBySlugService,
  getDefaultThemeService,
  getActiveThemesService,
  getThemesService,
  updateThemeService,
  updateThemeStatusService,
  deleteThemeService,
  setDefaultThemeService,
  installThemeService,
  uninstallThemeService,
  searchThemesService,
  getThemesByCategoryService,
  getPopularThemesService,
  getLatestThemesService,
  getThemePublicConfigService,
  getThemePreviewImagePathService,
  withThemePreviewImage,
} from "../services/theme.js";

/**
 * @route   POST /api/themes
 * @desc    Create new theme
 * @access  Admin only
 */
export const createTheme = asyncHandler(async (req, res) => {
  const theme = await createThemeService(req.body, req.user.userId);

  res.status(201).json({
    success: true,
    message: "Theme created successfully",
    data: { theme },
  });
});

/**
 * @route   GET /api/themes
 * @desc    Get all themes with pagination
 * @access  Public
 */
export const getThemes = asyncHandler(async (req, res) => {
  const { page, limit, sort, status, category, search } = req.query;

  let result;

  if (search) {
    result = await searchThemesService(search, { page, limit });
  } else if (category) {
    result = await getThemesByCategoryService(category, { page, limit });
  } else {
    const filters = {};
    if (status) filters.status = status;
    if (category) filters.categories = category;

    result = await getThemesService({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sort: sort || "-createdAt",
      filters,
    });
  }

  res.json({
    success: true,
    data: result,
  });
});

/**
 * @route   GET /api/themes/active
 * @desc    Get all active themes (with current tenant's active theme if authenticated)
 * @access  Public
 */
export const getActiveThemes = asyncHandler(async (req, res) => {
  const themes = await getActiveThemesService();

  // If user is authenticated, also return their currently active theme
  let currentTheme = null;
  if (req.tenant && req.tenant.settings?.activeTheme) {
    // Find the active theme from the list
    currentTheme = themes.find(
      (theme) => theme.slug === req.tenant.settings.activeTheme
    );

    // If not found in the list, fetch it by slug
    if (!currentTheme && req.tenant.settings.activeTheme) {
      try {
        currentTheme = await getThemeBySlugService(req.tenant.settings.activeTheme);
      } catch (error) {
        logger.error("Error fetching tenant active theme", { error: error.message });
      }
    }
  } else if (req.tenant && req.tenant.themeCustomization?.themeId) {
    // Fallback to themeCustomization.themeId
    try {
      currentTheme = await getThemeService(req.tenant.themeCustomization.themeId);
    } catch (error) {
      logger.error("Error fetching tenant theme by ID", { error: error.message });
    }
  }

  res.json({
    success: true,
    data: {
      themes,
      // Themes from the list are already decorated; a currentTheme fetched
      // directly by slug/id still needs its previewImage overlay.
      currentTheme: withThemePreviewImage(currentTheme),
    },
  });
});

/**
 * @route   GET /api/themes/:slug/preview
 * @desc    Stream a theme's built preview screenshot (dist/preview.jpg).
 *          Read-only; slug is validated against the manifest registry and
 *          the resolved path is contained to the theme's dist folder.
 * @access  Public
 */
export const getThemePreviewImage = asyncHandler(async (req, res) => {
  const filePath = getThemePreviewImagePathService(req.params.slug);
  if (!filePath) {
    return res.status(404).json({ success: false, message: "Preview image not found" });
  }
  // Screenshots change only on theme rebuilds — cache briefly.
  res.sendFile(filePath, { maxAge: "1h" });
});

/**
 * @route   GET /api/themes/popular
 * @desc    Get popular themes
 * @access  Public
 */
export const getPopularThemes = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const themes = await getPopularThemesService(limit);

  res.json({
    success: true,
    data: { themes },
  });
});

/**
 * @route   GET /api/themes/latest
 * @desc    Get latest themes
 * @access  Public
 */
export const getLatestThemes = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const themes = await getLatestThemesService(limit);

  res.json({
    success: true,
    data: { themes },
  });
});

/**
 * @route   GET /api/themes/default
 * @desc    Get default theme
 * @access  Public
 */
export const getDefaultTheme = asyncHandler(async (req, res) => {
  const theme = await getDefaultThemeService();

  res.json({
    success: true,
    data: { theme },
  });
});

/**
 * @route   GET /api/themes/:id
 * @desc    Get theme by ID
 * @access  Public
 */
export const getThemeById = asyncHandler(async (req, res) => {
  const theme = await getThemeService(req.params.id);

  res.json({
    success: true,
    data: { theme },
  });
});

/**
 * @route   GET /api/themes/slug/:slug
 * @desc    Get theme by slug
 * @access  Public
 */
export const getThemeBySlug = asyncHandler(async (req, res) => {
  const theme = await getThemeBySlugService(req.params.slug);

  res.json({
    success: true,
    data: { theme },
  });
});

/**
 * @route   GET /api/themes/:id/config
 * @desc    Get theme public configuration
 * @access  Public
 */
export const getThemeConfig = asyncHandler(async (req, res) => {
  const config = await getThemePublicConfigService(req.params.id);

  res.json({
    success: true,
    data: { config },
  });
});

/**
 * @route   PUT /api/themes/:id
 * @desc    Update theme
 * @access  Admin only
 */
export const updateTheme = asyncHandler(async (req, res) => {
  const theme = await updateThemeService(
    
    req.params.id,
    req.body,
    req.user.userId
  );

  res.json({
    success: true,
    message: "Theme updated successfully",
    data: { theme },
  });
});

/**
 * @route   PATCH /api/themes/:id/status
 * @desc    Update theme status
 * @access  Admin only
 */
export const updateThemeStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const theme = await updateThemeStatusService(
    
    req.params.id,
    status,
    req.user.userId
  );

  res.json({
    success: true,
    message: "Theme status updated successfully",
    data: { theme },
  });
});

/**
 * @route   PATCH /api/themes/:id/set-default
 * @desc    Set theme as default
 * @access  Admin only
 */
export const setDefaultTheme = asyncHandler(async (req, res) => {
  const theme = await setDefaultThemeService(req.params.id, req.user.userId);

  res.json({
    success: true,
    message: "Default theme set successfully",
    data: { theme },
  });
});

/**
 * @route   DELETE /api/themes/:id
 * @desc    Delete theme
 * @access  Admin only
 */
export const deleteTheme = asyncHandler(async (req, res) => {
  await deleteThemeService(req.params.id, req.user.userId);

  res.json({
    success: true,
    message: "Theme deleted successfully",
  });
});

/**
 * @route   POST /api/themes/:id/install
 * @desc    Install theme for current tenant
 * @access  Admin only
 */
export const installTheme = asyncHandler(async (req, res) => {
  logger.info("Theme install requested", {
    tenant: req.tenant._id,
    themeId: req.params.id,
  });

  const theme = await installThemeService(req.params.id, req.tenant._id);

  logger.info("Theme installed", { tenant: req.tenant._id, theme: theme.slug });

  res.json({
    success: true,
    message: "Theme installed and activated successfully",
    data: {
      theme,
      activeTheme: theme.slug,
    },
  });
});

/**
 * @route   POST /api/themes/:id/uninstall
 * @desc    Uninstall theme for current tenant
 * @access  Admin only
 */
export const uninstallTheme = asyncHandler(async (req, res) => {
  const theme = await uninstallThemeService(
    
    req.params.id,
    req.tenant._id
  );

  res.json({
    success: true,
    message: "Theme uninstalled successfully",
    data: { theme },
  });
});

/**
 * @route   GET /api/themes/search
 * @desc    Search themes
 * @access  Public
 */
export const searchThemes = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query;

  const result = await searchThemesService(q, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * @route   GET /api/themes/category/:category
 * @desc    Get themes by category
 * @access  Public
 */
export const getThemesByCategory = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const result = await getThemesByCategoryService(
    
    req.params.category,
    {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    }
  );

  res.json({
    success: true,
    data: result,
  });
});

