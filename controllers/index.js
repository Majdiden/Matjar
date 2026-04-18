import { addATenantService } from "../services/tenant.js";
import {
  getAUser,
  getNotificationPreferencesService,
  updateNotificationPreferencesService,
} from "../services/user.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

export const addATenantController = async (req, res) => {
  const serviceFnResponse = await addATenantService(req.body);
  res.status(serviceFnResponse.statusCode).json({ ...serviceFnResponse });
};

export const getUserInfoController = async (req, res) => {
  const response = await getAUser(req);
  res.status(response.statusCode).json({ ...response });
};

export const getNotificationPreferencesController = asyncHandler(async (req, res) => {
  const result = await getNotificationPreferencesService(req.models, req.user.userId);
  res.status(result.statusCode).json(result);
});

export const updateNotificationPreferencesController = asyncHandler(async (req, res) => {
  const prefs = req.body && typeof req.body === "object" ? req.body : {};
  const result = await updateNotificationPreferencesService(
    req.models,
    req.user.userId,
    prefs
  );
  res.status(result.statusCode).json(result);
});
