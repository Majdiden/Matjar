import { Router } from "express";
import { loginController, addATenantController } from "../controllers/index.js";

const router = Router();

router.post("/add", addATenantController);
router.post("/login", loginController);

export default router;
