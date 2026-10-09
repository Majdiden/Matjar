import * as OnboardingService from "../services/onboarding.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

/**
 * Onboarding controllers (PBI 10-17). Dashboard-facing; tenant from the JWT.
 */

export const getOnboardingState = asyncHandler(async (req, res) => {
  const state = await OnboardingService.getOnboardingStateService(req.tenantId);
  res.json({ success: true, data: state });
});

export const recordOnboardingEvent = asyncHandler(async (req, res) => {
  const state = await OnboardingService.recordOnboardingEventService(req.tenantId, req.body.event);
  res.json({ success: true, data: state });
});
