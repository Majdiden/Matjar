import { Router } from "express";
import {
  getSetupStatusController,
  clearSetupStatusController,
  publishStarterController,
  starterStatusController,
  setupSessionController,
} from "../controllers/storeSetup.js";
import { loginLimiter } from "../middlewares/rateLimiters.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";

const storeSetupRoutes = Router();

// Get setup status (no auth required - used during initial setup before login)
storeSetupRoutes.get("/status/:tenantId", getSetupStatusController);

// Draft-starter status + owner preview URL for the dashboard publish banner.
storeSetupRoutes.get("/starter", authenticate, starterStatusController);

// First dashboard session after signup: exchanges the one-time setup token
// (single use, 1 h) so the browser never has to keep the password. Same
// brute-force budget as login.
storeSetupRoutes.post("/session", loginLimiter, setupSessionController);

// Clear setup status (no auth required - cleanup after setup)
storeSetupRoutes.delete("/status/:tenantId", clearSetupStatusController);

// Publish the draft starter content seeded at signup — take the store live.
// Dashboard-authenticated; reuses settings.write (the same permission that
// gates store-wide configuration changes).
storeSetupRoutes.post(
  "/publish-starter",
  authenticate,
  requirePermission("settings.write"),
  publishStarterController
);

export default storeSetupRoutes;
