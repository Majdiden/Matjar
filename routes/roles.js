import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { requireFeature } from "../middlewares/featureGate.js";
import {
  listRolesController,
  createRoleController,
  updateRoleController,
  deleteRoleController,
} from "../controllers/roles.js";

const router = Router();

// Role management is itself a permission — `team.manage`. Only users
// with that permission (default: admin, managers if granted) can see
// or mutate the role catalog.
router.use(authenticate);

router.get("/", requirePermission("team.manage"), listRolesController);
router.post("/", requirePermission("team.manage"), requireFeature("team.advancedRoles"), createRoleController);
router.patch("/:id", requirePermission("team.manage"), requireFeature("team.advancedRoles"), updateRoleController);
router.delete("/:id", requirePermission("team.manage"), requireFeature("team.advancedRoles"), deleteRoleController);

export default router;
