/**
 * Order status notifications.
 *
 * Each order status transition emits a templated email to the customer.
 * Templates are defined per-tenant in `tenant.settings.notifications.templates`
 * and merged over the built-in defaults below — so a brand-new store sends
 * sensible emails out of the box without forcing the merchant to author six
 * templates before their first order, but a merchant who wants Shopify-style
 * branded receipts can override every line.
 *
 * Variable substitution uses `{{var}}` syntax. Supported variables:
 *   - {{customerName}}
 *   - {{orderNumber}}
 *   - {{status}}
 *   - {{total}}            (e.g. "120.00 USD")
 *   - {{trackingNumber}}   (empty when not yet shipped)
 *   - {{storeName}}
 *
 * Wired into:
 *   - services/order.js → updateOrderStatusService    (manual transitions)
 *   - services/order.js → cancelOrderService          (customer / admin cancel)
 *   - services/order.js → fulfillment status hooks    (auto-rolled status)
 *
 * The notification call is awaited (not fire-and-forget) but wrapped in a
 * try/catch inside this module: a flaky email provider must NEVER make an
 * order status update return a 500. Awaiting matters in tests because
 * supertest moves on as soon as the response is sent and the test inbox
 * needs to be populated synchronously with the response.
 */

import mongoose from "mongoose";
import { sendEmail } from "./providers/email.js";
import logger from "../utils/logger.js";

const STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Refunded"];

// Default templates. These are intentionally plain — a merchant who cares
// about brand will override them via the dashboard.
const DEFAULT_TEMPLATES = {
  Pending: {
    subject: "Order {{orderNumber}} received",
    body: "Hi {{customerName}},\n\nWe received your order {{orderNumber}} for {{total}}. We'll let you know when it ships.\n\nThanks,\n{{storeName}}",
  },
  Processing: {
    subject: "Order {{orderNumber}} is being prepared",
    body: "Hi {{customerName}},\n\nYour order {{orderNumber}} is now being prepared for shipment.\n\n{{storeName}}",
  },
  Shipped: {
    subject: "Order {{orderNumber}} has shipped",
    body: "Hi {{customerName}},\n\nGood news — your order {{orderNumber}} has shipped! Tracking: {{trackingNumber}}.\n\n{{storeName}}",
  },
  Delivered: {
    subject: "Order {{orderNumber}} delivered",
    body: "Hi {{customerName}},\n\nYour order {{orderNumber}} has been delivered. Enjoy!\n\n{{storeName}}",
  },
  Cancelled: {
    subject: "Order {{orderNumber}} cancelled",
    body: "Hi {{customerName}},\n\nYour order {{orderNumber}} has been cancelled.\n\n{{storeName}}",
  },
  Refunded: {
    subject: "Order {{orderNumber}} refunded",
    body: "Hi {{customerName}},\n\nYour order {{orderNumber}} for {{total}} has been refunded.\n\n{{storeName}}",
  },
};

export const ORDER_NOTIFICATION_STATUSES = STATUSES;
export const ORDER_NOTIFICATION_DEFAULTS = DEFAULT_TEMPLATES;

/**
 * Record a customer-notified event on the order timeline.
 *
 * Callers pass the Order document (ideally still held open in the request
 * scope) and the result of `notifyOrderStatusChange`. If the notifier
 * actually dispatched mail, we append an `order_notified` history entry
 * and persist. Silent failures (no customer email, template disabled,
 * SMTP error) are *not* recorded — the timeline is meant to track
 * confirmed customer-facing events, not best-effort attempts.
 *
 * `order` may be a live Mongoose doc or a lean object; only live docs
 * can persist — leans are skipped with a warning. `options.session` is
 * used when the caller wrapped the flow in a transaction.
 */
export const recordOrderNotified = async (
  order,
  newStatus,
  result,
  { session, userId } = {}
) => {
  try {
    if (!order || !result || result.success !== true) return;
    if (typeof order.save !== "function") return;
    if (!Array.isArray(order.history)) order.history = [];
    order.history.push({
      event: "order_notified",
      status: newStatus,
      note: `Customer notified — "${newStatus}"`,
      by: userId || null,
      at: new Date(),
    });
    await (session ? order.save({ session }) : order.save());
  } catch (err) {
    logger.warn("recordOrderNotified failed", {
      orderId: order?._id,
      error: err.message,
    });
  }
};

function render(template, vars) {
  if (typeof template !== "string") return "";
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ""
  );
}

/**
 * Notify a customer that an order has transitioned to a new status.
 *
 * Returns `{ success, reason?, data? }`. Never throws — the caller treats
 * a notification failure as a soft failure and continues on.
 */
export const notifyOrderStatusChange = async (order, newStatus) => {
  try {
    if (!order || !newStatus) return { success: false, reason: "missing-args" };
    if (!STATUSES.includes(newStatus)) return { success: false, reason: "unknown-status" };

    // The order may arrive populated (from a service that called .populate)
    // or as a raw doc — handle both shapes.
    const customerEmail = order.user?.email || order.customerEmail;
    const customerName = order.user?.name || "Customer";
    if (!customerEmail) return { success: false, reason: "no-customer-email" };

    const tenantId = order.tenantId;
    if (!tenantId) return { success: false, reason: "no-tenant-id" };

    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findById(tenantId)
      .select("name settings.notifications settings.storeName settings.currency")
      .lean();
    if (!tenant) return { success: false, reason: "tenant-not-found" };

    const notifSettings = tenant.settings?.notifications || {};
    const tplOverride = notifSettings.templates?.[newStatus] || {};
    // The "enabled" toggle defaults to true (mongoose default) but a
    // merchant can flip it false. Treat undefined as enabled so a tenant
    // doc that predates the notifications block keeps sending.
    if (tplOverride.enabled === false) {
      return { success: false, reason: "template-disabled" };
    }

    const defaults = DEFAULT_TEMPLATES[newStatus];
    const subjectTpl = tplOverride.subject || defaults.subject;
    const bodyTpl = tplOverride.body || defaults.body;

    const vars = {
      customerName,
      orderNumber: order.orderNumber || "",
      status: newStatus,
      total: `${order.totalAmount ?? ""} ${order.currency || tenant.settings?.currency || "SDG"}`.trim(),
      trackingNumber: order.trackingNumber || "",
      storeName: tenant.settings?.storeName || tenant.name || "Store",
    };

    const subject = render(subjectTpl, vars);
    const body = render(bodyTpl, vars);

    const fromName = notifSettings.fromName || vars.storeName;
    const fromEmail = notifSettings.fromEmail;
    const from = fromEmail ? `${fromName} <${fromEmail}>` : undefined;

    // Wrap the body in a minimal HTML envelope so it renders as a paragraph
    // in HTML clients while staying readable in plain-text fallbacks. We
    // deliberately don't ship a fancy template — the merchant who cares
    // about brand will override `body` with their own HTML anyway.
    const html = `<div style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</div>`;

    const result = await sendEmail({ to: customerEmail, subject, html, from });
    return result;
  } catch (err) {
    logger.error("notifyOrderStatusChange failed", {
      error: err.message,
      orderId: order?._id,
      newStatus,
    });
    return { success: false, error: err.message };
  }
};

/**
 * Notify the merchant (tenant admin) that a new order was placed.
 *
 * Fire-and-forget: callers should NOT await this in a way that blocks
 * the order-creation response. We resolve the tenant admin's email by
 * looking up the Tenant doc in the admin DB (it stores `email` on the
 * tenant root + an optional `settings.notifications.fromEmail` override
 * which we treat as a *send-from* hint, not a destination).
 *
 * Returns the same `{ success, reason?, data? }` envelope as the
 * customer notifier so call sites can log uniformly.
 */
export const notifyMerchantNewOrder = async (order, tenantId) => {
  try {
    if (!order || !tenantId) return { success: false, reason: "missing-args" };

    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findById(tenantId)
      .select("name email settings.notifications settings.storeName settings.currency")
      .lean();
    if (!tenant) return { success: false, reason: "tenant-not-found" };

    const merchantEmail = tenant.email;
    if (!merchantEmail) return { success: false, reason: "no-merchant-email" };

    const storeName = tenant.settings?.storeName || tenant.name || "Store";
    const orderNumber = order.orderNumber || String(order._id || "");
    const total = `${order.totalAmount ?? ""} ${order.currency || tenant.settings?.currency || "SDG"}`.trim();
    const customerName =
      order.user?.name ||
      [order.shippingAddress?.firstName, order.shippingAddress?.lastName].filter(Boolean).join(" ") ||
      order.guestCustomer?.name ||
      "a customer";

    const subject = `New order ${orderNumber} — ${total}`;
    const html =
      `<div style="font-family:sans-serif">` +
      `<h2>New order received</h2>` +
      `<p>You just received order <strong>${escapeHtml(orderNumber)}</strong> from ${escapeHtml(customerName)}.</p>` +
      `<p>Total: <strong>${escapeHtml(total)}</strong></p>` +
      `<p>Open the dashboard to view and fulfill it.</p>` +
      `<p style="color:#888;font-size:12px">${escapeHtml(storeName)}</p>` +
      `</div>`;

    const notifSettings = tenant.settings?.notifications || {};
    const fromName = notifSettings.fromName || storeName;
    const fromEmail = notifSettings.fromEmail;
    const from = fromEmail ? `${fromName} <${fromEmail}>` : undefined;

    const result = await sendEmail({ to: merchantEmail, subject, html, from });
    return result;
  } catch (err) {
    logger.error("notifyMerchantNewOrder failed", {
      error: err.message,
      orderId: order?._id,
      tenantId,
    });
    return { success: false, error: err.message };
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
