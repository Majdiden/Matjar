import { z } from "zod";
import { objectId, reason } from "./platform.validator.js";


export const privacyLookupSchema = z.object({
  params: z.object({ tenantId: objectId }),
  query: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
  }),
});

export const privacyActionSchema = z.object({
  params: z.object({ tenantId: objectId, userId: objectId }),
  body: z.object({ reason }),
});
