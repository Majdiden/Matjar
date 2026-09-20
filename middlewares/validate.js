import { APIError } from "./errorHandler.js";

/**
 * Validation middleware factory
 * Validates request against Zod schema
 * @param {ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      // Validate request data against schema
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Write the parsed sections BACK so zod transforms (.trim(),
      // .toLowerCase(), .default()) are effective for controllers, not
      // cosmetic. Merged over the raw object so keys a schema doesn't
      // declare are preserved (zod strips unknown keys by default).
      for (const key of ["body", "query", "params"]) {
        if (parsed && parsed[key] && typeof parsed[key] === "object" && req[key] && typeof req[key] === "object") {
          Object.assign(req[key], parsed[key]);
        }
      }
      next();
    } catch (error) {
      // ZodError exposes the per-field problems on `.issues` in v4 and on
      // `.errors` in v3 — handle both so a Zod version bump can't silently
      // turn our 400 validation responses into 500s. The previous code only
      // checked `.errors` and so any v4 Zod failure fell through to the
      // generic error handler.
      const issues = error?.issues || error?.errors;
      if (Array.isArray(issues)) {
        const errors = issues.map((err) => ({
          field: Array.isArray(err.path) ? err.path.join(".") : String(err.path || ""),
          message: err.message,
        }));
        return next(new APIError("Validation failed", 400, errors));
      }
      next(error);
    }
  };
};
