import { Router } from "express";
import { requireScope, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import * as c from "../../controllers/platform/announcements.js";
import { announcementAudienceSchema, sendAnnouncementSchema } from "../../validators/announcements.validator.js";

// Platform announcements to stores. Mounted at /api/platform/announcements
// behind platformAuthenticate.
const router = Router();
const send = requireScope(PLATFORM_SCOPES.ANNOUNCEMENTS_SEND);

router.get("/", send, c.list);
router.get("/audience", send, validate(announcementAudienceSchema), c.audience);
router.post("/", send, validate(sendAnnouncementSchema), c.send);

export default router;
