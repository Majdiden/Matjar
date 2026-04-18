import mongoose from "mongoose";

const Tenant = () => mongoose.model("Tenant");

const getTenantsRepo = async (selectQuery = {}, findQuery = {}) => {
  return await Tenant().find(findQuery).select(selectQuery).lean();
};

const getATenantRepo = async (selectQuery = {}, findQuery = {}) => {
  return await Tenant().findOne(findQuery).select(selectQuery).lean();
};

const addATenantRepo = async (tenantData, session = null) => {
  const options = session ? { session } : {};
  const data = await Tenant().create([tenantData], options);
  return data[0];
};

const updateATenantRepo = async (findQuery = {}, updateQuery = {}) => {
  return await Tenant().updateOne(findQuery, updateQuery);
};

export { getTenantsRepo, getATenantRepo, addATenantRepo, updateATenantRepo };
