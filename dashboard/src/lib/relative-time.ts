import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * Locale-aware "time ago" for notification rows.
 *
 * `formatDistanceToNow` defaults to English regardless of the dashboard's
 * i18n language, so timestamps like "1 minute ago" stayed English even under
 * Arabic. Pass the active `i18n.language` and we swap in the date-fns Arabic
 * locale (يمنح "منذ دقيقة") for any `ar*` language tag; everything else keeps
 * the built-in English default.
 */
export function relativeTime(iso: string, language?: string): string {
  try {
    const isArabic = (language || '').toLowerCase().startsWith('ar');
    return formatDistanceToNow(new Date(iso), {
      addSuffix: true,
      ...(isArabic ? { locale: ar } : {}),
    });
  } catch {
    return '';
  }
}
