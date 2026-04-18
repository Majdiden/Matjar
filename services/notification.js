import * as repo from "../repositories/notification.js";
import notificationBus from "../utils/notificationBus.js";
import logger from "../utils/logger.js";
import { ROLE_PERMISSIONS } from "../middlewares/authorize.js";
import { sendEmail, isEmailConfigured } from "./providers/email.js";
import {
  resolveNotificationUrl,
  notificationPreferencesUrl,
} from "../utils/notificationLinks.js";

/**
 * Persist a notification and fan it out to any in-process SSE subscribers.
 *
 * Callers in primary flows MUST wrap their invocation in try/catch so an
 * emit failure never rolls back an order / payment / etc. emit() itself
 * also swallows and logs; belt-and-braces.
 */
export const emit = async (models, tenantId, event) => {
  try {
    const created = await repo.createNotification(models, { ...event });
    notificationBus.publish(tenantId, created);

    // Outbound email fan-out runs fire-and-forget. A failure here (Resend
    // outage, user lookup hiccup, etc.) must NOT propagate into the
    // primary flow or unwind the in-app notification. Intentionally not
    // awaited — we don't hold an order-placement request on the email
    // provider's latency.
    void dispatchEmails(models, created).catch((err) =>
      logger.warn("notification.dispatchEmails threw", {
        tenantId: String(tenantId),
        type: created?.type,
        error: err?.message,
      })
    );

    return created;
  } catch (err) {
    logger.warn("notification.emit failed", {
      tenantId: String(tenantId),
      type: event?.type,
      error: err?.message,
    });
    return null;
  }
};

export const listForUser = async (models, opts) =>
  repo.listNotifications(models, opts);

export const markRead = async (models, id, userId, permissions) =>
  repo.markRead(models, id, userId, permissions);

export const markAllRead = async (models, userId, permissions, before) =>
  repo.markAllRead(models, userId, permissions, before);

export const dismiss = async (models, id, userId, permissions) =>
  repo.dismiss(models, id, userId, permissions);

export const countUnread = async (models, userId, permissions) =>
  repo.countUnread(models, userId, permissions);

// ---------------------------------------------------------------------------
// Email fan-out
// ---------------------------------------------------------------------------

/**
 * Roles that can never receive dashboard notification emails. Dashboard
 * notifications are for merchant staff — customers get their own
 * transactional emails (order confirmation, etc.) via a different path.
 */
const STAFF_ROLES = new Set(["admin", "manager", "staff"]);

/**
 * Compute effective permissions for a user document (lean shape).
 * Duplicates the logic in middlewares/authorize.js#getEffectivePermissions
 * but operates on a user doc + pre-fetched custom roles instead of a
 * request object. Returns a Set; "*" means wildcard.
 */
function effectivePermissionsFor(user, customRolesById) {
  const perms = new Set();
  const roles = Array.isArray(user.roles) ? user.roles : [];
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    if (rolePerms.includes("*")) return new Set(["*"]);
    for (const p of rolePerms) perms.add(p);
  }
  const customIds = Array.isArray(user.customRoleIds) ? user.customRoleIds : [];
  for (const rid of customIds) {
    const custom = customRolesById.get(String(rid));
    if (!custom) continue;
    for (const p of custom.permissions || []) {
      if (p === "*") continue; // custom roles can't grant wildcard
      perms.add(p);
    }
  }
  return perms;
}

/**
 * Decide whether a given user should receive an email for this
 * notification. Combines:
 *   - the notification's permission gate
 *   - the notification's recipient allow-list (empty = broadcast)
 *   - the user's per-type email preference (defaults to FALSE so
 *     existing users don't start receiving email without opting in)
 */
function shouldEmailUser(user, notification) {
  // Customers never get staff-channel emails.
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (!roles.some((r) => STAFF_ROLES.has(r))) return false;

  // Per-type email preference. Shape: { [type]: { email: boolean, … } }.
  // Default is OFF — email is opt-in per type, so a brand-new staff
  // member doesn't get flooded until they pick channels.
  const prefs = user.notificationPreferences || {};
  const row = prefs[notification.type];
  if (!row || row.email !== true) return false;

  return true;
}

/**
 * Build a minimal plain-text email body. We intentionally do NOT build
 * an HTML template system here — subject + body + deep link + footer is
 * enough to get merchants the alert. Keep the shape stable: tests and
 * downstream log consumers look for the "View in dashboard:" prefix.
 */
function renderEmail(notification) {
  const title = notification.title || "Matjar notification";
  const body = notification.body || "";
  const deepLink = resolveNotificationUrl(notification);
  const prefsLink = notificationPreferencesUrl();

  const lines = [];
  if (body) lines.push(body);
  if (deepLink) {
    lines.push("");
    lines.push(`View in dashboard: ${deepLink}`);
  }
  lines.push("");
  lines.push("—");
  lines.push(`Manage notification preferences: ${prefsLink}`);

  return { subject: title, text: lines.join("\n") };
}

/**
 * Fan an in-app notification out as email to every staff user who
 * (a) is allowed to see it (permission + recipient gates),
 * (b) opted in via notificationPreferences[type].email === true,
 * and (c) has a real email address on file.
 *
 * Must be called after the notification has been persisted + published
 * to Redis. Swallows all errors (caller wraps too) — an email provider
 * outage must never cascade into a dropped order.
 */
export async function dispatchEmails(models, notification) {
  if (!notification) return;

  // Platform-level feature flag. Cheap short-circuit before any DB work.
  if (!isEmailConfigured()) return;

  // Build the base user filter: active + has a non-empty email. If the
  // notification has an explicit recipient list, restrict to it.
  const baseFilter = { isActive: true, email: { $exists: true, $ne: "" } };
  if (Array.isArray(notification.recipientUserIds) && notification.recipientUserIds.length > 0) {
    baseFilter._id = { $in: notification.recipientUserIds };
  } else {
    // Dashboard notifications are staff-scoped. Narrow at the DB layer
    // so we don't stream every customer in the tenant into memory.
    baseFilter.roles = { $in: Array.from(STAFF_ROLES) };
  }

  let users = [];
  try {
    users = await models.User.find(baseFilter)
      .select("_id email name firstName lastName roles customRoleIds notificationPreferences")
      .lean();
  } catch (err) {
    logger.warn("notification email: user lookup failed", {
      type: notification.type,
      error: err?.message,
    });
    return;
  }
  if (users.length === 0) return;

  // Pre-fetch all referenced custom roles in ONE query so permission
  // resolution for N users doesn't fan out to N+1 reads.
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
      // Missing custom role permissions just means those users won't
      // pass the gate — safer than throwing.
      logger.warn("notification email: custom role lookup failed", {
        error: err?.message,
      });
    }
  }

  const { subject, text } = renderEmail(notification);
  const requiredPerm = notification.permission || null;

  let sentCount = 0;
  for (const user of users) {
    if (!user.email) continue;

    // Permission gate — skipped when the notification has no required
    // permission (broadcast to any staff).
    if (requiredPerm) {
      const perms = effectivePermissionsFor(user, customRolesById);
      if (!perms.has("*") && !perms.has(requiredPerm)) continue;
    }

    // Preference gate — explicit opt-in per notification type.
    if (!shouldEmailUser(user, notification)) continue;

    try {
      await sendEmail({ to: user.email, subject, text });
      sentCount++;
    } catch (err) {
      // Individual failures shouldn't abort the rest of the fan-out.
      logger.warn("notification email: send failed", {
        to: user.email,
        type: notification.type,
        error: err?.message,
      });
    }
  }

  if (sentCount > 0) {
    logger.info("notification email: dispatched", {
      type: notification.type,
      count: sentCount,
    });
  }
}
