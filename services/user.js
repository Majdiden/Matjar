import { getAUserRepo, updateAUserRepo } from "../repositories/user.js";

export const getAUser = async (req, res) => {
  try {
    const data = await getAUserRepo(req.models);
    return {
      success: true,
      statusCode: 200,
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const getNotificationPreferencesService = async (models, userId) => {
  const user = await models.User.findById(userId)
    .select("notificationPreferences")
    .lean();
  return {
    success: true,
    statusCode: 200,
    message: "Notification preferences retrieved",
    responseObject: { preferences: user?.notificationPreferences || {} },
  };
};

export const updateNotificationPreferencesService = async (models, userId, prefs) => {
  await updateAUserRepo(
    models,
    { _id: userId },
    { $set: { notificationPreferences: prefs, updatedAt: new Date() } }
  );
  return {
    success: true,
    statusCode: 200,
    message: "Notification preferences updated",
    responseObject: { preferences: prefs },
  };
};
