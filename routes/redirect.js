import { Router } from "express";
import * as RedirectController from "../controllers/redirect.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validateObjectId } from "../middlewares/platformAdmin.js";

/**
 * URL redirect routes (audit 6.7). Gated on the `themes.*` bucket — the
 * redirects table lives under Storefront in the dashboard, and the roles
 * that manage storefront navigation/pages manage its redirects.
 */
const router = Router();

router.use(authenticate);

const vid = validateObjectId("id");

router.get("/", requirePermission("themes.read", "themes.write"), RedirectController.list);
router.get("/:id", vid, requirePermission("themes.read", "themes.write"), RedirectController.get);
router.post("/", requirePermission("themes.write"), RedirectController.create);
router.put("/:id", vid, requirePermission("themes.write"), RedirectController.update);
router.patch("/:id", vid, requirePermission("themes.write"), RedirectController.update);
router.delete("/:id", vid, requirePermission("themes.write"), RedirectController.remove);

export default router;
