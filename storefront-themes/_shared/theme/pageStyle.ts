import React, { useEffect, useState } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useTheme } from './ThemeProvider';

/**
 * Page styles for the pages the store builds from its own data (About,
 * Contact, policies — PBI 10). The same content is laid out in one of three
 * looks so it reads as part of the theme it is shown in. Every colour and
 * font still comes from the theme's CSS variables; the style only decides
 * shape (radius, borders, tints) and typographic tone.
 *
 * A theme that wants its own page entirely registers a slot instead
 * (PAGE_SLOT below) — the style map is only the default.
 */
export type PageStyle = 'editorial' | 'bold' | 'clean';

export const DEFAULT_PAGE_STYLE: PageStyle = 'clean';

/** Theme slug → page style. Unknown themes get DEFAULT_PAGE_STYLE. */
export const PAGE_STYLE_BY_THEME: Readonly<Record<string, PageStyle>> = Object.freeze({
  aurum: 'editorial',
  atelier: 'editorial',
  elegance: 'editorial',
  beauxe: 'editorial',
  linen: 'editorial',
  artisan: 'editorial',
  kidsworld: 'bold',
  freshmart: 'bold',
  milmaa: 'bold',
  nutreko: 'bold',
  glowing: 'bold',
  sportzone: 'bold',
  modern: 'clean',
  starter: 'clean',
  techhub: 'clean',
  homedecor: 'clean',
  bookshelf: 'clean',
});

/** Slot keys a theme can fill (via ThemeSlotsProvider) to replace a page outright. */
export const PAGE_SLOT = Object.freeze({
  about: 'page.about',
  contact: 'page.contact',
  policy: 'page.policy',
});

export const pageStyleFor = (slug: string | null | undefined): PageStyle =>
  (slug && PAGE_STYLE_BY_THEME[slug]) || DEFAULT_PAGE_STYLE;

/** The page style of the theme being rendered (its own manifest slug first, then the store's). */
export function usePageStyle(): PageStyle {
  const { store } = useStore();
  let slug: string | undefined;
  try {
    slug = useTheme().manifest?.slug;
  } catch {
    // Rendered outside <ThemeProvider> (tests, previews): use the store's theme.
  }
  return pageStyleFor(slug || (typeof store?.theme === 'string' ? store.theme : null));
}

// ─── Shared visual tokens ────────────────────────────────────────────────────

const PRIMARY = 'var(--color-primary, #111827)';
export const FG = 'var(--color-foreground, #111827)';
export const MUTED = 'var(--color-muted, #6b7280)';
export const BG = 'var(--color-background, #ffffff)';
export const BORDER = 'var(--color-border, #e5e7eb)';
export const HEADING_FONT = 'var(--font-family-heading, var(--font-family, inherit))';
export const PRIMARY_COLOR = PRIMARY;
/** Primary pulled a little toward the text colour — readable as icon/text colour even for pale primaries. */
export const PRIMARY_INK = `color-mix(in srgb, ${PRIMARY} 78%, ${FG})`;

/** The primary colour at `percent`% over transparent — a tint that works on light and dark themes. */
export const tint = (percent: number) => `color-mix(in srgb, ${PRIMARY} ${percent}%, transparent)`;

export interface PageStyleTokens {
  /** Radius of cards and buttons. */
  radius: string;
  /** A card (fact, channel, body). */
  card: React.CSSProperties;
  /** Icon badge next to a fact. */
  iconBox: React.CSSProperties;
  /** Section heading (h2). */
  heading: React.CSSProperties;
  headingClass: string;
  /** Small label above a heading. */
  eyebrowClass: string;
  /** Page title (h1). */
  titleClass: string;
  /** Primary button. */
  button: React.CSSProperties;
}

export const PAGE_STYLE_TOKENS: Readonly<Record<PageStyle, PageStyleTokens>> = Object.freeze({
  editorial: {
    radius: 'var(--radius-sm, 2px)',
    card: { borderTop: `1px solid ${BORDER}`, borderRadius: 0, background: 'transparent' },
    iconBox: { color: PRIMARY_INK, background: 'transparent' },
    heading: { fontFamily: HEADING_FONT, color: FG, fontWeight: 400 },
    headingClass: 'text-2xl sm:text-3xl tracking-tight',
    eyebrowClass: 'text-[11px] uppercase tracking-[0.25em] font-medium',
    titleClass: 'text-4xl sm:text-5xl font-normal tracking-tight',
    button: { borderRadius: 'var(--radius-sm, 2px)', letterSpacing: '0.04em' },
  },
  bold: {
    radius: 'var(--radius-lg, 1.25rem)',
    card: { background: tint(9), borderRadius: 'var(--radius-lg, 1.25rem)', border: 'none' },
    iconBox: { color: PRIMARY_INK, background: tint(20), borderRadius: 'var(--radius-pill, 9999px)' },
    heading: { fontFamily: HEADING_FONT, color: FG, fontWeight: 800 },
    headingClass: 'text-2xl sm:text-3xl',
    eyebrowClass: 'text-xs font-bold',
    titleClass: 'text-4xl sm:text-5xl font-extrabold',
    button: { borderRadius: 'var(--radius-pill, 9999px)' },
  },
  clean: {
    radius: 'var(--radius, 0.5rem)',
    card: { border: `1px solid ${BORDER}`, borderRadius: 'var(--radius, 0.5rem)', background: BG },
    iconBox: { color: PRIMARY_INK, background: tint(10), borderRadius: 'var(--radius, 0.5rem)' },
    heading: { fontFamily: HEADING_FONT, color: FG, fontWeight: 700 },
    headingClass: 'text-xl sm:text-2xl',
    eyebrowClass: 'text-xs font-semibold',
    titleClass: 'text-3xl sm:text-4xl font-bold',
    button: { borderRadius: 'var(--radius, 0.5rem)' },
  },
});

export const usePageStyleTokens = (): PageStyleTokens & { style: PageStyle } => {
  const style = usePageStyle();
  return { style, ...PAGE_STYLE_TOKENS[style] };
};

// ─── Text on primary ─────────────────────────────────────────────────────────

const DARK_TEXT = '#111111';
const LIGHT_TEXT = '#ffffff';

/** Relative luminance of a "#rgb"/"#rrggbb"/"rgb(...)" colour, or null when unparseable. */
export function luminance(color: string): number | null {
  const c = color.trim();
  let rgb: number[] | null = null;
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1];
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    const m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (m) rgb = [m[1], m[2], m[3]].map(Number);
  }
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white, whichever reads better on a colour with this luminance. */
export const textOn = (lum: number): string => ((lum + 0.05) / 0.0625 > 1.05 / (lum + 0.05) ? DARK_TEXT : LIGHT_TEXT);

/**
 * Text colour for a primary-coloured fill. Themes don't publish an
 * "on-primary" colour and some primaries are pale (lime, cream), so read the
 * live `--color-primary` and pick black or white. White until mounted.
 */
export function useOnPrimary(): string {
  const { store } = useStore();
  const [color, setColor] = useState(LIGHT_TEXT);
  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
    const lum = raw ? luminance(raw) : null;
    setColor(lum == null ? LIGHT_TEXT : textOn(lum));
  }, [store?.themeCustomization]);
  return color;
}
