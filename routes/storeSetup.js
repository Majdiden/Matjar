import { Router } from "express";
import {
  getSetupStatusController,
  clearSetupStatusController,
} from "../controllers/storeSetup.js";

const storeSetupRoutes = Router();

// Get setup status (no auth required - used during initial setup before login)
storeSetupRoutes.get("/status/:tenantId", getSetupStatusController);

// Clear setup status (no auth required - cleanup after setup)
storeSetupRoutes.delete("/status/:tenantId", clearSetupStatusController);

export default storeSetupRoutes;
