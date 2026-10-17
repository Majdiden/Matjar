import i18n, { type TFunction } from 'i18next';
import type { NotificationItem } from '../contexts/notifications-context';
import { ltrIsolate } from './utils';

/**
 * Client-side notification copy.
 *
 * Translates a notification's title/body at RENDER from its `type` + `data`
 * via the `notifications` i18n namespace, so the in-app NotificationBell and
 * notifications inbox localise to the merchant's dashboard language regardless
 * of the (English) strings the server persisted.
 *
 * Falls back to the stored `title` / `body` when a type has no mapping, so
 * unknown / legacy notifications never render blank.
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ !!  KEEP IN SYNC  !!                                                    │
 * │ Server counterpart: services/notificationCopy.js (push + email)         │
 * │ Copy strings:       i18n/locales/{en,ar}/notifications.json             │
 * │                     (block: notifications.type.<type>)                  │
 * └────────────────────────────────────────────────────────────────────────┘
 */

// Dotted event type → i18n key segment (i18next uses '.' as a separator, so
// the stored dotted `type` can't be a key path directly).
const TYPE_KEY: Record<string, string> = {
  'order.created': 'order_created',
  'payment.manual_submitted': 'payment_manual_submitted',
  'payment.failed': 'payment_failed',
  'refund.created': 'refund_created',
  'return.requested': 'return_requested',
  'stock.low': 'stock_low',
  'webhook.failed': 'webhook_failed',
  'domain.verification_failed': 'domain_verification_failed',
  'staff.invite_accepted': 'staff_invite_accepted',
  'impersonation.requested': 'impersonation_requested',
  'impersonation.approved': 'impersonation_approved',
  'impersonation.denied': 'impersonation_denied',
  'impersonation.started': 'impersonation_started',
  'impersonation.revoked': 'impersonation_revoked',
  'impersonation.ended': 'impersonation_ended',
  'impersonation.expired': 'impersonation_expired',
};

/**
 * Platform announcements (PBI 10-46) carry their own text in both languages
 * (`data.title` / `data.body` = { ar, en }): the dashboard language first,
 * else the other one, else the stored copy. Mirrors the server helper.
 */
export const ANNOUNCEMENT_TYPE = 'platform.announcement';

type TextPair = { ar?: string; en?: string } | undefined;

function announcementCopy(n: NotificationItem): { title: string; body: string } {
  const lang = (i18n.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const other = lang === 'ar' ? 'en' : 'ar';
  const pick = (pair: TextPair, stored?: string) => (pair && (pair[lang] || pair[other])) || stored || '';
  const data = (n.data ?? {}) as { title?: TextPair; body?: TextPair };
  return { title: pick(data.title, n.title) || 'Matjar', body: pick(data.body, n.body ?? '') };
}

function detailSuffix(detail: unknown): string {
  const s = detail == null ? '' : String(detail).trim();
  return s ? ` — ${s}` : '';
}

/**
 * Build the interpolation params from a notification's stored `data`. Mirrors
 * the server helper (services/notificationCopy.js#paramsFor) so every channel
 * renders identically.
 */
function buildParams(data: Record<string, unknown>): Record<string, unknown> {
  const refundAmount =
    data.refundAmount != null ? Number(data.refundAmount) : null;
  const amountStr =
    refundAmount != null && Number.isFinite(refundAmount)
      ? refundAmount.toFixed(2)
      : '';
  const currency = data.currency ? String(data.currency) : '';
  return {
    ...data,
    amount: currency ? `${amountStr} ${currency}`.trim() : amountStr,
    reasonSuffix: detailSuffix(data.reason),
    errorSuffix: detailSuffix(data.error),
    // Domains stay left-to-right inside Arabic sentences.
    ...(typeof data.domain === 'string' && { domain: ltrIsolate(data.domain) }),
  };
}

/**
 * Render a notification's localized { title, body }. `t` may come from any
 * `useTranslation` hook — the `notifications:` namespace prefix targets the
 * right bundle regardless of the hook's default namespace.
 */
export function renderNotificationCopy(
  t: TFunction,
  n: NotificationItem,
): { title: string; body: string } {
  if (n.type === ANNOUNCEMENT_TYPE) return announcementCopy(n);
  const key = TYPE_KEY[n.type];
  if (!key) {
    return { title: n.title, body: n.body ?? '' };
  }
  const params = buildParams(n.data ?? {});
  const title = t(`notifications:notifications.type.${key}.title`, {
    ...params,
    defaultValue: n.title,
  });
  const body = t(`notifications:notifications.type.${key}.body`, {
    ...params,
    defaultValue: n.body ?? '',
  });
  return { title, body };
}
