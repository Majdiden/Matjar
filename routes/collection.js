import { Router } from "express";
import * as CollectionController from "../controllers/collection.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validateObjectId } from "../middlewares/platformAdmin.js";

const router = Router();

// All admin collection routes require authentication
router.use(authenticate);

const vid = validateObjectId("id");

// Read routes — products.read permission
router.get("/", requirePermission("products.read"), CollectionController.list);
router.get("/:id/preview", vid, requirePermission("products.read"), CollectionController.preview);
router.get("/:id", vid, requirePermission("products.read"), CollectionController.get);

// Write routes — products.write permission
router.post("/", requirePermission("products.write"), CollectionController.create);
router.put("/:id", vid, requirePermission("products.write"), CollectionController.update);
router.patch("/:id", vid, requirePermission("products.write"), CollectionController.update);
router.delete("/:id", vid, requirePermission("products.write"), CollectionController.remove);

// Product membership management
router.post("/:id/products", vid, requirePermission("products.write"), CollectionController.addProducts);
router.delete("/:id/products", vid, requirePermission("products.write"), CollectionController.removeProducts);
router.put("/:id/products/order", vid, requirePermission("products.write"), CollectionController.reorderProducts);

export default router;
