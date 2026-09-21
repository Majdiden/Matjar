/**
 * Owner-configured email alerts for platform staff.
 *
 * `notifyPlatform(eventKey, message)` looks up every active platform user
 * subscribed to the event and emails them. Never throws and never blocks the
 * caller's request: emitters call it fire-and-forget.
 *
 * Throttling is per event and per process (in-memory): after one email the
 * event is muted for `throttleMs`; occurrences during the window are counted
 * and reported in the next email. Good enough for a handful of API dynos —
 * the worst case is one email per dyno per window, never one per request.
 */
import mongoose from "mongoose";
import logger from "../../utils/logger.js";
import { notificationEvent, PLATFORM_NOTIFICATION_KEYS } from "../../config/platformNotificationEvents.js";
import { sendEmail } from "../providers/email.js";
import { platformAdminBaseUrl } from "./users.js";

const windows = new Map(); // eventKey → { until: epochMs, suppressed: number }

/** Test/diagnostic hook. */
export function resetNotificationWindows() {
  windows.clear();
}

export async function subscribedRecipients(eventKey) {
  if (!mongoose.modelNames().includes("TenantUser")) return [];
  const def = notificationEvent(eventKey);
  const or = [{ platformNotifications: eventKey }];
  if (def?.alwaysRoles?.length) or.push({ platformRole: { $in: def.alwaysRoles } });
  const rows = await mongoose
    .model("TenantUser")
    .find({ platformAdmin: true, platformStatus: { $ne: "suspended" }, $or: or })
    .select("email name")
    .lean();
  return rows.map((r) => ({ email: r.email, name: r.name || "" }));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/**
 * @param {string} eventKey  one of PLATFORM_NOTIFICATION_KEYS
 * @param {{ subject: string, lines: string[], link?: string }} message
 *   `lines` are plain-text facts (no HTML); `link` is a console path such as "/tenants/<id>".
 */
export async function notifyPlatform(eventKey, message, { sendEmailFn = sendEmail, now = Date.now } = {}) {
  try {
    const def = notificationEvent(eventKey);
    if (!def) {
      logger.warn("notifyPlatform: unknown event", { eventKey });
      return { sent: 0, skipped: "unknown_event" };
    }

    let suppressedNote = "";
    if (def.throttleMs > 0) {
      const w = windows.get(eventKey);
      const t = now();
      if (w && t < w.until) {
        w.suppressed += 1;
        return { sent: 0, skipped: "throttled", suppressed: w.suppressed };
      }
      if (w?.suppressed) {
        suppressedNote = `${w.suppressed} more occurrence(s) were suppressed since the previous alert.`;
      }
      windows.set(eventKey, { until: t + def.throttleMs, suppressed: 0 });
    }

    const recipients = await subscribedRecipients(eventKey);
    if (!recipients.length) return { sent: 0, skipped: "no_recipients" };

    const base = platformAdminBaseUrl(null);
    const link = message.link ? `${base}${message.link.startsWith("/") ? "" : "/"}${message.link}` : base;
    const lines = [...(message.lines || []), suppressedNote].filter(Boolean);
    const subject = `[Matjar] ${message.subject}`;
    const text = [`${def.label}`, "", ...lines, "", `Open the console: ${link}`, "", def.alwaysRoles?.length ? "You receive this because of your platform role." : "You receive this because a platform owner subscribed you to this alert."].join("\n");
    const html = `<p><strong>${escapeHtml(def.label)}</strong></p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}<p><a href="${escapeHtml(link)}">Open the console</a></p><p style="color:#666;font-size:12px">${def.alwaysRoles?.length ? "You receive this because of your platform role." : "You receive this because a platform owner subscribed you to this alert."}</p>`;

    const results = await Promise.allSettled(
      recipients.map((r) => sendEmailFn({ to: r.email, subject, text, html, tags: ["platform-alert", eventKey] }))
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;
    if (failed) logger.warn("notifyPlatform: some alert emails failed", { eventKey, sent, failed });
    return { sent, failed };
  } catch (err) {
    logger.warn("notifyPlatform failed", { eventKey, error: err?.message || String(err) });
    return { sent: 0, skipped: "error" };
  }
}

export { PLATFORM_NOTIFICATION_KEYS };
