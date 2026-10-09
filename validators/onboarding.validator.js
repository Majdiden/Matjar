import { z } from "zod";
import { ONBOARDING_EVENT_NAMES } from "../services/onboarding.js";

/** POST /onboarding/events — one checklist event (PBI 10-17). */
export const recordOnboardingEventSchema = z.object({
  body: z.object({ event: z.enum(ONBOARDING_EVENT_NAMES) }).strict(),
});
