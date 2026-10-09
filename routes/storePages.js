import express from "express";
import * as StorePagesController from "../controllers/storePages.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import {
  saveAboutSchema,
  savePoliciesSchema,
  setContactSchema,
} from "../validators/storePages.validator.js";

/**
 * Generated store pages (PBI 10 — 10-9, 10-10, 10-11). Permissions follow
 * where the result is stored: the About page is a CMS Page (routes/page.js →
 * themes.*); the contact switch and the policies are store settings
 * (routes/settings.js → settings.*). Not feature-gated, like
 * /store-profile: `design.simpleMode` gates the dashboard screens.
 */
const router = express.Router();

const canReadPages = requirePermission("themes.read", "themes.write");
const canWritePages = requirePermission("themes.write");
const canReadSettings = requirePermission("settings.read", "settings.write");
const canWriteSettings = requirePermission("settings.write");

router.use(authenticate);

router.get("/about", canReadPages, StorePagesController.getAbout);
router.put("/about", canWritePages, validate(saveAboutSchema), StorePagesController.saveAbout);

router.get("/contact", canReadSettings, StorePagesController.getContact);
router.put("/contact", canWriteSettings, validate(setContactSchema), StorePagesController.setContact);

router.get("/policies", canReadSettings, StorePagesController.getPolicies);
router.put("/policies", canWriteSettings, validate(savePoliciesSchema), StorePagesController.savePolicies);

export default router;
