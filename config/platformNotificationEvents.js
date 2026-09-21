/**
 * Platform email alerts an operator can be subscribed to. The OWNER decides,
 * per platform user, which of these land in their inbox
 * (TenantUser.platformNotifications). Keys are stored on the user row, so
 * renaming one is a migration; add new ones at the end.
 *
 * `alwaysRoles` lists platform roles that receive the event whether or not
 * they are subscribed (incidents always reach owner/operations/developer).
 *
 * `throttleMs` collapses bursts: after one email, further occurrences of the
 * same event are counted and summarised in the next email once the window
 * has passed (so a broken endpoint sends one email per window, not one per
 * request).
 */
export const PLATFORM_NOTIFICATION_EVENTS = Object.freeze([
  {
    key: "tenant.signup",
    label: "New store signup",
    description: "A merchant registered a new store.",
    throttleMs: 0,
  },
  {
    key: "system.request_error",
    label: "API server errors",
    description: "A request failed with a 5xx (one email per 15 minutes with a count).",
    throttleMs: 15 * 60 * 1000,
  },
  {
    key: "system.job_failed",
    label: "Background job failed",
    description: "A queued job (store setup, exports, billing, webhooks) exhausted its retries.",
    throttleMs: 15 * 60 * 1000,
  },
  {
    key: "incident.opened",
    label: "Incident opened",
    description: "A platform incident was created. Owners, operations and developers always receive this.",
    throttleMs: 0,
    alwaysRoles: ["owner", "operations", "developer"],
  },
  {
    key: "incident.resolved",
    label: "Incident resolved",
    description: "A platform incident was resolved. Owners, operations and developers always receive this.",
    throttleMs: 0,
    alwaysRoles: ["owner", "operations", "developer"],
  },
  {
    key: "security.platform_login_failed",
    label: "Platform login failures",
    description: "Failed sign-in or re-auth attempts on the platform console (one email per 15 minutes).",
    throttleMs: 15 * 60 * 1000,
  },
]);

export const PLATFORM_NOTIFICATION_KEYS = Object.freeze(PLATFORM_NOTIFICATION_EVENTS.map((e) => e.key));

export function notificationEvent(key) {
  return PLATFORM_NOTIFICATION_EVENTS.find((e) => e.key === key) || null;
}
