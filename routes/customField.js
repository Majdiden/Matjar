import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { requireFeature } from "../middlewares/featureGate.js";
import { setCustomField, getCustomFields, deleteCustomField } from "../controllers/customField.js";

const router = Router();
router.use(authenticate, requirePermission("settings.write"), requireFeature("customFields"));

router.post("/", setCustomField);
router.get("/", getCustomFields);
router.delete("/:id", deleteCustomField);

export default router;
