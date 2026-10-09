import express from "express";
import * as OnboardingController from "../controllers/onboarding.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { recordOnboardingEventSchema } from "../validators/onboarding.validator.js";

/**
 * Guided onboarding state (PBI 10-17): what the "first sale" checklist can't
 * infer from other data. Anyone who can see the store settings can read and
 * report it — events only stamp first-time timestamps. Not feature-gated: it
 * is data only; `onboarding.v2` gates the checklist UI.
 */
const router = express.Router();

const canUse = requirePermission("settings.read", "settings.write");

router.use(authenticate);
router.get("/", canUse, OnboardingController.getOnboardingState);
router.post("/events", canUse, validate(recordOnboardingEventSchema), OnboardingController.recordOnboardingEvent);

export default router;
