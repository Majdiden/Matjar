/**
 * Server-side notification copy (en + ar).
 *
 * Renders a notification's user-facing `title` / `body` from its `type` +
 * `data` in a target language. Used by BOTH outbound channels that leave the
 * browser and therefore can't rely on the dashboard's client-side i18n:
 *
 *   - Web Push  (services/pushNotifications.js)  — recipient's saved language
 *   - Email     (services/notification.js)       — recipient's saved language
 *
 * The in-app surfaces (NotificationBell / notifications inbox) translate at
 * RENDER via the dashboard `notifications` i18n namespace — the copy here MUST
 * be kept in sync with dashboard/src/i18n/locales/{en,ar}/notifications.json
 * (the `notifications.type.*` block).
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ !!  KEEP IN SYNC  !!                                                    │
 * │ Counterpart: dashboard/src/i18n/locales/{en,ar}/notifications.json      │
 * │              (block: notifications.type.<type>)                         │
 * │ + client render helper dashboard/src/lib/notification-copy.ts           │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * When a type isn't mapped here the caller falls back to the durable English
 * `title` / `body` stored on the notification, so existing / unknown
 * notifications never render blank.
 */

import mongoose from "mongoose";
import logger from "../utils/logger.js";

const SUPPORTED = new Set(["en", "ar"]);

/**
 * Normalise an arbitrary language preference to a supported code.
 * Falls through user → tenant → "en". Matches on the leading subtag so
 * "ar-EG" / "en-US" resolve correctly.
 */
export function pickLanguage(...candidates) {
  for (const c of candidates) {
    if (!c || typeof c !== "string") continue;
    const base = c.trim().toLowerCase().split(/[-_]/)[0];
    if (SUPPORTED.has(base)) return base;
  }
  return "en";
}

/**
 * Tiny `{{param}}` interpolation. Missing params render as empty string so a
 * partially-populated `data` never leaks a literal `{{orderNumber}}`.
 */
export function interpolate(template, params = {}) {
  if (typeof template !== "string") return "";
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = params[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/**
 * Compute a trailing " — <detail>" suffix (reason / error) only when present.
 * Kept identical to the client helper so push/email/in-app read the same.
 */
function detailSuffix(detail) {
  const s = detail == null ? "" : String(detail).trim();
  return s ? ` — ${s}` : "";
}

/**
 * Build the interpolation params for a notification from its stored `data`.
 * Centralised so the same derived values (formatted amount, optional suffix)
 * are available to every template.
 */
function paramsFor(notification) {
  const data = notification.data || {};
  const refundAmount =
    data.refundAmount != null ? Number(data.refundAmount) : null;
  const amount =
    refundAmount != null && Number.isFinite(refundAmount)
      ? refundAmount.toFixed(2)
      : "";
  return {
    ...data,
    amount: data.currency ? `${amount} ${data.currency}`.trim() : amount,
    reasonSuffix: detailSuffix(data.reason),
    errorSuffix: detailSuffix(data.error),
  };
}

// ---------------------------------------------------------------------------
// Copy table. One entry per emitted notification type, per language.
// Bodies use {{param}} placeholders resolved from paramsFor(notification).
// ---------------------------------------------------------------------------
const COPY = {
  en: {
    "order.created": {
      title: "New order",
      body: "{{orderNumber}} from {{customerName}}",
    },
    "payment.manual_submitted": {
      title: "Manual payment submitted",
      body: "Order {{orderNumber}} is awaiting manual payment verification",
    },
    "payment.failed": {
      title: "Payment failed",
      body: "Order {{orderNumber}} payment failed{{errorSuffix}}",
    },
    "refund.created": {
      title: "Refund issued",
      body: "{{amount}} refunded on order {{orderNumber}}{{reasonSuffix}}",
    },
    "return.requested": {
      title: "Return requested",
      body: "Return requested on order {{orderNumber}}{{reasonSuffix}}",
    },
    "stock.low": {
      title: "Low stock",
      body: "{{name}} is at {{stock}} (threshold {{threshold}})",
    },
    "webhook.failed": {
      title: "Webhook delivery failed",
      body: "A webhook delivery failed and needs attention",
    },
    "domain.verification_failed": {
      title: "Domain verification failed",
      body: "TXT record for {{domain}} does not match the expected verification code",
    },
    "staff.invite_accepted": {
      title: "Staff invite accepted",
      body: "{{name}} accepted the {{role}} invitation",
    },
    "impersonation.requested": {
      title: "Customer support is requesting access",
      body: "Support wants to access your store for ticket #{{ticket}}. Approve only if you are working with them.",
    },
    "impersonation.approved": {
      title: "Support access approved",
      body: "You approved support access for ticket #{{ticket}}.",
    },
    "impersonation.denied": {
      title: "Support access denied",
      body: "You denied support access for ticket #{{ticket}}.",
    },
    "impersonation.started": {
      title: "Support session started",
      body: "Customer support is now assisting with ticket #{{ticket}}.",
    },
    "impersonation.revoked": {
      title: "Support session ended by you",
      body: "You ended the support session for ticket #{{ticket}}.",
    },
    "impersonation.ended": {
      title: "Support session ended",
      body: "Customer support finished assisting with ticket #{{ticket}}.",
    },
    "impersonation.expired": {
      title: "Support request expired",
      body: "The support request for ticket #{{ticket}} expired.",
    },
  },
  ar: {
    "order.created": {
      title: "طلب جديد",
      body: "{{orderNumber}} من {{customerName}}",
    },
    "payment.manual_submitted": {
      title: "تم إرسال دفعة يدوية",
      body: "الطلب {{orderNumber}} بانتظار التحقق من الدفع اليدوي",
    },
    "payment.failed": {
      title: "فشل الدفع",
      body: "فشل دفع الطلب {{orderNumber}}{{errorSuffix}}",
    },
    "refund.created": {
      title: "تم إصدار استرداد",
      body: "تم استرداد {{amount}} على الطلب {{orderNumber}}{{reasonSuffix}}",
    },
    "return.requested": {
      title: "طلب إرجاع",
      body: "تم طلب إرجاع على الطلب {{orderNumber}}{{reasonSuffix}}",
    },
    "stock.low": {
      title: "مخزون منخفض",
      body: "{{name}} عند {{stock}} (الحد {{threshold}})",
    },
    "webhook.failed": {
      title: "فشل تسليم Webhook",
      body: "فشل تسليم أحد الـ Webhooks ويحتاج إلى مراجعة",
    },
    "domain.verification_failed": {
      title: "فشل التحقق من النطاق",
      body: "سجل TXT للنطاق {{domain}} لا يطابق رمز التحقق المتوقع",
    },
    "staff.invite_accepted": {
      title: "تم قبول دعوة الموظف",
      body: "{{name}} قَبِل دعوة {{role}}",
    },
    "impersonation.requested": {
      title: "الدعم الفني يطلب الوصول",
      body: "يريد الدعم الوصول إلى متجرك للتذكرة رقم {{ticket}}. وافق فقط إذا كنت تعمل معهم.",
    },
    "impersonation.approved": {
      title: "تمت الموافقة على وصول الدعم",
      body: "لقد وافقت على وصول الدعم للتذكرة رقم {{ticket}}.",
    },
    "impersonation.denied": {
      title: "تم رفض وصول الدعم",
      body: "لقد رفضت وصول الدعم للتذكرة رقم {{ticket}}.",
    },
    "impersonation.started": {
      title: "بدأت جلسة الدعم",
      body: "الدعم الفني يساعدك الآن في التذكرة رقم {{ticket}}.",
    },
    "impersonation.revoked": {
      title: "أنهيت جلسة الدعم",
      body: "لقد أنهيت جلسة الدعم للتذكرة رقم {{ticket}}.",
    },
    "impersonation.ended": {
      title: "انتهت جلسة الدعم",
      body: "أنهى الدعم الفني مساعدته في التذكرة رقم {{ticket}}.",
    },
    "impersonation.expired": {
      title: "انتهت صلاحية طلب الدعم",
      body: "انتهت صلاحية طلب الدعم للتذكرة رقم {{ticket}}.",
    },
  },
};

/**
 * Render a notification's { title, body } in `language`. Falls back to the
 * durable English `title` / `body` persisted on the notification when the
 * type is unmapped (unknown / legacy types never render blank).
 */
export function renderNotificationCopy(notification, language) {
  const lang = pickLanguage(language);
  const table = COPY[lang] || COPY.en;
  const entry = table[notification?.type] || COPY.en[notification?.type];
  if (!entry) {
    return {
      title: notification?.title || "Matjar",
      body: notification?.body || "",
    };
  }
  const params = paramsFor(notification);
  return {
    title: interpolate(entry.title, params) || notification?.title || "Matjar",
    body: interpolate(entry.body, params),
  };
}

/**
 * Resolve a tenant's configured store language (admin-DB Tenant.settings).
 * Used as the middle fallback when a recipient user has no explicit language.
 * Best-effort — returns "en" on any lookup failure.
 */
export async function resolveTenantLanguage(tenantId) {
  try {
    const tenant = await mongoose
      .model("Tenant")
      .findById(tenantId)
      .select("settings.language")
      .lean();
    return tenant?.settings?.language || null;
  } catch (err) {
    logger.warn("notificationCopy: tenant language lookup failed", {
      tenantId: String(tenantId),
      error: err?.message,
    });
    return null;
  }
}
