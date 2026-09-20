// Access programs. Mount: router.use("/programs", programRoutes) in routes/platformAdmin.js
// (after platformAuthenticate). Reads support.read; writes flags.write.
import { Router } from "express";
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  createProgramSchema,
  updateProgramSchema,
  closeProgramSchema,
  addMemberSchema,
  paginationQuerySchema,
  revokeSchema,
} from "../../validators/programs.validator.js";
import * as c from "../../controllers/platform/programs.js";

const router = Router();
const read = requireScope(PLATFORM_SCOPES.SUPPORT_READ);
const write = requireScope(PLATFORM_SCOPES.FLAGS_WRITE);

router.get("/", read, validate(paginationQuerySchema), c.list);
router.post("/", write, validate(createProgramSchema), c.create);
router.get("/:id", validateObjectId("id"), read, c.get);
router.patch("/:id", validateObjectId("id"), write, validate(updateProgramSchema), c.update);
router.post("/:id/close", validateObjectId("id"), write, validate(closeProgramSchema), c.close);
router.get("/:id/members", validateObjectId("id"), read, validate(paginationQuerySchema), c.members);
router.post("/:id/members", validateObjectId("id"), write, validate(addMemberSchema), c.addMember);
router.delete("/:id/members/:tenantId", validateObjectId("id", "tenantId"), write, validate(revokeSchema), c.removeMember);

export default router;
