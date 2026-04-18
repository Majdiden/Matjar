import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import {
  getInventoryController,
  getLowStockController,
  getProductInventoryController,
  updateInventoryController,
  adjustStockController,
} from "../controllers/inventory.js";

const router = Router();

const canRead = requirePermission("inventory.read", "inventory.write");
const canWrite = requirePermission("inventory.write");

router.use(authenticate);

router.get("/", canRead, getInventoryController);
router.get("/low-stock", canRead, getLowStockController);
router.get("/:productId", canRead, getProductInventoryController);
router.put("/:productId", canWrite, updateInventoryController);
router.post("/:productId/adjust", canWrite, adjustStockController);

export default router;
