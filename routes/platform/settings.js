// Global configuration registry. Reads: support.read. Writes: flags.write +
// a fresh re-authentication (these are platform-wide knobs).
import { Router } from "express";
import { requireScope, requireRecentReauth, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import { updateSettingsSchema } from "../../validators/settings.validator.js";
import { getPlatformSettings, updatePlatformSettings } from "../../controllers/platform/settings.js";

const router = Router();

router.get("/", requireScope(PLATFORM_SCOPES.SUPPORT_READ), getPlatformSettings);
router.put(
  "/",
  requireScope(PLATFORM_SCOPES.FLAGS_WRITE),
  requireRecentReauth,
  validate(updateSettingsSchema),
  updatePlatformSettings
);

export default router;
