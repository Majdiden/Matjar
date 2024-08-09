import mongoose from "mongoose";
import {
  initAdminDbConnection,
  initTenantDbConnection,
} from "./initDbConnection.js";
import { getTenantsRepo, getATenantRepo } from "../repositories/tenant.js";
import {
  setCacheConnection,
  getCacheConnection,
  getCacheValuesArr,
} from "./lruCacheManager.js";

let adminDbConnection;

export const connectAllDb = async () => {
  const ADMIN_DB_URI =
    "mongodb+srv://admin:admin@devdb01.cdzut.mongodb.net/Matjar?retryWrites=true&w=majority";
  adminDbConnection = await initAdminDbConnection(ADMIN_DB_URI);
  const allTenants = await getTenantsRepo(adminDbConnection);
  for (const tenant of allTenants) {
    const tenantConnection = initTenantDbConnection(tenant.dbUri, tenant.name);
    setCacheConnection(tenant._id.toString(), tenantConnection);
  }
};

export const getConnectionForTenant = async (tenantId) => {
  console.log(`Getting connection for tenant: ${tenantId} from cache`);
  let connection = getCacheConnection(tenantId);
  if (!connection) {
    console.log(`Connection for tenant: ${tenantId} missing from cache`);
    const tenant = await getATenantRepo(
      adminDbConnection,
      { _id: tenantId },
      { dbUri: 1, name: 1 }
    );
    if (tenant) {
      connection = initTenantDbConnection(tenant.dbUri, tenant.name);
      if (!connection) return null;
      console.log(`Connection for tenant: ${tenantId} added to cache`);
    } else {
      console.log(`No connection data for tenant: ${tenantId}`);
      return null;
    }
  }
  return connection;
};

export const getAdminConnection = () => {
  console.log("Getting admin connection");
  return adminDbConnection;
};

export const gracefulShutdown = async () => {
  console.log("Closing all database connections...");
  const connections = getCacheValuesArr();
  for (const connection of connections) {
    await connection.close();
  }
  if (adminDbConnection) {
    console.log("Closing admin database connection...");
    await adminDbConnection.close();
  }
  console.log("All database connections closed");
};

let isShutdownInProgress = false;
["SIGINT", "SIGTERM", "SIGQUIT", "SIGUSR2"].forEach((signal) => {
  process.on(signal, async () => {
    if (!isShutdownInProgress) {
      console.log(`Received ${signal}, gracefully shutting down...`);
      isShutdownInProgress = true;
      await gracefulShutdown();
      process.exit(0);
    }
  });
});
