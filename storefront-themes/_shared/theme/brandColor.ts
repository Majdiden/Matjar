/**
 * Brand colour palette (PBI 10-39).
 *
 * The merchant's identity colour (brand kit, or their own primary colour)
 * drives more than buttons: each theme paints its signature areas — the top
 * strip, the header or footer band, hero and accent panels — with these
 * tokens. They are written only when the store has its own colour, so a
 * theme uses them as `var(--brand-surface, <its own colour>)` and looks
 * exactly as designed for stores without one.
 *
 *   --brand          the colour itself
 *   --brand-contrast readable text and icons on --brand
 *   --brand-strong   a deeper shade (hover, borders, a darker band)
 *   --brand-soft     a light tint for large calm panels
 *   --brand-ink      the colour for text/icons on a light background
 *                    (darkened when the colour itself is too light to read)
 *
 * Pure, no DOM: unit tested directly.
 */

export interface BrandPalette {
  brand: string;
  contrast: string;
  strong: string;
  soft: string;
  ink: string;
}

export const BRAND_CSS_VARS: Readonly<Record<keyof BrandPalette, string>> = Object.freeze({
  brand: '--brand',
  contrast: '--brand-contrast',
  strong: '--brand-strong',
  soft: '--brand-soft',
  ink: '--brand-ink',
});

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#111111';
/** WCAG AA for large/bold text; body text on bands is short and bold. */
const MIN_CONTRAST = 4.5;

type RGB = [number, number, number];

/** `#abc` / `#aabbcc` → [r, g, b]; null for anything else. */
export function parseHex(value: string | null | undefined): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
}

const toHex = ([r, g, b]: RGB): string =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `a` moved toward `b` by `t` (0..1). */
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t) as RGB;

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

/** The palette for a colour, or null when it is not a hex colour. */
export function brandPalette(color: string | null | undefined): BrandPalette | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const contrast =
    contrastRatio(rgb, WHITE) >= contrastRatio(rgb, parseHex(DARK_TEXT)!) ? LIGHT_TEXT : DARK_TEXT;
  // Darken until readable on white (light yellows, pastels), at most fully.
  let ink = rgb;
  for (let t = 0.1; contrastRatio(ink, WHITE) < MIN_CONTRAST && t <= 1; t += 0.1) ink = mix(rgb, BLACK, t);
  return {
    brand: toHex(rgb),
    contrast,
    strong: toHex(mix(rgb, BLACK, 0.22)),
    soft: toHex(mix(rgb, WHITE, 0.88)),
    ink: toHex(ink),
  };
}

/** CSS declarations for the palette (empty when there is no colour). */
export function brandCssVars(color: string | null | undefined): string {
  const p = brandPalette(color);
  if (!p) return '';
  return (Object.keys(BRAND_CSS_VARS) as (keyof BrandPalette)[])
    .map((k) => `  ${BRAND_CSS_VARS[k]}: ${p[k]};`)
    .join('\n');
}
