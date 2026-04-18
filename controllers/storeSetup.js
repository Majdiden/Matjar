import { getSetupStatus, clearSetupStatus } from "../services/storeSetup.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

/**
 * Get store setup status
 * Returns the current status of store setup for a tenant
 */
export const getSetupStatusController = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  // Token comes from the registration response — the dashboard echoes it
  // back as ?token=... on every poll.
  const token = req.query.token;

  const status = await getSetupStatus(tenantId, token);

  if (!status.found) {
    // Same 404 response whether the tenant doesn't exist OR the token is
    // wrong — never leak which case it was, otherwise an attacker can
    // enumerate valid tenantIds.
    return res.status(404).json({
      success: false,
      message: "Setup status not found. Setup may have already completed or never started.",
    });
  }

  res.json({
    success: true,
    message: "Setup status retrieved successfully",
    responseObject: status,
  });
});

/**
 * Clear setup status (cleanup after viewing)
 */
export const clearSetupStatusController = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  const token = req.query.token;

  const result = await clearSetupStatus(tenantId, token);

  if (!result.cleared) {
    return res.status(404).json({
      success: false,
      message: "Setup status not found.",
    });
  }

  res.json({
    success: true,
    message: "Setup status cleared successfully",
  });
});
