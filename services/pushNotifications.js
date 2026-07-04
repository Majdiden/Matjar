/**
 * Web Push fan-out for merchant (staff) notifications.
 *
 * This is the BACKGROUND-delivery counterpart to the in-app notification
 * center + SSE stream. When `services/notification.js#emit` persists a
 * merchant notification (new order, status change, low stock, …) it also
 * calls `dispatchPush` here, fire-and-forget. Every staff user allowed to
 * SEE the notification (same permission + recipient gates as the in-app
 * inbox) gets a Web Push to each of their registered browser
 * subscriptions, so the installed PWA shows a system notification even
 * when it is backgrounded or fully closed.
 *
 * Dead subscriptions (push service returns 404/410) are pruned.
 *
 * Everything here is non-fatal and never awaited by the primary flow — a
 * push provider outage must never roll back an order.
 */

import logger from "../utils/logger.js";
import { sendPush, isWebPushConfigured } from "../utils/webPush.js";
import { resolveNotificationPath } from "../utils/notificationLinks.js";
import {
  listSubscriptionsForUsers,
  removeSubscriptionsByEndpoints,
} from "../repositories/pushSubscription.js";
import {
  STAFF_ROLES,
  effectivePermissionsFor,
} from "./notification.js";

// Icon + badge live at the dashboard's PWA asset root. Served by
// routes/dashboard.js from dashboard/dist. Fixed paths so a payload never
// depends on tenant config.
const PUSH_ICON = "/dashboard/pwa-192x192.png";
const PUSH_BADGE = "/dashboard/pwa-192x192.png";

/**
 * Resolve the set of staff user ids allowed to see a notification.
 * Mirrors the visibility logic of dispatchEmails / the inbox repository:
 *   - restricted to staff roles (or the explicit recipient list)
 *   - permission gate (notification.permission, null = broadcast)
 * Unlike email there is NO per-type channel opt-in — installing the PWA and
 * granting push permission IS the opt-in.
 */
async function resolveRecipientUserIds(models, notification) {
  const baseFilter = { isActive: true };
  if (
    Array.isArray(notification.recipientUserIds) &&
    notification.recipientUserIds.length > 0
  ) {
    baseFilter._id = { $in: notification.recipientUserIds };
  } else {
    baseFilter.roles = { $in: Array.from(STAFF_ROLES) };
  }

  let users = [];
  try {
    users = await models.User.find(baseFilter)
      .select("_id roles customRoleIds")
      .lean();
  } catch (err) {
    logger.warn("push: recipient lookup failed", {
      type: notification.type,
      error: err?.message,
    });
    return [];
  }
  if (users.length === 0) return [];

  const requiredPerm = notification.permission || null;
  if (!requiredPerm) return users.map((u) => u._id);

  // Pre-fetch referenced custom roles in one query for permission resolution.
  const customRoleIdSet = new Set();
  for (const u of users) {
    for (const rid of u.customRoleIds || []) customRoleIdSet.add(String(rid));
  }
  const customRolesById = new Map();
  if (customRoleIdSet.size > 0 && models.Role) {
    try {
      const roles = await models.Role.find({
        _id: { $in: Array.from(customRoleIdSet) },
      })
        .select("permissions")
        .lean();
      for (const r of roles) customRolesById.set(String(r._id), r);
    } catch (err) {
      logger.warn("push: custom role lookup failed", { error: err?.message });
    }
  }

  const eligible = [];
  for (const user of users) {
    const perms = effectivePermissionsFor(user, customRolesById);
    if (perms.has("*") || perms.has(requiredPerm)) eligible.push(user._id);
  }
  return eligible;
}

function buildPayload(notification) {
  const path = resolveNotificationPath(notification);
  return {
    title: notification.title || "Matjar",
    body: notification.body || "",
    icon: PUSH_ICON,
    badge: PUSH_BADGE,
    tag: `matjar-${notification.type || "notification"}`,
    data: {
      // The SW focuses/opens this path under /dashboard on click.
      url: path || "/dashboard",
      type: notification.type,
      notificationId: notification._id ? String(notification._id) : undefined,
    },
  };
}

/**
 * Fan a persisted in-app notification out as Web Push to every eligible
 * staff user's browser subscriptions. Must be called after the
 * notification has been persisted. Swallows all errors.
 */
export async function dispatchPush(models, notification, tenantId) {
  try {
    if (!notification) return;
    if (!isWebPushConfigured()) return; // no VAPID keys → silently skip

    const userIds = await resolveRecipientUserIds(models, notification);
    if (userIds.length === 0) return;

    const subs = await listSubscriptionsForUsers(models, userIds);
    if (subs.length === 0) return;

    const payload = buildPayload(notification);
    const goneEndpoints = [];
    let sent = 0;

    // Send in parallel; collect dead endpoints for pruning.
    await Promise.all(
      subs.map(async (sub) => {
        const res = await sendPush(sub, payload);
        if (res.ok) {
          sent++;
        } else if (res.gone) {
          goneEndpoints.push(sub.endpoint);
        } else {
          logger.warn("push: send failed", {
            type: notification.type,
            statusCode: res.statusCode,
            error: res.error,
          });
        }
      })
    );

    if (goneEndpoints.length > 0) {
      try {
        await removeSubscriptionsByEndpoints(models, goneEndpoints);
      } catch (err) {
        logger.warn("push: pruning gone subscriptions failed", {
          error: err?.message,
        });
      }
    }

    if (sent > 0) {
      logger.info("push: dispatched", {
        type: notification.type,
        tenantId: String(tenantId),
        sent,
        pruned: goneEndpoints.length,
      });
    }
  } catch (err) {
    logger.warn("push: dispatchPush threw", {
      tenantId: String(tenantId),
      type: notification?.type,
      error: err?.message,
    });
  }
}
