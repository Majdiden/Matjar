/**
 * Guided setup tip (PBI 10-36): a small bubble that points at where to tap
 * next for the current setup step — the step's own field on its page, the
 * card or button that opens it, or the menu item — until the essentials are
 * done. Screens mark the elements (lib/guideTip.ts documents the attributes).
 *
 * Built to help without getting in the way:
 *   - one bubble, never a backdrop: the page stays usable and nothing is
 *     blocked or focus-trapped;
 *   - it follows the target as the page scrolls or changes, flips to the
 *     side with room, and steps aside while a dialog is open or the phone
 *     keyboard is up;
 *   - a target scrolled out of view gets a small "Step 2 · Add your logo ↓"
 *     pill that scrolls to it;
 *   - "Got it" (or Esc) folds it to a pulsing dot on the target; tapping the
 *     dot opens it again. Folding is remembered for that step only, so the
 *     next step is shown once;
 *   - finishing a step says so and names the next one.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSetupGuide } from '../contexts/setup-guide-context';
import { readJson, useStoreKey, writeJson } from '../hooks/useStoreProfile';
import {
  GUIDE_RANK,
  parseRank,
  pickGuideTarget,
  placeTip,
  targetView,
  type Box,
  type TargetView,
  type TipPlacement,
} from '../lib/guideTip';
import type { FirstSaleStepKey } from '../lib/onboarding';
import { cn } from '../lib/utils';

const FOLDED_PREFIX = 'matjar.setupGuide.tipFolded:';
/** Phones and tablets: the sidebar is hidden below this width (Tailwind lg). */
const DESKTOP_MIN_WIDTH = 1024;
const MODAL_SELECTOR = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';
const BUBBLE_WIDTH = 288;

interface Target {
  el: HTMLElement;
  rank: number;
  hint: string;
  side: boolean;
  view: TargetView;
  box: Box;
}

const toBox = (r: DOMRect): Box => ({ top: r.top, left: r.left, width: r.width, height: r.height });

/** The visible part of the screen: the scrolling main area for page content, minus fixed bars. */
function visibleArea(el: HTMLElement): Box {
  const vw = window.innerWidth;
  let top = 0;
  let bottom = window.innerHeight;
  // A fixed bottom bar covers the page, unless the target is in it.
  const bar = document.querySelector<HTMLElement>('[data-guide-inset="bottom"]');
  if (bar && !bar.contains(el) && bar.getClientRects().length) bottom = Math.min(bottom, bar.getBoundingClientRect().top);
  const main = el.closest('main');
  if (main) {
    const r = main.getBoundingClientRect();
    top = Math.max(top, r.top);
    bottom = Math.min(bottom, r.bottom);
  }
  return { top, left: 0, width: vw, height: Math.max(0, bottom - top) };
}

function isShown(el: HTMLElement, modals: Element[]): boolean {
  if (!el.isConnected || !el.getClientRects().length) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  if (el.closest('[aria-hidden="true"], [inert]')) return false;
  if (getComputedStyle(el).visibility === 'hidden') return false;
  // Covered by an open dialog it isn't part of.
  return modals.length === 0 || modals.some((m) => m.contains(el));
}

function findTarget(step: FirstSaleStepKey): Target | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-guide~="${step}"]`));
  if (!els.length) return null;
  const modals = Array.from(document.querySelectorAll(MODAL_SELECTOR));
  const all = els.map((el) => {
    const box = toBox(el.getBoundingClientRect());
    return { el, rank: parseRank(el.dataset.guideRank), shown: isShown(el, modals), view: targetView(box, visibleArea(el)), box };
  });
  const i = pickGuideTarget(all);
  if (i < 0) return null;
  const { el, rank, view, box } = all[i];
  return { el, rank, view, box, hint: el.dataset.guideHint || '', side: el.dataset.guidePlace === 'side' };
}

/** A text field has focus on a phone: the keyboard is up, keep the screen clear. */
function typingOnPhone(): boolean {
  if (window.innerWidth >= DESKTOP_MIN_WIDTH) return false;
  const a = document.activeElement as HTMLElement | null;
  if (!a) return false;
  return a.isContentEditable || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file'].includes((a as HTMLInputElement).type));
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const SetupGuideTip: React.FC = () => {
  const { t, i18n } = useTranslation('onboarding');
  const { active, progress } = useSetupGuide();
  const storeKey = useStoreKey();
  const foldedKey = FOLDED_PREFIX + storeKey;
  const step = active ? progress?.current ?? null : null;

  const [folded, setFolded] = useState<boolean>(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [typing, setTyping] = useState(false);
  const [placement, setPlacement] = useState<TipPlacement | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  // Folding is per step: a new step opens the bubble again.
  useEffect(() => {
    setFolded(step != null && readJson<string>(foldedKey) === step);
  }, [step, foldedKey]);

  const fold = useCallback(
    (value: boolean) => {
      setFolded(value);
      writeJson(foldedKey, value ? step : null);
    },
    [foldedKey, step],
  );

  // Say when a step is done, and what comes next.
  const prevRef = useRef<{ step: FirstSaleStepKey | null; done: number } | null>(null);
  useEffect(() => {
    if (!progress) return;
    const prev = prevRef.current;
    prevRef.current = { step: progress.current, done: progress.doneCount };
    if (!prev || progress.doneCount <= prev.done) return;
    if (progress.complete) toast.success(t('guide.tip.all_done'));
    else if (progress.current) toast.success(t('guide.tip.next', { step: t(`checklist.step.${progress.current}.title`) }));
  }, [progress, t]);

  // Find and follow the target: scrolling (any scroller), resizing, and the
  // page changing under it. Batched to one measure per frame.
  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setTyping(typingOnPhone());
      setTarget(step ? findTarget(step) : null);
    });
  }, [step]);

  useEffect(() => {
    if (!step) {
      setTarget(null);
      return;
    }
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'data-guide', 'class', 'hidden'] });
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    document.addEventListener('focusin', measure);
    document.addEventListener('focusout', measure);
    return () => {
      cancelAnimationFrame(frame.current);
      observer.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      document.removeEventListener('focusin', measure);
      document.removeEventListener('focusout', measure);
    };
  }, [step, measure]);

  // Esc folds the bubble, unless something else (a dialog, a menu) has it.
  useEffect(() => {
    if (!step || folded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector(MODAL_SELECTOR)) return;
      fold(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, folded, fold]);

  const open = Boolean(step && target && !folded && !typing && target.view === 'in');

  useLayoutEffect(() => {
    if (!open || !target || !bubbleRef.current) {
      setPlacement(null);
      return;
    }
    const b = bubbleRef.current.getBoundingClientRect();
    const dir = (document.documentElement.dir || i18n.dir?.() || 'ltr') === 'rtl' ? 'rtl' : 'ltr';
    // Sidebar rows sit outside <main>: the whole screen is theirs.
    const area: Box = target.el.closest('main') ? visibleArea(target.el) : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    setPlacement(placeTip(target.box, { width: b.width, height: b.height }, area, { prefer: target.side ? 'side' : 'auto', dir }));
  }, [open, target, i18n]);

  if (!step || !progress || !target || typing) return null;

  const n = progress.steps.indexOf(step) + 1;
  const stepLabel = t('guide.tip.step', { n, total: progress.total });
  const title = t(`checklist.step.${step}.title`);
  const kind = target.rank >= GUIDE_RANK.field ? 'here' : 'go';
  const hint = t(`guide.tip.${kind}.${target.hint || step}`, { defaultValue: t(`guide.tip.${kind}.${step}`) });
  const motion = !reducedMotion();
  const fixedBox = target.box;

  // Scrolled away: a pill at the edge that brings it back.
  if (target.view !== 'in') {
    if (folded) return null;
    const below = target.view === 'below';
    const area = visibleArea(target.el);
    return createPortal(
      <button
        type="button"
        onClick={() => target.el.scrollIntoView({ block: 'center', behavior: motion ? 'smooth' : 'auto' })}
        className="fixed z-[60] flex min-h-[44px] max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg"
        style={{ left: '50%', top: below ? area.top + area.height - 56 : area.top + 12 }}
      >
        {below ? <ArrowDown className="h-4 w-4 shrink-0" aria-hidden /> : <ArrowUp className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="truncate">
          {stepLabel} · {title}
        </span>
      </button>,
      document.body,
    );
  }

  // Folded: a pulsing dot on the target's corner opens it again.
  if (folded) {
    const rtl = document.documentElement.dir === 'rtl';
    return createPortal(
      <button
        type="button"
        onClick={() => fold(false)}
        aria-label={t('guide.tip.show', { step: title })}
        className="fixed z-[60] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={{ top: fixedBox.top, left: rtl ? fixedBox.left : fixedBox.left + fixedBox.width }}
      >
        <span className="relative flex h-3.5 w-3.5">
          {motion && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />}
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-primary ring-2 ring-background" />
        </span>
      </button>,
      document.body,
    );
  }

  // The arrow's centre sits on the bubble edge facing the target.
  const arrowStyle: React.CSSProperties = !placement
    ? { display: 'none' }
    : placement.side === 'bottom'
      ? { top: 0, left: placement.arrow }
      : placement.side === 'top'
        ? { top: '100%', left: placement.arrow }
        : placement.side === 'right'
          ? { left: 0, top: placement.arrow }
          : { left: '100%', top: placement.arrow };

  return createPortal(
    <>
      {/* A soft ring around the target draws the eye without covering it. */}
      <div
        aria-hidden
        className={cn('pointer-events-none fixed z-[59] rounded-lg ring-2 ring-primary/70 ring-offset-2 ring-offset-background', motion && 'motion-safe:animate-pulse')}
        style={{ top: fixedBox.top, left: fixedBox.left, width: fixedBox.width, height: fixedBox.height }}
      />
      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="setup-guide-tip-title"
        aria-describedby="setup-guide-tip-hint"
        className={cn(
          'fixed z-[60] rounded-xl bg-primary p-3 text-primary-foreground shadow-xl',
          motion && 'transition-[opacity,transform] duration-200',
          placement ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{
          width: `min(${BUBBLE_WIDTH}px, calc(100vw - 16px))`,
          top: placement?.top ?? -9999,
          left: placement?.left ?? -9999,
        }}
      >
        <span aria-hidden className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-primary" style={arrowStyle} />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs opacity-80">
              {progress.steps.map((s, i) => (
                <span
                  key={s}
                  aria-hidden
                  className={cn('h-1.5 rounded-full', i + 1 === n ? 'w-4 bg-primary-foreground' : progress.done[s] ? 'w-1.5 bg-primary-foreground/80' : 'w-1.5 bg-primary-foreground/40')}
                />
              ))}
              <span className="ms-1">{stepLabel}</span>
            </p>
            <p id="setup-guide-tip-title" className="mt-1 font-semibold leading-snug">
              {title}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fold(true)}
            aria-label={t('guide.tip.hide')}
            className="-me-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md opacity-80 hover:bg-primary-foreground/15 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p id="setup-guide-tip-hint" className="relative mt-1 text-sm leading-relaxed opacity-90" aria-live="polite">
          {hint}
        </p>
        <div className="relative mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => fold(true)}
            className="min-h-[40px] rounded-md bg-primary-foreground px-4 text-sm font-semibold text-primary hover:bg-primary-foreground/90"
          >
            {t('guide.tip.got_it')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
};
