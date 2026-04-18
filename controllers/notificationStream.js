import mongoose from "mongoose";
import notificationBus from "../utils/notificationBus.js";
import { getEffectivePermissions } from "../middlewares/authorize.js";
import { signJWT, verifyJWT } from "../utils/misc.js";
import { createScopedModels } from "../utils/scopedModel.js";
import logger from "../utils/logger.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

/**
 * Mint a short-lived SSE stream token.
 *
 * EventSource cannot send Authorization headers, so the dashboard requests
 * a 60s scoped token via normal Bearer auth, then opens the stream with
 * `?token=<jwt>`. The token is narrowly scoped: `scope='notifications.stream'`
 * is the only thing it's accepted for. 60s is enough to open the connection;
 * once open it stays open until the socket closes.
 */
export const streamTokenController = asyncHandler(async (req, res) => {
  const token = signJWT(
    {
      userId: String(req.user.userId),
      tenantId: String(req.user.tenantId ?? req.tenantId ?? ""),
      tokenVersion: req.user.tokenVersion,
      scope: "notifications.stream",
    },
    "60s"
  );
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Stream token issued",
    responseObject: { token, expiresIn: 60 },
  });
});

/**
 * Middleware: accept EITHER a Bearer header (normal auth chain already ran)
 * OR a `?token=<jwt>` query parameter scoped to `notifications.stream`.
 *
 * When `?token=` is present, we verify it ourselves, populate req.user /
 * req.tenantId / req.tenant / req.models just like middlewares/auth.js does,
 * then call next(). If neither is present/valid, reject 401.
 */
export const streamAuthMiddleware = async (req, res, next) => {
  // Normal Bearer path already ran `authenticate` and populated req.user.
  if (req.user && req.tenantId) return next();

  const qToken = req.query?.token;
  if (!qToken || typeof qToken !== "string") {
    return res.status(401).json({ success: false, message: "No token provided." });
  }

  try {
    const decoded = verifyJWT(qToken);
    if (!decoded || decoded.scope !== "notifications.stream") {
      return res.status(401).json({ success: false, message: "Invalid or expired stream token." });
    }

    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findById(decoded.tenantId);
    if (!tenant || !tenant.isActive) {
      return res.status(404).json({ success: false, message: "Tenant not found." });
    }

    const hostTenantId = req.tenantId ? String(req.tenantId) : null;
    const tokenTenantId = String(decoded.tenantId);
    if (hostTenantId && hostTenantId !== tokenTenantId) {
      return res.status(403).json({
        success: false,
        message: "Token tenant does not match the requested store.",
      });
    }

    req.tenantId = tenant._id;
    req.tenant = tenant;
    req.models = createScopedModels(mongoose.connection, tenant._id);

    const user = await req.models.User.findById(decoded.userId).select(
      "isActive tokenVersion roles customRoleIds"
    );
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Account is disabled or not found." });
    }

    const currentVersion = user.tokenVersion ?? 0;
    const tokenVersion = decoded.tokenVersion ?? 0;
    if (tokenVersion !== currentVersion) {
      return res.status(401).json({
        success: false,
        message: "Session has been revoked. Please log in again.",
      });
    }

    req.user = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      roles: user.roles || [],
      customRoleIds: user.customRoleIds || [],
    };

    return next();
  } catch (error) {
    logger.error(`Stream auth error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Stream authentication failed." });
  }
};

/**
 * Server-Sent Events stream of notifications for the authenticated user
 * scoped to their current tenant. One TCP connection per dashboard tab.
 *
 * Permission/recipient gating is evaluated per-event at write time so a
 * role demotion during a long-lived stream takes effect immediately
 * (permissions are re-read on the request object, which stays stable for
 * the connection — we accept that hot revocation requires reconnect).
 */
export const streamNotificationsController = async (req, res) => {
  const permissions = await getEffectivePermissions(req);
  const hasStar = permissions.has("*");
  const userId = String(req.user.userId);
  const userOid = new mongoose.Types.ObjectId(userId);

  // SSE headers — must be set before writing anything.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Nginx: disable response buffering so events are flushed immediately.
  res.setHeader("X-Accel-Buffering", "no");

  // Keep the socket open indefinitely (default 2m idle timeout would kill
  // a quiet connection). Disable Nagle + enable keepalive so the 25s
  // heartbeat below actually reaches the client.
  try {
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);
  } catch {
    /* no-op — some transports (tests) don't expose a real socket */
  }

  res.flushHeaders();
  res.write(": connected\n\n");

  const tenantId = req.tenantId;

  const handler = (notification) => {
    if (!notification) return;

    // Permission filter — wildcard bypasses.
    if (!hasStar && notification.permission) {
      if (!permissions.has(notification.permission)) return;
    }

    // Recipient filter — empty = broadcast.
    const recipients = notification.recipientUserIds;
    if (Array.isArray(recipients) && recipients.length > 0) {
      const match = recipients.some(
        (r) => String(r) === userId || (r && r.equals && r.equals(userOid))
      );
      if (!match) return;
    }

    try {
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    } catch {
      // Client likely disconnected mid-write; cleanup happens via 'close'.
    }
  };

  notificationBus.subscribe(tenantId, handler);

  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      /* handled by close/error below */
    }
  }, 25_000);

  const cleanup = () => {
    clearInterval(heartbeat);
    notificationBus.unsubscribe(tenantId, handler);
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
};
