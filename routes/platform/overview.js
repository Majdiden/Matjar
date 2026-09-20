import { Router } from "express";
import { requireScope, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { getSummary } from "../../controllers/platform/overview.js";

// Overview tiles + alerts. Read-only; mounted behind platformAuthenticate.
const router = Router({ mergeParams: true });

router.get("/summary", requireScope(PLATFORM_SCOPES.SUPPORT_READ), getSummary);

export default router;
