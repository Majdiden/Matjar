import { z } from "zod";
import { objectId, reason } from "./platform.validator.js";

export const BULK_ACTIONS = [
  "suspend",
  "unsuspend",
  "schedule_deletion",
  "cancel_deletion",
  "add_to_program",
  "remove_from_program",
  "change_plan",
  "cancel_plan_change",
];
export const BULK_MAX_TENANTS = 50;
// Mirrors the single-tenant schedule-deletion window in services/tenantLifecycle.js.
export const BULK_MIN_GRACE_DAYS = 1;
export const BULK_MAX_GRACE_DAYS = 90;

const planKey = z.string().trim().toLowerCase().min(1).max(64).regex(/^[a-z0-9][a-z0-9-_]*$/);

export const bulkTenantsSchema = z.object({
  body: z
    .object({
      action: z.enum(BULK_ACTIONS),
      tenantIds: z.array(objectId).min(1).max(BULK_MAX_TENANTS),
      reason,
      params: z
        .object({
          programId: objectId.optional(),
          planKey: planKey.optional(),
          effectiveAt: z.enum(["immediately", "next_period"]).optional(),
          graceDays: z.coerce.number().int().min(BULK_MIN_GRACE_DAYS).max(BULK_MAX_GRACE_DAYS).optional(),
        })
        .default({}),
    })
    .superRefine((b, ctx) => {
      if (new Set(b.tenantIds).size !== b.tenantIds.length) {
        ctx.addIssue({ code: "custom", path: ["tenantIds"], message: "Duplicate tenant ids" });
      }
      if ((b.action === "add_to_program" || b.action === "remove_from_program") && !b.params.programId) {
        ctx.addIssue({ code: "custom", path: ["params", "programId"], message: "programId is required" });
      }
      if (b.action === "change_plan" && !b.params.planKey) {
        ctx.addIssue({ code: "custom", path: ["params", "planKey"], message: "planKey is required" });
      }
    }),
});

// ─── Permanent deletion (bulk) ─────────────────────────────────────
// Kept OUT of BULK_ACTIONS: those are reversible and run under re-auth;
// permanent deletion has its own route, scope (tenant.delete) and a
// password confirmation. A smaller cap keeps one request well inside HTTP
// timeouts (each store wipes many collections and its files).
export const BULK_DELETE_MAX_TENANTS = 20;

/** Phrase the operator must type, e.g. "delete 3 stores". Mirrored in platform-admin. */
export const bulkDeleteConfirmationPhrase = (count) => `delete ${count} ${count === 1 ? "store" : "stores"}`;

export const bulkDeleteTenantsSchema = z.object({
  body: z
    .object({
      tenantIds: z.array(objectId).min(1).max(BULK_DELETE_MAX_TENANTS),
      reason,
      confirmation: z.string().trim().toLowerCase().max(100),
      password: z.string().min(1).max(1024),
    })
    .superRefine((b, ctx) => {
      if (new Set(b.tenantIds).size !== b.tenantIds.length) {
        ctx.addIssue({ code: "custom", path: ["tenantIds"], message: "Duplicate tenant ids" });
      }
      if (b.confirmation !== bulkDeleteConfirmationPhrase(b.tenantIds.length)) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmation"],
          message: `Type "${bulkDeleteConfirmationPhrase(b.tenantIds.length)}" to confirm`,
        });
      }
    }),
});
