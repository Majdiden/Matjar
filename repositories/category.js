const addCategoryRepo = async (models, categoryData, session = null) => {
  const options = session ? { session } : {};
  const data = await models.Category.create(categoryData, options);
  return Array.isArray(data) ? data[0] : data;
};

const getCategoryRepo = async (models, selectQuery = {}, findQuery = {}) => {
  return await models.Category.findOne(findQuery).select(selectQuery).lean();
};

const getCategoriesRepo = async (models, selectQuery = {}, findQuery = {}) => {
  return await models.Category.find(findQuery).select(selectQuery).lean();
};

const updateCategoryRepo = async (models, findQuery = {}, updateQuery = {}) => {
  return await models.Category.updateOne(findQuery, updateQuery);
};

const deleteCategoryRepo = async (models, findQuery = {}) => {
  return await models.Category.deleteOne(findQuery);
};

export {
  addCategoryRepo,
  getCategoryRepo,
  getCategoriesRepo,
  updateCategoryRepo,
  deleteCategoryRepo,
};
