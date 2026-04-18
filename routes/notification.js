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
import { authenticate } from "../middlewares/auth.js";
import { streamTokenLimiter } from "../middlewares/rateLimiters.js";

const notificationRoutes = Router();

// /stream accepts ?token= (EventSource can't set Authorization headers),
// so mount it BEFORE the blanket `authenticate` middleware and wrap it in
// the dedicated auth path that checks either Bearer OR the query token.
notificationRoutes.get("/stream", streamAuthMiddleware, streamNotificationsController);

// All other notification routes require normal Bearer auth + tenant resolution.
notificationRoutes.use(authenticate);

// Stream-token mint — rate-limited per-user so a compromised JWT can't
// be used to harvest an unbounded fan of SSE tickets.
notificationRoutes.get("/stream-token", streamTokenLimiter, streamTokenController);
notificationRoutes.get("/", listNotificationsController);
notificationRoutes.get("/unread-count", unreadCountController);
notificationRoutes.patch("/:id/read", markReadController);
notificationRoutes.post("/read-all", markAllReadController);
notificationRoutes.delete("/:id", dismissNotificationController);

export default notificationRoutes;
