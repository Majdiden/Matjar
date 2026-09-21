import { z } from "zod";
import { SETTING_KEYS } from "../config/platformSettingsRegistry.js";

// Values are validated against the registry bounds in the service; here we
// only pin the envelope shape and the key set so garbage never reaches it.
export const updateSettingsSchema = z.object({
  body: z.object({
    updates: z
      .array(
        z.object({
          key: z.enum(SETTING_KEYS),
          value: z.union([z.number(), z.array(z.string().max(64)).max(200), z.null()]),
        })
      )
      .min(1)
      .max(50),
    reason: z.string().trim().min(4).max(500),
  }),
});
