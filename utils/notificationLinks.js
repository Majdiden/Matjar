/**
 * Notification deep-link resolver (backend).
 *
 * Mirrors the dashboard's `resolveNotificationLink` (see
 * dashboard/src/hooks/useNotifications.ts). Kept in its own module so
 * outbound email delivery can generate a "View in dashboard" URL without
 * duplicating the switch statement across service callers.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ !!  KEEP IN SYNC  !!                                                │
 * │ Counterpart: dashboard/src/hooks/useNotifications.ts                │
 * │                       (function: resolveNotificationLink)           │
 * │                                                                     │
 * │ The two functions MUST return identical paths for identical inputs. │
 * │ When a link diverges, the "View in dashboard" link in outbound      │
 * │ email (backend) stops matching the in-app toast deep-link (frontend)│
 * │ and users land on a different page than they expected.              │
 * │                                                                     │
 * │ Notification types currently handled (add to BOTH switches):        │
 * │   - order.created                                                   │
 * │   - payment.manual_submitted                                        │
 * │   - payment.failed                                                  │
 * │   - refund.created                                                  │
 * │   - return.requested                                                │
 * │   - stock.low                                                       │
 * │   - webhook.failed                                                  │
 * │   - domain.verification_failed                                      │
 * │   - staff.invite_accepted                                           │
 * │                                                                     │
 * │ Contract is pinned by tests/unit/notification-links.test.js against │
 * │ tests/fixtures/notification-link-cases.json. When you add a case,   │
 * │ add a fixture row and update the dashboard switch in the same PR.   │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import config from "../config/index.js";

/**
 * Best-effort base URL for the dashboard SPA. Resolved in priority order:
 *   1. PUBLIC_DASHBOARD_URL — canonical, documented in .env.example
 *   2. DASHBOARD_URL        — legacy alias (used by the staff-invite mailer)
 *   3. empty string         — relative paths; links still work when opened
 *                             from inside a logged-in dashboard session.
 */
export function dashboardBaseUrl() {
  return (config.publicDashboardUrl || "").replace(/\/+$/, "");
}

/**
 * Return a dashboard path (starting with `/dashboard/…`) for a given
 * notification, or null if the type isn't recognised.
 */
export function resolveNotificationPath(n) {
  if (!n || !n.type) return null;
  const rid = n.resourceId ? String(n.resourceId) : null;
  const orderId = n.data?.orderId ? String(n.data.orderId) : rid;

  switch (n.type) {
    case "order.created":
      return rid ? `/dashboard/orders/${rid}` : "/dashboard/orders";
    case "payment.manual_submitted":
    case "payment.failed":
      return orderId ? `/dashboard/orders/${orderId}` : "/dashboard/payments";
    case "refund.created":
      return orderId ? `/dashboard/orders/${orderId}` : "/dashboard/orders";
    case "return.requested":
      return rid ? `/dashboard/returns/${rid}` : "/dashboard/orders";
    case "stock.low":
      return rid ? `/dashboard/products/${rid}` : "/dashboard/inventory";
    case "webhook.failed":
      return "/dashboard/settings?tab=webhooks";
    case "domain.verification_failed":
      return "/dashboard/settings?tab=domains";
    case "staff.invite_accepted":
      return "/dashboard/staff";
    default:
      return null;
  }
}

/**
 * Absolute URL for the notification, or null when neither the path nor
 * the base URL is known. When the base URL is empty, falls back to the
 * relative path so the email body is still actionable from inside a
 * logged-in session.
 */
export function resolveNotificationUrl(n) {
  const path = resolveNotificationPath(n);
  if (!path) return null;
  const base = dashboardBaseUrl();
  return base ? `${base}${path}` : path;
}

/**
 * Absolute URL to the notifications preferences tab. Used as the
 * unsubscribe / manage-preferences footer link in every outbound email.
 */
export function notificationPreferencesUrl() {
  const base = dashboardBaseUrl();
  const path = "/dashboard/settings?tab=notifications";
  return base ? `${base}${path}` : path;
}
