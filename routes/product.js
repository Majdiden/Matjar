import { Router } from "express";
import {
  createProductController,
  createQuickProductController,
  getProductController,
  getProductsController,
  updateProductController,
  deleteProductController,
} from "../controllers/product.js";
import { authenticate, optionalAuth } from "../middlewares/auth.js";
import { authorize, requirePermission } from "../middlewares/authorize.js";
import { requireTenant } from "../middlewares/tenantContext.js";
import { validate } from "../middlewares/validate.js";
import { checkPlanLimit } from "../middlewares/planLimits.js";
import {
  createProductSchema,
  createQuickProductSchema,
  getProductSchema,
  getProductsSchema,
  updateProductSchema,
} from "../validators/product.validator.js";

const productRoutes = Router();

// Public-ish routes: the storefront can hit these unauthenticated (in which
// case the host resolver must have bound a tenant), and the dashboard hits
// them with a JWT (in which case optionalAuth binds the tenant from the
// token). Run optionalAuth FIRST so the JWT has a chance to populate
// req.tenant before requireTenant rejects the request — otherwise a
// misconfigured dev proxy that strips the subdomain would 404 the
// authenticated dashboard even though the JWT identifies the tenant.
productRoutes.get("/", optionalAuth, requireTenant, validate(getProductsSchema), getProductsController);
productRoutes.get("/:id", optionalAuth, requireTenant, validate(getProductSchema), getProductController);

// Protected routes (only admin and manager can modify products)
productRoutes.post("/", authenticate, requirePermission("products.write"), checkPlanLimit("products"), validate(createProductSchema), createProductController);
// Quick add (PBI 10): photo, name, price, quantity; published at once.
productRoutes.post("/quick", authenticate, requirePermission("products.write"), checkPlanLimit("products"), validate(createQuickProductSchema), createQuickProductController);
productRoutes.put("/:id", authenticate, requirePermission("products.write"), validate(updateProductSchema), updateProductController);
productRoutes.delete("/:id", authenticate, requirePermission("products.write"), validate(getProductSchema), deleteProductController);

export default productRoutes;
