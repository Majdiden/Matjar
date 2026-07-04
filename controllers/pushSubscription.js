import { asyncHandler } from "../middlewares/errorHandler.js";
import { getVapidPublicKey, isWebPushConfigured } from "../utils/webPush.js";
import {
  upsertSubscription,
  removeSubscriptionByEndpoint,
} from "../repositories/pushSubscription.js";

/**
 * GET /api/notifications/vapid-public-key
 *
 * Public — returns the VAPID application-server public key the browser
 * needs to create a push subscription. A public key is safe to expose
 * unauthenticated; there is no tenant context required.
 */
export const vapidPublicKeyController = asyncHandler(async (_req, res) => {
  const publicKey = getVapidPublicKey();
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "VAPID public key",
    responseObject: {
      publicKey: publicKey || null,
      enabled: isWebPushConfigured(),
    },
  });
});

/**
 * POST /api/notifications/push/subscribe
 * Body: { endpoint, keys: { p256dh, auth }, userAgent? } or
 *       { subscription: <PushSubscription JSON> }
 *
 * Upserts the subscription for the authenticated user (keyed on endpoint).
 */
export const subscribePushController = asyncHandler(async (req, res) => {
  // Accept either a flat body or a wrapped { subscription } (the browser's
  // PushSubscription.toJSON() shape is { endpoint, keys, expirationTime }).
  const sub = req.body?.subscription || req.body || {};
  const endpoint = sub.endpoint;
  const keys = sub.keys;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Invalid push subscription: endpoint and keys are required.",
    });
  }

  const userAgent =
    req.body?.userAgent || req.headers["user-agent"] || null;

  await upsertSubscription(req.models, {
    userId: req.user.userId,
    endpoint,
    keys,
    userAgent,
  });

  res.status(201).json({
    success: true,
    statusCode: 201,
    message: "Push subscription saved",
    responseObject: { subscribed: true },
  });
});

/**
 * POST /api/notifications/push/unsubscribe
 * Body: { endpoint } or { subscription: { endpoint } }
 *
 * Best-effort removal of a subscription by endpoint.
 */
export const unsubscribePushController = asyncHandler(async (req, res) => {
  const endpoint = req.body?.endpoint || req.body?.subscription?.endpoint;
  if (!endpoint) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "endpoint is required.",
    });
  }

  await removeSubscriptionByEndpoint(req.models, endpoint);

  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Push subscription removed",
    responseObject: { unsubscribed: true },
  });
});
