import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { createCompany, getCompanies, getCompany, updateCompany, deleteCompany } from "../controllers/company.js";

const router = Router();
router.use(authenticate, requirePermission("customers.write"));

router.post("/", createCompany);
router.get("/", getCompanies);
router.get("/:id", getCompany);
router.put("/:id", updateCompany);
router.delete("/:id", deleteCompany);

export default router;
