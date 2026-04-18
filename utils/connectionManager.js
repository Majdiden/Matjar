import mongoose from "mongoose";
import config from "../config/index.js";
import { registerAllModels } from "./initDbConnection.js";
import logger from "./logger.js";

let connection;

/**
 * Connect to the single shared database and register all models.
 */
export const connectDb = async () => {
  try {
    logger.info("Connecting to database");
    connection = await mongoose.connect(config.dbUri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
    });
    registerAllModels(mongoose.connection);
    logger.info("Database connected and models registered");
  } catch (error) {
    logger.error("Failed to connect to database", { error: error.message });
    throw error;
  }
};

/**
 * Get the shared database connection.
 */
export const getConnection = () => {
  return mongoose.connection;
};

/**
 * Gracefully close the database connection.
 */
export const gracefulShutdown = async () => {
  logger.info("Closing database connection");
  await mongoose.connection.close();
  logger.info("Database connection closed");
};

let isShutdownInProgress = false;
["SIGINT", "SIGTERM", "SIGQUIT", "SIGUSR2"].forEach((signal) => {
  process.on(signal, async () => {
    if (!isShutdownInProgress) {
      logger.info("Received shutdown signal", { signal });
      isShutdownInProgress = true;
      await gracefulShutdown();
      process.exit(0);
    }
  });
});
