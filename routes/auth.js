import { Router } from "express";
import {
  registerTenantController,
  loginController,
  refreshTokenController,
  getCurrentUserController,
  logoutController,
  changePasswordController,
  requestPasswordResetController,
  confirmPasswordResetController,
} from "../controllers/auth.js";
import { authenticate } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  passwordResetLimiter,
  passwordResetEmailLimiter,
} from "../middlewares/rateLimiters.js";
import {
  registerTenantSchema,
  loginSchema,
  refreshTokenSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
} from "../validators/auth.validator.js";

const authRoutes = Router();

// Public routes
authRoutes.post("/register", validate(registerTenantSchema), registerTenantController);
authRoutes.post("/login", validate(loginSchema), loginController);
authRoutes.post("/refresh", validate(refreshTokenSchema), refreshTokenController);

// Public forgot-password. Both limiters stack intentionally: the IP
// bucket (`passwordResetLimiter`) stops a single host from hammering the
// endpoint; the email bucket (`passwordResetEmailLimiter`) stops a
// distributed attacker from flooding one inbox or burning through a
// victim's reset attempts from many IPs.
authRoutes.post(
  "/password-reset",
  passwordResetLimiter,
  passwordResetEmailLimiter,
  validate(requestPasswordResetSchema),
  requestPasswordResetController,
);
authRoutes.post(
  "/password-reset/confirm",
  passwordResetLimiter,
  validate(confirmPasswordResetSchema),
  confirmPasswordResetController,
);

// Protected routes
authRoutes.get("/me", authenticate, getCurrentUserController);
authRoutes.post("/logout", authenticate, logoutController);
authRoutes.post("/change-password", passwordResetLimiter, authenticate, changePasswordController);

export default authRoutes;
