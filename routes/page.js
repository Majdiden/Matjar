import { Router } from "express";
import * as PageController from "../controllers/page.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validateObjectId } from "../middlewares/platformAdmin.js";
import { validate } from "../middlewares/validate.js";
import { createPageSchema, updatePageSchema } from "../validations/index.js";

const router = Router();

// All admin page routes require authentication.
router.use(authenticate);

const vid = validateObjectId("id");

// Pages share the content-and-navigation bucket with themes/menus —
// reuse `themes.read`/`themes.write` so a role that can manage the
// storefront's navigation also manages its static pages. Introducing
// a dedicated `pages.*` permission would fragment the role editor
// without adding real separation (there's no realistic scenario where
// a user should be able to edit navigation but not the pages it links
// to).
router.get("/", requirePermission("themes.read", "themes.write"), PageController.list);
router.get("/:id", vid, requirePermission("themes.read", "themes.write"), PageController.get);
router.post(
  "/",
  requirePermission("themes.write"),
  validate(createPageSchema),
  PageController.create
);
router.put(
  "/:id",
  vid,
  requirePermission("themes.write"),
  validate(updatePageSchema),
  PageController.update
);
router.patch(
  "/:id",
  vid,
  requirePermission("themes.write"),
  validate(updatePageSchema),
  PageController.update
);
router.delete("/:id", vid, requirePermission("themes.write"), PageController.remove);

export default router;
