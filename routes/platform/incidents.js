import { Router } from "express";
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import * as c from "../../controllers/platform/incidents.js";
import {
  createIncidentSchema,
  updateIncidentSchema,
  incidentTimelineSchema,
  resolveIncidentSchema,
  listIncidentsSchema,
  incidentIdSchema,
} from "../../validators/incidents.validator.js";

// Platform incidents. Mounted at /api/platform/incidents behind
// platformAuthenticate. Reads: support.read. Writes: tenant.lifecycle.
const router = Router();
const read = requireScope(PLATFORM_SCOPES.SUPPORT_READ);
const write = requireScope(PLATFORM_SCOPES.TENANT_LIFECYCLE);

router.get("/", read, validate(listIncidentsSchema), c.list);
router.get("/open-summary", read, c.openSummary);
router.post("/", write, validate(createIncidentSchema), c.create);
router.get("/:id", read, validateObjectId("id"), validate(incidentIdSchema), c.get);
router.patch("/:id", write, validateObjectId("id"), validate(updateIncidentSchema), c.update);
router.post("/:id/timeline", write, validateObjectId("id"), validate(incidentTimelineSchema), c.addTimeline);
router.post("/:id/resolve", write, validateObjectId("id"), validate(resolveIncidentSchema), c.resolve);

export default router;
