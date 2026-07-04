import { Router } from "express";
import {
  listNotificationsController,
  unreadCountController,
  markReadController,
  markAllReadController,
  dismissNotificationController,
} from "../controllers/notification.js";
import {
  streamNotificationsController,
  streamTokenController,
  streamAuthMiddleware,
} from "../controllers/notificationStream.js";
import {
  vapidPublicKeyController,
  subscribePushController,
  unsubscribePushController,
} from "../controllers/pushSubscription.js";
import { authenticate } from "../middlewares/auth.js";
import { streamTokenLimiter } from "../middlewares/rateLimiters.js";

const notificationRoutes = Router();

// /stream accepts ?token= (EventSource can't set Authorization headers),
// so mount it BEFORE the blanket `authenticate` middleware and wrap it in
// the dedicated auth path that checks either Bearer OR the query token.
notificationRoutes.get("/stream", streamAuthMiddleware, streamNotificationsController);

// VAPID public key is safe to serve unauthenticated (it's a public key and
// carries no tenant data). Mount before the blanket `authenticate` so the
// browser can fetch it as part of the push-subscription bootstrap.
notificationRoutes.get("/vapid-public-key", vapidPublicKeyController);

// All other notification routes require normal Bearer auth + tenant resolution.
notificationRoutes.use(authenticate);

// Web Push subscription lifecycle (authenticated + tenant-scoped).
notificationRoutes.post("/push/subscribe", subscribePushController);
notificationRoutes.post("/push/unsubscribe", unsubscribePushController);

// Stream-token mint — rate-limited per-user so a compromised JWT can't
// be used to harvest an unbounded fan of SSE tickets.
notificationRoutes.get("/stream-token", streamTokenLimiter, streamTokenController);
notificationRoutes.get("/", listNotificationsController);
notificationRoutes.get("/unread-count", unreadCountController);
notificationRoutes.patch("/:id/read", markReadController);
notificationRoutes.post("/read-all", markAllReadController);
notificationRoutes.delete("/:id", dismissNotificationController);

export default notificationRoutes;
