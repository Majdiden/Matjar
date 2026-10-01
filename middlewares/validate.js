import { z } from "zod";
import { APIError } from "./errorHandler.js";

// Zod's built-in English messages ("Too small: expected string to have
// >=10 characters") are developer-facing. Each validation entry therefore
// also carries the issue's code and parameters so clients can render a
// localized, merchant-friendly message; `custom` marks messages a schema
// author wrote by hand, which English clients may show verbatim.
const zodDefaultMessage = z.locales.en().localeError;
const ISSUE_PARAMS = ["origin", "minimum", "maximum", "inclusive", "exact", "expected", "format", "values", "keys", "divisor"];

const defaultMessageFor = (issue) => {
  try {
    const d = zodDefaultMessage(issue);
    return typeof d === "string" ? d : d?.message;
  } catch {
    return undefined;
  }
};

export const toValidationEntry = (issue) => {
  const entry = {
    field: Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path || ""),
    message: issue.message,
    code: issue.code,
  };
  for (const k of ISSUE_PARAMS) {
    if (issue[k] === undefined) continue;
    // Bigints (and Dates) don't survive JSON.stringify as-is.
    entry[k] = typeof issue[k] === "bigint" ? Number(issue[k]) : issue[k] instanceof Date ? issue[k].toISOString() : issue[k];
  }
  if (issue.code === "invalid_type" && /received undefined/.test(issue.message || "")) entry.missing = true;
  entry.custom = issue.code === "custom" || (!!issue.message && issue.message !== defaultMessageFor(issue) && !/^Invalid input: expected /.test(issue.message));
  return entry;
};

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
        const errors = issues.map(toValidationEntry);
        const apiErr = new APIError("Validation failed", 400, errors);
        apiErr.code = "VALIDATION_FAILED";
        return next(apiErr);
      }
      next(error);
    }
  };
};
