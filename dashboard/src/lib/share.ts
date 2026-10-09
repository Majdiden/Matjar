// =============================================================================
// Share-link builders for the fallback share menu (used when the device has
// no native share sheet, e.g. most desktop browsers). Pure so the URL
// encoding is unit-tested (tests/unit/share.test.js).
// =============================================================================

export type ShareTarget = 'whatsapp' | 'facebook' | 'telegram';

/** Fallback menu order: the channels Sudanese merchants actually sell on. */
export const SHARE_TARGETS: readonly ShareTarget[] = ['whatsapp', 'facebook', 'telegram'];

/**
 * Intent URL that opens the given app/site with the link ready to send.
 * `message` is free text WITHOUT the url — each target places the url itself.
 */
export function shareIntentUrl(target: ShareTarget, url: string, message: string): string {
  const u = encodeURIComponent(url);
  switch (target) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(message ? `${message} ${url}` : url)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'telegram':
      return `https://t.me/share/url?url=${u}${message ? `&text=${encodeURIComponent(message)}` : ''}`;
  }
}
