import mongoose from "mongoose";

const Theme = () => mongoose.model("Theme");

export const createThemeRepo = async (themeData) => {
  const theme = new (Theme())(themeData);
  return await theme.save();
};

export const getThemeByIdRepo = async (themeId) => {
  return await Theme().findById(themeId);
};

export const getThemeBySlugRepo = async (slug) => {
  return await Theme().findOne({ slug, status: "active" });
};

export const getDefaultThemeRepo = async () => {
  return await Theme().getDefault();
};

export const getActiveThemesRepo = async (filters = {}) => {
  return await Theme().find({ status: "active", isPublished: true, ...filters })
    .sort({ "statistics.rating": -1 });
};

export const getThemesRepo = async ({ page = 1, limit = 20, sort = "-createdAt", filters = {} }) => {
  const skip = (page - 1) * limit;
  const [themes, total] = await Promise.all([
    Theme().find(filters).sort(sort).skip(skip).limit(limit),
    Theme().countDocuments(filters),
  ]);
  return { themes, pagination: { total, page, pages: Math.ceil(total / limit), limit } };
};

export const updateThemeRepo = async (themeId, updates) => {
  return await Theme().findByIdAndUpdate(themeId, updates, { new: true, runValidators: true });
};

export const updateThemeStatusRepo = async (themeId, status) => {
  return await Theme().findByIdAndUpdate(themeId, { status }, { new: true });
};

export const deleteThemeRepo = async (themeId) => {
  return await Theme().findByIdAndDelete(themeId);
};

export const setDefaultThemeRepo = async (themeId) => {
  await Theme().updateMany({}, { isDefault: false });
  return await Theme().findByIdAndUpdate(themeId, { isDefault: true }, { new: true });
};

export const incrementThemeInstallsRepo = async (themeId) => {
  return await Theme().incrementInstalls(themeId);
};

export const decrementThemeInstallsRepo = async (themeId) => {
  return await Theme().decrementInstalls(themeId);
};

export const searchThemesRepo = async (searchQuery, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const searchRegex = new RegExp(searchQuery, "i");
  const query = {
    status: "active",
    isPublished: true,
    $or: [
      { name: searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
      { author: searchRegex },
    ],
  };
  const [themes, total] = await Promise.all([
    Theme().find(query).sort({ "statistics.rating": -1 }).skip(skip).limit(limit),
    Theme().countDocuments(query),
  ]);
  return { themes, pagination: { total, page, pages: Math.ceil(total / limit), limit } };
};

export const getThemesByCategoryRepo = async (category, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const query = { status: "active", isPublished: true, categories: category };
  const [themes, total] = await Promise.all([
    Theme().find(query).sort({ "statistics.rating": -1 }).skip(skip).limit(limit),
    Theme().countDocuments(query),
  ]);
  return { themes, pagination: { total, page, pages: Math.ceil(total / limit), limit } };
};

export const getPopularThemesRepo = async (limit = 10) => {
  return await Theme().find({ status: "active", isPublished: true })
    .sort({ "statistics.installCount": -1, "statistics.rating": -1 })
    .limit(limit);
};

export const getLatestThemesRepo = async (limit = 10) => {
  return await Theme().find({ status: "active", isPublished: true })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// ─── Catalog-sync helpers (services/themeCatalogSync.js) ───────────

/**
 * Upsert a catalog row by slug. `set` carries the manifest-owned fields
 * (identity + presentation) applied on every sync; `setOnInsert` carries
 * DB-owned fields that only receive their initial value when the row is
 * first created (status, isDefault, pricing, statistics defaults, ...).
 */
export const upsertThemeBySlugRepo = async (slug, { set = {}, setOnInsert = {} } = {}) => {
  return await Theme().findOneAndUpdate(
    { slug },
    { $set: set, $setOnInsert: setOnInsert },
    { upsert: true, new: true }
  );
};

/**
 * Re-activate a row that THIS sync previously marked inactive because
 * its manifest had disappeared (tracked via `catalogSync.missingSince`).
 * Rows an operator deactivated by hand carry no marker and are left
 * alone — `status` stays DB-owned.
 */
export const reactivateSyncedThemeRepo = async (slug) => {
  return await Theme().updateOne(
    { slug, status: "inactive", "catalogSync.missingSince": { $exists: true, $ne: null } },
    { $set: { status: "active" }, $unset: { "catalogSync.missingSince": "" } }
  );
};

/**
 * Mark catalog rows whose manifest is no longer on disk as inactive,
 * stamping `catalogSync.missingSince` so a later sync can distinguish
 * "we deactivated this" from an operator's manual deactivation.
 */
export const markMissingThemesInactiveRepo = async (presentSlugs, missingSince) => {
  return await Theme().updateMany(
    { slug: { $nin: presentSlugs }, status: "active" },
    { $set: { status: "inactive", "catalogSync.missingSince": missingSince } }
  );
};

export const countDefaultThemesRepo = async () => {
  return await Theme().countDocuments({ isDefault: true, status: "active" });
};

export const setThemeDefaultBySlugRepo = async (slug) => {
  return await Theme().updateOne({ slug, status: "active" }, { $set: { isDefault: true } });
};

export const themeSlugExistsRepo = async (slug, excludeId = null) => {
  const query = { slug };
  if (excludeId) query._id = { $ne: excludeId };
  return (await Theme().countDocuments(query)) > 0;
};
