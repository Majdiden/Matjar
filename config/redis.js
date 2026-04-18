import { createClient } from "redis";
import config from "./index.js";
import logger from "../utils/logger.js";

let redisClient;

const initRedis = async () => {
  if (redisClient) return redisClient;

  redisClient = createClient({
    url: config.redisUrl,
  });

  redisClient.on("error", (err) => logger.error("Redis client error", { error: err.message }));
  redisClient.on("connect", () => logger.info("Redis client connected"));

  await redisClient.connect();

  return redisClient;
};

export { initRedis, redisClient };
