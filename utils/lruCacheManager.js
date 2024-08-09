import { LRUCache } from "lru-cache";

const cacheOptions = {
  max: 5000,
  maxAge: 1000 * 60 * 60,
};

const cacheConnection = new LRUCache(cacheOptions);

const setCacheConnection = async (tenantId, dbConnetion) => {
  console.log("setting connection cache for: ", tenantId);
  return cacheConnection.set(tenantId, dbConnetion);
};

const getCacheConnection = async (tenantId) => {
  return cacheConnection.get(tenantId);
};

const getCacheValuesArr = async () => {
  return cacheConnection.values();
};

export { setCacheConnection, getCacheConnection, getCacheValuesArr };
