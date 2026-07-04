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
import {
  renderNotificationCopy,
  resolveTenantLanguage,
  pickLanguage,
} from "./notificationCopy.js";

// Icon + badge live at the dashboard's PWA asset root. Served by
// routes/dashboard.js from dashboard/dist. Fixed paths so a payload never
// depends on tenant config.
const PUSH_ICON = "/dashboard/pwa-192x192.png";
const PUSH_BADGE = "/dashboard/pwa-192x192.png";

/**
 * Resolve the staff users allowed to see a notification. Mirrors the
 * visibility logic of dispatchEmails / the inbox repository:
 *   - restricted to staff roles (or the explicit recipient list)
 *   - permission gate (notification.permission, null = broadcast)
 * Unlike email there is NO per-type channel opt-in — installing the PWA and
 * granting push permission IS the opt-in.
 *
 * Returns the eligible user docs (with `_id` + `language`) so the caller can
 * render each recipient's push payload in THEIR saved language.
 */
async function resolveRecipients(models, notification) {
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
      .select("_id roles customRoleIds language")
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
  if (!requiredPerm) return users;

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
    if (perms.has("*") || perms.has(requiredPerm)) eligible.push(user);
  }
  return eligible;
}

/**
 * Build a push payload with the title/body rendered in `language`. The
 * localized copy comes from services/notificationCopy.js (shared with email);
 * on an unmapped type it falls back to the stored English title/body.
 */
function buildPayload(notification, language) {
  const path = resolveNotificationPath(notification);
  const { title, body } = renderNotificationCopy(notification, language);
  return {
    title: title || "Matjar",
    body: body || "",
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

    const recipients = await resolveRecipients(models, notification);
    if (recipients.length === 0) return;

    const subs = await listSubscriptionsForUsers(
      models,
      recipients.map((u) => u._id)
    );
    if (subs.length === 0) return;

    // Per-recipient language: resolve each subscription's owning user's saved
    // language, falling back to the tenant's store language, then English.
    // Render the payload once per distinct language.
    const tenantLanguage = await resolveTenantLanguage(
      notification.tenantId || tenantId
    );
    const langByUserId = new Map(
      recipients.map((u) => [String(u._id), u.language])
    );
    const payloadByLang = new Map();
    const payloadFor = (lang) => {
      if (!payloadByLang.has(lang)) {
        payloadByLang.set(lang, buildPayload(notification, lang));
      }
      return payloadByLang.get(lang);
    };

    const goneEndpoints = [];
    let sent = 0;

    // Send in parallel; collect dead endpoints for pruning.
    await Promise.all(
      subs.map(async (sub) => {
        const lang = pickLanguage(
          langByUserId.get(String(sub.user)),
          tenantLanguage
        );
        const res = await sendPush(sub, payloadFor(lang));
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
