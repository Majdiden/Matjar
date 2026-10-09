/**
 * Hero content rules shared by every theme (PBI 10).
 *
 * A merchant sets the hero's title, short line, photo and button from My
 * Store. Everything else a theme's hero can show (an eyebrow line, a second
 * button, more slides, collage tiles) used to fall back to the theme's demo
 * copy and stock photos — e.g. "100% plant-based" and "Watch the story" on a
 * gum-arabic store. The rules:
 *   - optional extras (eyebrow, second button, extra headings) show only
 *     when the merchant typed them (advanced editor); no demo fallback;
 *   - the title falls back to the store name, never to demo copy;
 *   - photos: a theme stock photo is never shown next to the merchant's own.
 *     Extra slides that still carry a stock photo are dropped once the
 *     merchant has a photo; collage tiles use the store's product photos,
 *     and are hidden when there are none.
 */

/** Hosts of the stock photos themes ship as defaults. */
const STOCK_IMAGE_HOSTS = ['images.unsplash.com'];

/** True for an empty value or a theme stock photo (not the merchant's own). */
export function isStockImage(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return true;
  try {
    return STOCK_IMAGE_HOSTS.includes(new URL(url, 'https://store.invalid').hostname);
  } catch {
    return true;
  }
}

/** The merchant's own photo among candidates (first non-stock one), or null. */
export function merchantImage(...candidates: unknown[]): string | null {
  for (const c of candidates) if (!isStockImage(c)) return String(c);
  return null;
}

/** Merchant text or nothing: trims, and treats blank as unset. */
export function merchantText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
