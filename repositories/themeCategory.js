import mongoose from "mongoose";

/** Admin-DB access for platform-managed theme categories (schemas/themeCategory.js). */
const ThemeCategory = () => mongoose.model("ThemeCategory");
const Theme = () => mongoose.model("Theme");

export const countThemeCategoriesRepo = () => ThemeCategory().estimatedDocumentCount();

/** Insert the docs whose key is not taken yet (never overwrites). */
export async function insertMissingThemeCategoriesRepo(docs) {
  if (!docs.length) return 0;
  const res = await ThemeCategory().bulkWrite(
    docs.map((doc) => ({ updateOne: { filter: { key: doc.key }, update: { $setOnInsert: doc }, upsert: true } })),
    { ordered: false }
  );
  return res.upsertedCount || 0;
}

export const listThemeCategoriesRepo = (filter = {}) =>
  ThemeCategory().find(filter).sort({ order: 1, createdAt: 1, key: 1 }).lean();

export const findThemeCategoryRepo = (key) => ThemeCategory().findOne({ key }).lean();

export const createThemeCategoryRepo = async (doc) => (await ThemeCategory().create(doc)).toObject();

export const updateThemeCategoryRepo = (key, set) =>
  ThemeCategory().findOneAndUpdate({ key }, { $set: set }, { new: true, runValidators: true }).lean();

export const deleteThemeCategoryRepo = (key) => ThemeCategory().deleteOne({ key });

export async function maxThemeCategoryOrderRepo() {
  const top = await ThemeCategory().findOne({}).sort({ order: -1 }).select("order").lean();
  return top ? top.order : -1;
}

export async function setThemeCategoryOrderRepo(keys, updatedBy) {
  if (!keys.length) return;
  await ThemeCategory().bulkWrite(
    keys.map((key, i) => ({ updateOne: { filter: { key }, update: { $set: { order: i, updatedBy } } } }))
  );
}

/** Themes as the category resolver needs them. */
export const listThemesForCategoriesRepo = (filter = {}) =>
  Theme().find(filter).select("slug name status categories categoryKeys").lean();

export const findThemeForCategoriesRepo = (themeId) =>
  Theme().findById(themeId).select("slug name categories categoryKeys").lean();

export const setThemeCategoryKeysRepo = (themeId, categoryKeys) =>
  Theme().findByIdAndUpdate(themeId, { $set: { categoryKeys } }, { new: true }).select("slug name categories categoryKeys").lean();

/** Drop a deleted category from every explicit theme assignment. */
export async function pullCategoryFromThemesRepo(key) {
  const res = await Theme().updateMany({ categoryKeys: key }, { $pull: { categoryKeys: key } });
  return res.modifiedCount || 0;
}
