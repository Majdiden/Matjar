import mongoose from "mongoose";
import { addATenantRepo, getATenantRepo } from "../repositories/tenant.js";
import { addATenantUserRepo } from "../repositories/tenantUser.js";
import { addAUserRepo } from "../repositories/user.js";
import { setCacheConnection } from "../utils/lruCacheManager.js";
import {
  initAdminDbConnection,
  initTenantDbConnection,
} from "../utils/initDbConnection.js";

const addATenantService = async (dbConnection, tenantData) => {
  const session = await dbConnection.startSession();
  console.log(session);
  session.startTransaction();
  try {
    const data = await addATenantRepo(dbConnection, { ...tenantData }, session);
    let userData;
    if (data._id) {
      userData = await addATenantUserRepo(
        dbConnection,
        { id: data._id, email: tenantData.email, name: tenantData.name },
        session
      );
      const tenantDbConnection = await initTenantDbConnection(
        data.dbUri,
        data.name
      );
      await addAUserRepo(tenantDbConnection, {
        id: userData._id,
        name: tenantData.name,
        email: tenantData.email,
        password: tenantData.password,
        roles: "admin",
      });
      await session.commitTransaction();
      await session.endSession();
      setCacheConnection(data._id.toString(), tenantDbConnection);
    }
    return {
      success: true,
      statusCode: 201,
      message: `Tenant added successfully`,
      responseObject: { tenantId: data._id, userId: userData?._id },
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export { addATenantService };
