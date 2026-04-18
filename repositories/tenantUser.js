import mongoose from "mongoose";

const TenantUser = () => mongoose.model("TenantUser");

const getATenantUserRepo = async (findQuery = {}, selectQuery = {}) => {
  return await TenantUser().findOne(findQuery).select(selectQuery).lean();
};

const updateATenantUserRepo = async (findQuery = {}, updateQuery = {}) => {
  return await TenantUser().updateOne(findQuery, updateQuery);
};

const addATenantUserRepo = async (tenantData, session = null) => {
  const options = session ? { session } : {};
  const data = await TenantUser().create([tenantData], options);
  return data[0];
};

export { getATenantUserRepo, updateATenantUserRepo, addATenantUserRepo };
