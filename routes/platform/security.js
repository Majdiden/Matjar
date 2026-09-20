import { Router } from "express";
import { requireRole, requireRecentReauth, requireScope, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import { securitySettingsSchema } from "../../validators/platform.validator.js";
import { getSecurity, updateSecurity } from "../../controllers/platform/security.js";

/**
 * Platform security settings — mounted at /api/platform/security behind
 * platformAuthenticate. Readable by anyone who can manage platform users;
 * writable by OWNER only and only after recent re-authentication.
 */
const router = Router({ mergeParams: true });

router.get("/settings", requireScope(PLATFORM_SCOPES.PLATFORM_USERS), getSecurity);
router.put("/settings", requireRole("owner"), requireRecentReauth, validate(securitySettingsSchema), updateSecurity);

export default router;
