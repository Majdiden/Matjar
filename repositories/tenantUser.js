import mongoose from "mongoose";
const mainSchemaName = "TenantUser";

const getATenantUserRepo = async (
  dbConnection,
  findQuery = {},
  selectQuery = {}
) => {
  const data = await dbConnection
    .model(mainSchemaName)
    .findOne(findQuery)
    .select(selectQuery)
    .lean();
  return data;
};

const updateATenantUserRepo = async (
  dbConnection,
  findQuery = {},
  updateQuery = {}
) => {
  const data = await dbConnection
    .model(mainSchemaName)
    .updateOne(findQuery, updateQuery);
  return data;
};

const addATenantUserRepo = async (dbConnection, tenantData, session = null) => {
  const sessionOption = {};
  if (session) sessionOption.session = session;
  const data = await dbConnection
    .model(mainSchemaName)
    .create([tenantData], sessionOption);
  return data[0];
};

export { getATenantUserRepo, updateATenantUserRepo, addATenantUserRepo };
