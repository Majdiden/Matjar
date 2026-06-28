/**
 * Inline SVG data-URI image placeholder.
 *
 * The storefront's Content-Security-Policy only allows `img-src` from
 * self / cloudinary / unsplash (plus `data:` and `blob:`), so external
 * placeholder services like placehold.co are BLOCKED and silently fail —
 * leaving broken-image tiles on any catalog with a missing photo. A
 * `data:` URI is CSP-safe, needs no network, and renders instantly.
 *
 * The artwork is a soft neutral panel with a centered image glyph, so a
 * product with no photo still reads as "image coming" rather than broken.
 */
export function placeholderImage(
  width = 600,
  height = 750,
  bg = '#eef2f7',
  fg = '#c2ccd9',
): string {
  const cx = width / 2;
  const cy = height / 2;
  const s = Math.min(width, height) * 0.18;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${bg}"/>` +
    `<g fill="none" stroke="${fg}" stroke-width="${Math.max(2, s * 0.08)}" stroke-linecap="round" stroke-linejoin="round">` +
    `<rect x="${cx - s}" y="${cy - s * 0.8}" width="${s * 2}" height="${s * 1.6}" rx="${s * 0.16}"/>` +
    `<circle cx="${cx - s * 0.4}" cy="${cy - s * 0.25}" r="${s * 0.22}"/>` +
    `<path d="M${cx - s} ${cy + s * 0.55} L${cx - s * 0.2} ${cy - s * 0.1} L${cx + s * 0.45} ${cy + s * 0.45} L${cx + s} ${cy - s * 0.05}"/>` +
    `</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Default product-tile placeholder (4:5). */
export const PRODUCT_PLACEHOLDER = placeholderImage();

/** Small square placeholder for thumbnails (cart line items, compare). */
export const THUMB_PLACEHOLDER = placeholderImage(200, 200);
