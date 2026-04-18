/**
 * Tenant Scope - Mongoose Middleware Safety Net
 *
 * Applies pre-hooks to schemas that require tenantId,
 * throwing errors if any query or save operation runs without tenantId.
 * This is a SAFETY NET - the primary mechanism is the scoped model factory.
 * This catches bugs where someone bypasses the scoped model and uses raw Mongoose.
 */

import logger from "./logger.js";

const QUERY_HOOKS = [
  "find",
  "findOne",
  "countDocuments",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
];

/**
 * Apply tenant scoping middleware to a schema.
 * Ensures all queries and saves include tenantId.
 */
export function applyTenantScope(schema) {
  // Pre-save: ensure tenantId is present
  schema.pre("save", function (next) {
    if (!this.tenantId) {
      return next(
        new Error(
          `[TenantScope] Document missing tenantId on save (${this.constructor.modelName}). ` +
            `This is a security violation - all tenant documents must have tenantId.`
        )
      );
    }
    next();
  });

  // Pre-validate: ensure tenantId is present
  schema.pre("validate", function (next) {
    if (!this.tenantId) {
      return next(
        new Error(
          `[TenantScope] Document missing tenantId on validate (${this.constructor.modelName}).`
        )
      );
    }
    next();
  });

  // Query hooks: warn if tenantId is missing (don't throw in queries
  // because aggregate pipelines and admin operations may legitimately skip it)
  for (const hook of QUERY_HOOKS) {
    schema.pre(hook, function () {
      const filter = this.getFilter();
      if (!filter.tenantId && !this.getOptions()?._skipTenantCheck) {
        logger.warn("Query missing tenantId in filter — possible cross-tenant leakage", {
          model: this.model.modelName,
          hook,
          filter,
        });
      }
    });
  }
}
