import config from "../config/index.js";
import logger from "../utils/logger.js";

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Error Handler
 * Catches requests to undefined routes
 */
export const notFoundHandler = (req, res, next) => {
  const error = new APIError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    404
  );
  next(error);
};

/**
 * Global Error Handler
 * Catches all errors and sends appropriate response
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // If it's not an APIError, convert it
  if (!(error instanceof APIError)) {
    // Mongoose validation error
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      error = new APIError("Validation failed", 400, errors);
    }
    // Mongoose duplicate key error
    //
    // Almost every collection in this codebase uses compound indexes that
    // start with `tenantId` (so the same email/slug/orderNumber can exist
    // across tenants). Naively reading `Object.keys(keyPattern)[0]` always
    // returned "tenantId", which was actively misleading — the real
    // conflict was on the *second* key. Walk past tenantId to surface the
    // field that actually collided, and include the value when we have it.
    else if (error.code === 11000) {
      const keys = Object.keys(error.keyPattern || {});
      const field = keys.find((k) => k !== "tenantId") || keys[0] || "value";
      const value = error.keyValue?.[field];
      error = new APIError(
        `${field}${value !== undefined ? ` "${value}"` : ""} already exists. Please use a different value.`,
        409
      );
    }
    // Mongoose cast error
    else if (error.name === "CastError") {
      error = new APIError(`Invalid ${error.path}: ${error.value}`, 400);
    }
    // JWT errors
    else if (error.name === "JsonWebTokenError") {
      error = new APIError("Invalid token. Please login again.", 401);
    } else if (error.name === "TokenExpiredError") {
      error = new APIError("Token expired. Please login again.", 401);
    }
    // Generic error
    else {
      error = new APIError(
        config.isDevelopment ? error.message : "Internal server error",
        error.statusCode || 500
      );
    }
  }

  // Always log via the structured logger — in dev it pretty-prints,
  // in prod it ships JSON to stdout/stderr. The previous block was
  // dev-only and silently ate every prod error in the application
  // logs.
  logger.error("Request error", {
    message: error.message,
    statusCode: error.statusCode,
    stack: config.isDevelopment ? error.stack : undefined,
    errors: error.errors,
  });

  // Send error response
  const response = {
    success: false,
    message: error.message,
    ...(error.errors && { errors: error.errors }),
    ...(err.fieldErrors && { fieldErrors: err.fieldErrors }),
    ...(err.code && typeof err.code === "string" && { code: err.code }),
    ...(config.isDevelopment && { stack: error.stack }),
  };

  res.status(error.statusCode).json(response);
};

/**
 * Async handler wrapper
 * Catches async errors and passes them to error handler
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
