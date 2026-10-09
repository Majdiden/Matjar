import express from "express";
import * as StoreProfileController from "../controllers/storeProfile.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { updateStoreProfileSchema } from "../validators/storeProfile.validator.js";

/**
 * Store profile / brand kit (PBI 10). Same permissions as the general store
 * settings (routes/settings.js). Not feature-gated: it is data only — the
 * `design.simpleMode` flag gates the dashboard UI that edits it.
 */
const router = express.Router();

const canRead = requirePermission("settings.read", "settings.write");
const canWrite = requirePermission("settings.write");

router.use(authenticate);
router.get("/", canRead, StoreProfileController.getStoreProfile);
router.put("/", canWrite, validate(updateStoreProfileSchema), StoreProfileController.updateStoreProfile);

export default router;
