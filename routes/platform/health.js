import { Router } from "express";
// System health + integration status. Read-only; support.read. Mounted at
// /api/platform/system behind platformAuthenticate. Never returns config values.
import { requireScope, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { systemHealth, systemIntegrations } from "../../controllers/platform/health.js";

const router = Router({ mergeParams: true });

router.use(requireScope(PLATFORM_SCOPES.SUPPORT_READ));
router.get("/health", systemHealth);
router.get("/integrations", systemIntegrations);

export default router;
