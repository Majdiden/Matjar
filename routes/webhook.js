import { Router } from "express";
import * as WebhookController from "../controllers/webhook.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";

const router = Router();
router.use(authenticate, requirePermission("settings.write"));

router.get("/", WebhookController.list);
router.get("/:id", WebhookController.get);
router.post("/", WebhookController.create);
router.put("/:id", WebhookController.update);
router.patch("/:id", WebhookController.update);
router.delete("/:id", WebhookController.remove);
router.post("/:id/test", WebhookController.test);

export default router;
