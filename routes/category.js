import { Router } from "express";
import {
  createCategoryController,
  getCategoryController,
  getCategoriesController,
  updateCategoryController,
  deleteCategoryController,
} from "../controllers/category.js";
import { authenticate, optionalAuth } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";

const categoryRoutes = Router();

// Public routes (categories can be viewed without authentication)
categoryRoutes.get("/", optionalAuth, getCategoriesController);
categoryRoutes.get("/:id", optionalAuth, getCategoryController);

// Protected routes (only admin and manager can modify categories)
categoryRoutes.post("/", authenticate, requirePermission("products.write"), createCategoryController);
categoryRoutes.put("/:id", authenticate, requirePermission("products.write"), updateCategoryController);
categoryRoutes.delete("/:id", authenticate, requirePermission("products.write"), deleteCategoryController);

export default categoryRoutes;
