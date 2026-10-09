/**
 * Guided setup tip (PBI 10-36) — pure helpers, no React or DOM, so the unit
 * tests load this file directly (like ./quickProduct.ts).
 *
 * Screens mark what the tip may point at:
 *
 *   data-guide="brand policies"   the setup steps this element leads to
 *   data-guide-rank="3"           3 = the step's own field, 2 = a card or
 *                                 button that opens the step, 1 = a menu item
 *   data-guide-hint="logo"        optional: which hint to show (else here/go)
 *   data-guide-place="side"       optional: open beside it (sidebar rows)
 *
 * The tip points at the most specific marker on screen for the current step.
 */

export type GuideSide = 'top' | 'bottom' | 'left' | 'right';

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TipPlacement {
  side: GuideSide;
  top: number;
  left: number;
  /** Arrow position along the bubble edge facing the target, in px. */
  arrow: number;
}

export interface PlaceOptions {
  /** 'side' tries beside the target first (sidebar rows). */
  prefer?: 'auto' | 'side';
  dir?: 'ltr' | 'rtl';
  /** Space between the target and the bubble. */
  gap?: number;
  /** Least distance from the area's edges. */
  margin?: number;
}

export const TIP_GAP = 12;
export const TIP_MARGIN = 8;
/** The arrow keeps this far from the bubble's corners. */
export const ARROW_INSET = 18;

export const GUIDE_RANK = Object.freeze({ menu: 1, entry: 2, field: 3 });

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/**
 * Where to draw a bubble of `bubble` size next to `target` inside `area`
 * (the visible part of the screen). Tries below, above, then the sides
 * (beside first for `prefer: 'side'`, the reading end before the start); if
 * nothing fits, the side with the most room, kept inside the area.
 */
export function placeTip(target: Box, bubble: Size, area: Box, opts: PlaceOptions = {}): TipPlacement {
  const gap = opts.gap ?? TIP_GAP;
  const margin = opts.margin ?? TIP_MARGIN;
  const end: GuideSide = opts.dir === 'rtl' ? 'left' : 'right';
  const start: GuideSide = end === 'right' ? 'left' : 'right';
  const order: GuideSide[] =
    opts.prefer === 'side' ? [end, start, 'bottom', 'top'] : ['bottom', 'top', end, start];

  const areaRight = area.left + area.width;
  const areaBottom = area.top + area.height;
  const room: Record<GuideSide, number> = {
    bottom: areaBottom - margin - (target.top + target.height + gap) - bubble.height,
    top: target.top - gap - bubble.height - (area.top + margin),
    right: areaRight - margin - (target.left + target.width + gap) - bubble.width,
    left: target.left - gap - bubble.width - (area.left + margin),
  };
  const side = order.find((s) => room[s] >= 0) ?? order.reduce((best, s) => (room[s] > room[best] ? s : best), order[0]);

  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  if (side === 'top' || side === 'bottom') {
    const left = clamp(cx - bubble.width / 2, area.left + margin, areaRight - margin - bubble.width);
    const top =
      side === 'bottom'
        ? Math.min(target.top + target.height + gap, areaBottom - margin - bubble.height)
        : Math.max(target.top - gap - bubble.height, area.top + margin);
    return { side, top, left, arrow: clamp(cx - left, ARROW_INSET, bubble.width - ARROW_INSET) };
  }
  const top = clamp(cy - bubble.height / 2, area.top + margin, areaBottom - margin - bubble.height);
  const left =
    side === 'right'
      ? Math.min(target.left + target.width + gap, areaRight - margin - bubble.width)
      : Math.max(target.left - gap - bubble.width, area.left + margin);
  return { side, top, left, arrow: clamp(cy - top, ARROW_INSET, bubble.height - ARROW_INSET) };
}

/** Where a target is relative to the visible area. */
export type TargetView = 'in' | 'above' | 'below';

/**
 * 'in' when enough of the target shows to point at it (half of it, or 24px
 * of a tall one); else whether it is scrolled away above or below.
 */
export function targetView(target: Box, area: Box): TargetView {
  const top = Math.max(target.top, area.top);
  const bottom = Math.min(target.top + target.height, area.top + area.height);
  const shown = bottom - top;
  if (shown >= Math.min(target.height / 2, 24) && shown > 0) return 'in';
  return target.top + target.height / 2 < area.top + area.height / 2 ? 'above' : 'below';
}

export interface GuideCandidate {
  rank: number;
  /** Laid out and not hidden or covered by a dialog. */
  shown: boolean;
  view: TargetView;
}

/**
 * Index of the candidate to point at: the most specific rank that is shown;
 * among equals the first one in view, else the first. -1 when none is shown.
 * A field scrolled out of view still wins over a menu item (the tip then
 * offers to scroll to it) — pointing at the menu of the page you are on
 * would only confuse.
 */
export function pickGuideTarget(candidates: readonly GuideCandidate[]): number {
  let best = -1;
  candidates.forEach((c, i) => {
    if (!c.shown) return;
    if (best === -1) {
      best = i;
      return;
    }
    const b = candidates[best];
    if (c.rank > b.rank || (c.rank === b.rank && c.view === 'in' && b.view !== 'in')) best = i;
  });
  return best;
}

/** Parse `data-guide-rank`; unknown values count as the least specific. */
export function parseRank(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : GUIDE_RANK.menu;
}

/** Menu destinations that lead to a setup step (sidebar, the phone "More" sheet). */
export const GUIDE_MENU_STEPS: Readonly<Record<string, string>> = Object.freeze({
  '/dashboard/products': 'product',
  '/dashboard/store': 'brand policies',
});

/** The `data-guide` attributes for a menu link, or none. */
export function guideMenuAttrs(href: string | undefined, place: 'side' | 'auto' = 'side'): Record<string, string> {
  const steps = href ? GUIDE_MENU_STEPS[href] : undefined;
  if (!steps) return {};
  return {
    'data-guide': steps,
    'data-guide-rank': String(GUIDE_RANK.menu),
    ...(place === 'side' ? { 'data-guide-place': 'side' } : {}),
  };
}

/** The `data-guide` attributes for an element of a step: its own field (default) or what opens it. */
export function guideAttrs(steps: string, kind: 'field' | 'entry' = 'field', hint?: string): Record<string, string> {
  return {
    'data-guide': steps,
    'data-guide-rank': String(kind === 'field' ? GUIDE_RANK.field : GUIDE_RANK.entry),
    ...(hint ? { 'data-guide-hint': hint } : {}),
  };
}
