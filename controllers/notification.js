import {
  listForUser,
  markRead as markReadSvc,
  markAllRead as markAllReadSvc,
  dismiss as dismissSvc,
  countUnread as countUnreadSvc,
} from "../services/notification.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { getEffectivePermissions } from "../middlewares/authorize.js";

export const listNotificationsController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const { cursor, limit, unreadOnly, types } = req.query;
  const parsedTypes = types
    ? Array.isArray(types)
      ? types
      : String(types).split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const result = await listForUser(req.models, {
    userId: req.user.userId,
    permissions,
    cursor,
    limit: limit ? parseInt(limit, 10) : 20,
    unreadOnly: unreadOnly === "true" || unreadOnly === true,
    types: parsedTypes,
  });
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Notifications retrieved",
    responseObject: result,
  });
});

export const unreadCountController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const count = await countUnreadSvc(req.models, req.user.userId, permissions);
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Unread count retrieved",
    responseObject: { count },
  });
});

export const markReadController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  await markReadSvc(req.models, req.params.id, req.user.userId, permissions);
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Notification marked as read",
    responseObject: { id: req.params.id },
  });
});

export const markAllReadController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const before = req.body?.before || null;
  const result = await markAllReadSvc(
    req.models,
    req.user.userId,
    permissions,
    before
  );
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Notifications marked as read",
    responseObject: { modified: result?.modifiedCount || 0 },
  });
});

export const dismissNotificationController = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  await dismissSvc(req.models, req.params.id, req.user.userId, permissions);
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Notification dismissed",
    responseObject: { id: req.params.id },
  });
});
