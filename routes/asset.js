import { Router } from "express";
import * as AssetController from "../controllers/asset.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validateObjectId } from "../middlewares/platformAdmin.js";

/**
 * Media library routes (audit 6.6).
 *
 * Browsing and alt-text editing of the tenant's uploaded assets. Gated
 * on the `themes.*` bucket — the media library lives under Storefront in
 * the dashboard alongside Themes/Pages, and the same roles that manage
 * storefront content manage its imagery. Uploads/deletes are on the
 * existing /upload router (uploads.write) and unchanged.
 */
const router = Router();

router.use(authenticate);

const vid = validateObjectId("id");

router.get("/", requirePermission("themes.read", "themes.write"), AssetController.list);
router.patch("/:id", vid, requirePermission("themes.write"), AssetController.updateAlt);

export default router;
