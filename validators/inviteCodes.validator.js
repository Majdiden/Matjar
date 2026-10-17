import { z } from "zod";
import { objectId } from "./platform.validator.js";
import { SIGNUP_MODES } from "../services/signupAccess.js";

export const listInviteCodesSchema = z.object({
  query: z.object({ promoterId: objectId.optional() }),
});

export const createInviteCodesSchema = z.object({
  body: z.object({
    count: z.number().int().min(1).max(20).optional().default(1),
    note: z.string().trim().max(120).nullable().optional(),
  }),
});

export const inviteCodeIdSchema = z.object({ params: z.object({ id: objectId }) });
export const codeStoreSchema = z.object({ params: z.object({ tenantId: objectId }) });

export const signupModeSchema = z.object({
  body: z.object({ mode: z.enum(SIGNUP_MODES) }),
});
