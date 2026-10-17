/**
 * How big a store logo is drawn for its shape (PBI 10-45).
 *
 * Headers give the logo a fixed height. A square logo fills it; a tall logo
 * at that height becomes a sliver and a wide one a long thin strip. The
 * logo's height is scaled by its width/height ratio so every shape reads at a
 * similar size: tall logos grow (up to MAX_TALL), wide ones shrink (down to
 * MIN_WIDE) and grow sideways instead, within the theme's max width.
 *
 * Pure: unit tested directly.
 */

/** Height factor cap for tall logos (they may overhang the slot a little). */
export const MAX_TALL = 1.2;
/** Height factor floor for very wide logos. */
export const MIN_WIDE = 0.6;
/** How strongly a wide logo trades height for width. */
const WIDE_EXPONENT = 0.35;

/** Height factor for a logo `width / height = ratio` (1 for unknown/square). */
export function logoHeightFactor(ratio: number | null | undefined): number {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) return 1;
  if (ratio < 1) return Math.min(MAX_TALL, 1 / Math.sqrt(ratio));
  return Math.max(MIN_WIDE, ratio ** -WIDE_EXPONENT);
}

/** Tailwind height classes (`h-9`, `md:h-12`, `lg:h-[72px]`) vs everything else. */
export function splitHeightClasses(className = ''): { height: string; rest: string } {
  const height: string[] = [];
  const rest: string[] = [];
  for (const token of className.split(/\s+/).filter(Boolean)) {
    (/(^|:)h-/.test(token) ? height : rest).push(token);
  }
  return { height: height.join(' '), rest: rest.join(' ') };
}
