import mongoose from "mongoose";

/**
 * Push subscription persistence. All access goes through the tenant-scoped
 * model (models.PushSubscription) so tenantId is injected automatically.
 */

/**
 * Upsert a subscription keyed on its endpoint. If the same endpoint already
 * exists (same browser re-subscribing) we refresh its keys/user/userAgent
 * rather than creating a duplicate.
 */
export const upsertSubscription = async (
  models,
  { userId, endpoint, keys, userAgent }
) => {
  const now = new Date();
  return models.PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        user: new mongoose.Types.ObjectId(userId),
        endpoint,
        keys: { p256dh: keys?.p256dh, auth: keys?.auth },
        userAgent: userAgent || null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, new: true }
  );
};

/** Remove a single subscription by its endpoint (best-effort unsubscribe). */
export const removeSubscriptionByEndpoint = async (models, endpoint) =>
  models.PushSubscription.deleteOne({ endpoint });

/**
 * List every subscription belonging to any of the given user ids. Returned
 * lean so the dispatch loop can iterate cheaply.
 */
export const listSubscriptionsForUsers = async (models, userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const ids = userIds.map((id) => new mongoose.Types.ObjectId(id));
  return models.PushSubscription.find({ user: { $in: ids } }).lean();
};

/** Prune dead subscriptions the push service reported as gone (404/410). */
export const removeSubscriptionsByEndpoints = async (models, endpoints) => {
  if (!Array.isArray(endpoints) || endpoints.length === 0) return { deletedCount: 0 };
  return models.PushSubscription.deleteMany({ endpoint: { $in: endpoints } });
};
