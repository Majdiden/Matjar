const mainSchemaName = "User";

const getUsersRepo = async (dbConnection, selectQuery = {}, findQuery = {}) => {
  const data = await dbConnection
    .model(mainSchemaName)
    .find(findQuery)
    .select(selectQuery)
    .lean();
  return data;
};

const getAUserRepo = async (dbConnection, selectQuery = {}, findQuery = {}) => {
  const data = await dbConnection
    .model(mainSchemaName)
    .findOne(findQuery)
    .select(selectQuery)
    .lean();
  return data;
};

const addAUserRepo = async (dbConnection, tenantData, session = null) => {
  const sessionOption = {};
  if (session) sessionOption.session = session;
  const data = await dbConnection
    .model(mainSchemaName)
    .create([tenantData], sessionOption);
  return data[0];
};

const updateAUserRepo = async (
  dbConnection,
  findQuery = {},
  updateQuery = {}
) => {
  const data = await dbConnection
    .model(mainSchemaName)
    .updateOne(findQuery, updateQuery);
  return data;
};

export { getUsersRepo, getAUserRepo, addAUserRepo, updateAUserRepo };
