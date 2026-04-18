const getAUserRepo = async (models, findQuery = {}, selectQuery = {}) => {
  return await models.User.findOne(findQuery).select(selectQuery).lean();
};

const getUsersRepo = async (models, findQuery = {}, selectQuery = {}) => {
  return await models.User.find(findQuery).select(selectQuery).lean();
};

const addAUserRepo = async (models, userData, session = null) => {
  const options = session ? { session } : {};
  const data = await models.User.create(userData, options);
  return Array.isArray(data) ? data[0] : data;
};

const updateAUserRepo = async (models, findQuery = {}, updateQuery = {}) => {
  return await models.User.updateOne(findQuery, updateQuery);
};

export { getAUserRepo, getUsersRepo, addAUserRepo, updateAUserRepo };
