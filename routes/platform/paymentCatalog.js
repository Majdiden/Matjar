import { Router } from "express";
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import { uploadSingleLogo, handleUploadError, validateUploadedFiles } from "../../middlewares/upload.js";
import { createCatalogEntrySchema, updateCatalogEntrySchema, catalogIdSchema } from "../../validators/paymentCatalog.validator.js";
import * as c from "../../controllers/platform/paymentCatalog.js";

const router = Router();
const write = requireScope(PLATFORM_SCOPES.PAYMENTS_WRITE);

router.get("/", requireScope(PLATFORM_SCOPES.SUPPORT_READ), c.list);
router.post("/", write, validate(createCatalogEntrySchema), c.create);
router.patch("/:id", write, validateObjectId("id"), validate(updateCatalogEntrySchema), c.update);
router.delete("/:id", write, validateObjectId("id"), validate(catalogIdSchema), c.remove);
router.post("/:id/logo", write, validateObjectId("id"), uploadSingleLogo, handleUploadError, validateUploadedFiles, c.uploadLogo);

export default router;
