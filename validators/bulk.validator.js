import { z } from "zod";
import { objectId, reason } from "./platform.validator.js";

export const BULK_ACTIONS = ["suspend", "unsuspend", "add_to_program", "remove_from_program", "change_plan"];
export const BULK_MAX_TENANTS = 50;

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
