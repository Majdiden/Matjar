import { Router } from "express";
import * as MenuController from "../controllers/menu.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validateObjectId } from "../middlewares/platformAdmin.js";

const router = Router();

// All admin menu routes require authentication
router.use(authenticate);

const vid = validateObjectId("id");

router.get("/", requirePermission("themes.read", "themes.write"), MenuController.list);
router.get("/by-location/:location", requirePermission("themes.read", "themes.write"), MenuController.getByLocation);
router.get("/:id", vid, requirePermission("themes.read", "themes.write"), MenuController.get);
router.post("/", requirePermission("themes.write"), MenuController.create);
router.put("/:id", vid, requirePermission("themes.write"), MenuController.update);
router.patch("/:id", vid, requirePermission("themes.write"), MenuController.update);
router.delete("/:id", vid, requirePermission("themes.write"), MenuController.remove);

export default router;
