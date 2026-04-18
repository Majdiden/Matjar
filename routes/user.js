import { Router } from "express";
import {
  getUserInfoController,
  getNotificationPreferencesController,
  updateNotificationPreferencesController,
} from "../controllers/index.js";
import { authenticate } from "../middlewares/auth.js";

const userRoutes = Router();

// All user routes require authentication
userRoutes.use(authenticate);

userRoutes.get("/me", getUserInfoController);
userRoutes.get("/me/notification-preferences", getNotificationPreferencesController);
userRoutes.put("/me/notification-preferences", updateNotificationPreferencesController);

export default userRoutes;
