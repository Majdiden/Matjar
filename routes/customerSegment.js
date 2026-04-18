import express from "express";
import * as Controller from "../controllers/customerSegment.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";

const router = express.Router();

const canRead = requirePermission("customers.read", "customers.write");
const canWrite = requirePermission("customers.write");

router.use(authenticate);

// Listing/preview — anyone with customer read access can scope audiences.
router.get("/", canRead, Controller.listSegments);
router.get("/:id", canRead, Controller.getSegment);
router.get("/:id/preview", canRead, Controller.previewSegment);
router.post("/preview", canRead, Controller.previewFilters);

// Mutations require customers.write (matches catalog wording).
router.post("/", canWrite, Controller.createSegment);
router.put("/:id", canWrite, Controller.updateSegment);
router.delete("/:id", canWrite, Controller.deleteSegment);

export default router;
