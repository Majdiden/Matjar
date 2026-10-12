/**
 * Store identity collected at signup (PBI 10-41): logo, colour and cover
 * photo, so the store already looks like the merchant's when signup ends.
 *
 * The images can only be uploaded once the store exists (uploads need the
 * new store's session), so signup keeps the shrunk files here, in memory,
 * and the setup screen uploads them with the new session's token right after
 * the store is created. Anything that fails is simply left for the guided
 * setup (logo, cover and short line step) to ask again — signup never fails
 * because of a photo.
 *
 * The colour helpers are pure (no DOM) so the unit tests load this file
 * directly; `suggestColorFromImage` is the only browser part.
 */

/** Ready-made colours for merchants without a logo, or who prefer another. */
export const SIGNUP_COLOR_SWATCHES: readonly string[] = Object.freeze([
  '#0f766e', // teal
  '#1d4ed8', // blue
  '#7c3aed', // violet
  '#be185d', // rose
  '#b91c1c', // red
  '#c2410c', // orange
  '#a16207', // amber
  '#15803d', // green
  '#5b3a29', // brown
  '#111827', // ink
]);

export interface PendingIdentity {
  logo?: File | null;
  cover?: File | null;
}

let pending: PendingIdentity = {};

export function setPendingIdentity(next: PendingIdentity): void {
  pending = { ...next };
}

/** The files waiting for upload, removed so they are uploaded once. */
export function takePendingIdentity(): PendingIdentity {
  const out = pending;
  pending = {};
  return out;
}

export const hasPendingIdentity = (): boolean => !!(pending.logo || pending.cover);

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/**
 * The logo's main colour from RGBA pixels: the most common colourful hue,
 * ignoring transparent, near-white, near-black and grey pixels (backgrounds
 * and outlines). Null when the logo has no real colour (black on white),
 * so the merchant picks one.
 */
export function dominantColor(pixels: ArrayLike<number>): string | null {
  const HUE_BUCKETS = 24;
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({ n: 0, r: 0, g: 0, b: 0 }));
  let colourful = 0;
  let total = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    if (a < 128) continue;
    total++;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 510;
    const sat = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    if (light > 0.93 || light < 0.08 || sat < 0.22) continue;
    let h: number;
    const d = max - min;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    const bucket = buckets[Math.floor((((h * 60) + 360) % 360) / (360 / HUE_BUCKETS))];
    bucket.n++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    colourful++;
  }
  // Mostly black/white/grey: no colour to suggest.
  if (!total || colourful / total < 0.06) return null;
  const best = buckets.reduce((a, b) => (b.n > a.n ? b : a));
  return toHex(best.r / best.n, best.g / best.n, best.b / best.n);
}

/** Browser only: the main colour of an image file (sampled small), or null. */
export async function suggestColorFromImage(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const side = 64;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, side, side);
    bitmap.close?.();
    return dominantColor(ctx.getImageData(0, 0, side, side).data);
  } catch {
    return null;
  }
}
