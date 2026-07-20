import React, { useState, useRef, useCallback, useEffect, Children } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';

/**
 * Shared Carousel primitive — the slider workhorse behind theme heroes,
 * product rails and gallery strips.
 *
 * Design notes
 * ------------
 * Fully token-driven: arrows, dots and motion read the CSS custom
 * properties ThemeProvider injects (`--color-*`, `--shadow-*`,
 * `--radius-pill`, `--duration-*`, `--ease-*`), so every theme's palette
 * and customizer edits flow through without per-theme overrides. No OS
 * `dark:` variants — the storefront's light/dark is customizer-driven.
 *
 * Functionality
 * -------------
 * - Live touch drag: the track follows the finger (with rubber-band
 *   resistance at the edges when `loop` is off) and snaps on release.
 * - RTL-aware: slide math, swipe direction and arrow keys all flip
 *   automatically when the document is right-to-left (`dir="auto"`).
 * - Autoplay pauses on hover (opt-out), while dragging, when the tab is
 *   hidden, and is disabled entirely under `prefers-reduced-motion`.
 * - Keyboard: Left/Right arrows navigate (direction-aware).
 *
 * Backwards compatibility: every pre-existing prop (`autoPlay`,
 * `showArrows`, `showDots`, `loop`, `slidesPerView`, `gap`,
 * `pauseOnHover`, `arrowClassName`, `dotClassName`, `dotActiveClassName`)
 * keeps its name and default. New props are additive and default to the
 * previous visual behavior.
 */

type ArrowStyle = 'floating' | 'solid' | 'ghost';
type DotStyle = 'dot' | 'pill' | 'line';
type DotPosition = 'below' | 'overlay';

interface CarouselProps {
  children: React.ReactNode;
  className?: string;
  /** Auto-play interval in ms (0 = disabled). Automatically paused on hover / drag / hidden tab and skipped under `prefers-reduced-motion`. */
  autoPlay?: number;
  /** Show prev/next arrows (always visible on touch, fade in on hover for pointer devices). Default: true */
  showArrows?: boolean;
  /** Show pagination dots. Default: true */
  showDots?: boolean;
  /** Wrap around at the ends. Default: true */
  loop?: boolean;
  /** Items visible at once. Default: 1 */
  slidesPerView?: number;
  /** Gap between slides in px. Default: 0 */
  gap?: number;
  /** Pause autoplay while the pointer is over the carousel. Default: true */
  pauseOnHover?: boolean;
  /** Extra classes appended to both arrow buttons. */
  arrowClassName?: string;
  /** Extra classes appended to inactive dots. */
  dotClassName?: string;
  /** Extra classes appended to the active dot. */
  dotActiveClassName?: string;
  /**
   * Arrow visual variant. Default: 'floating'
   * - 'floating': frosted surface-colored circle with shadow (classic).
   * - 'solid':    filled with the theme primary color.
   * - 'ghost':    transparent with a hairline border.
   */
  arrowStyle?: ArrowStyle;
  /**
   * Dot visual variant. Default: 'dot'
   * - 'dot':  equal round dots, active slightly enlarged (classic).
   * - 'pill': round dots, active stretches into a pill.
   * - 'line': short dashes, active elongates.
   */
  dotStyle?: DotStyle;
  /**
   * Where pagination renders. Default: 'below'
   * - 'below':   in normal flow under the track.
   * - 'overlay': floated over the bottom edge on a frosted pill — ideal
   *   for full-bleed heroes and image galleries.
   */
  dotPosition?: DotPosition;
  /**
   * Edge-peek: how many px of the NEXT slide stay visible at the end of
   * the viewport, hinting that the row scrolls. Default: 0 (off).
   */
  peek?: number;
  /**
   * Text direction override. Default: 'auto' (detects the computed
   * direction, so Arabic storefronts slide the right way with no wiring).
   */
  dir?: 'auto' | 'ltr' | 'rtl';
  /** Called with the new index whenever the visible slide changes. */
  onSlideChange?: (index: number) => void;
}

export function Carousel({
  children,
  className,
  autoPlay = 0,
  showArrows = true,
  showDots = true,
  loop = true,
  slidesPerView = 1,
  gap = 0,
  pauseOnHover = true,
  arrowClassName,
  dotClassName,
  dotActiveClassName,
  arrowStyle = 'floating',
  dotStyle = 'dot',
  dotPosition = 'below',
  peek = 0,
  dir = 'auto',
  onSlideChange,
}: CarouselProps) {
  const { t } = useTranslation(['common']);
  const slides = Children.toArray(children);
  const total = slides.length;
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isRTL, setIsRTL] = useState(dir === 'rtl');
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchDeltaX = useRef(0);
  const draggingRef = useRef(false);
  const baseTransformRef = useRef('');
  const baseExprRef = useRef('0px');

  const maxIndex = Math.max(0, total - slidesPerView);
  // Number of distinct positions the track can land on. For a single
  // slide per view this equals `total`; for multi-slide views wrapping
  // beyond `maxIndex` would reveal blank space, so loop within range.
  const positions = maxIndex + 1;

  // Direction detection — Arabic storefronts get correct slide math
  // without any per-theme wiring.
  useEffect(() => {
    if (dir !== 'auto') {
      setIsRTL(dir === 'rtl');
      return;
    }
    const el = rootRef.current;
    if (!el || typeof window === 'undefined') return;
    setIsRTL(window.getComputedStyle(el).direction === 'rtl');
  }, [dir]);

  // Respect prefers-reduced-motion: no autoplay, no slide transition.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const goTo = useCallback((index: number) => {
    const target = loop
      ? ((index % positions) + positions) % positions
      : Math.max(0, Math.min(index, maxIndex));
    setCurrent(target);
    if (target !== current) onSlideChange?.(target);
  }, [positions, maxIndex, loop, current, onSlideChange]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Autoplay — paused on hover/drag, hidden tab, or reduced motion.
  useEffect(() => {
    if (autoPlay <= 0 || paused || reducedMotion || total <= slidesPerView) return;
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) next();
    }, autoPlay);
    return () => clearInterval(timer);
  }, [autoPlay, paused, reducedMotion, next, total, slidesPerView]);

  // ─── Geometry ──────────────────────────────────────────────────
  // slideWidth: with peek, each slide shrinks so `peek`px of the next
  // slide stays visible. Step per index = slide width + gap; the sign
  // flips in RTL because the track is laid out right-to-left.
  const slideWidth =
    slidesPerView === 1 && peek === 0 && gap === 0
      ? '100%'
      : `calc((100% - ${gap * (slidesPerView - 1) + peek}px) / ${slidesPerView})`;
  const sign = isRTL ? 1 : -1;
  const baseExpr = `${sign * current} * (${slideWidth} + ${gap}px)`;
  const baseTransform = `translateX(calc(${baseExpr}))`;
  baseExprRef.current = baseExpr;
  baseTransformRef.current = baseTransform;

  // ─── Touch drag (track follows the finger, snaps on release) ───
  const canGo = useCallback(
    (delta: number) => loop || (delta > 0 ? current < maxIndex : current > 0),
    [loop, current, maxIndex]
  );

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
    draggingRef.current = false;
    setPaused(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!draggingRef.current) {
      // Only claim the gesture once it's clearly horizontal.
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      draggingRef.current = true;
    }
    touchDeltaX.current = dx;
    const trackEl = trackRef.current;
    if (!trackEl) return;
    // "next" is finger-left in LTR, finger-right in RTL.
    const towardNext = isRTL ? dx > 0 : dx < 0;
    const resist = canGo(towardNext ? 1 : -1) ? 1 : 0.3; // rubber-band at the edges
    trackEl.style.transitionDuration = '0ms';
    trackEl.style.transform = `translateX(calc(${baseExprRef.current} + ${dx * resist}px))`;
  };

  const onTouchEnd = () => {
    const dx = touchDeltaX.current;
    const trackEl = trackRef.current;
    if (trackEl) {
      trackEl.style.transitionDuration = '';
      trackEl.style.transform = baseTransformRef.current; // snap back; goTo re-renders if index changes
    }
    if (draggingRef.current) {
      const width = rootRef.current?.offsetWidth || 0;
      const threshold = Math.max(48, width * 0.12);
      if (Math.abs(dx) > threshold) {
        const towardNext = isRTL ? dx > 0 : dx < 0;
        towardNext ? next() : prev();
      }
    }
    draggingRef.current = false;
    touchDeltaX.current = 0;
    setPaused(false);
  };

  // Keyboard — direction-aware.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') isRTL ? next() : prev();
    if (e.key === 'ArrowRight') isRTL ? prev() : next();
  };

  if (total === 0) return null;

  // ─── Arrow variants (token-driven) ─────────────────────────────
  const arrowVariant: Record<ArrowStyle, { className: string; style: React.CSSProperties }> = {
    floating: {
      className: 'backdrop-blur-sm shadow-[var(--shadow-md)] ring-1 ring-black/[0.06] hover:shadow-[var(--shadow-lg)]',
      style: {
        backgroundColor: 'color-mix(in srgb, var(--color-background, #fff) 92%, transparent)',
        color: 'var(--color-foreground, #111)',
      },
    },
    solid: {
      className: 'shadow-[var(--shadow-md)] hover:brightness-110',
      style: {
        backgroundColor: 'var(--color-primary, #2563eb)',
        color: '#fff',
      },
    },
    ghost: {
      className: 'ring-1 hover:backdrop-blur-sm',
      style: {
        backgroundColor: 'transparent',
        color: 'var(--color-foreground, #111)',
        // Tailwind ring color via its own CSS variable (custom props need a cast)
        '--tw-ring-color': 'var(--color-border, #e5e7eb)',
      } as React.CSSProperties,
    },
  };
  const arrow = arrowVariant[arrowStyle] || arrowVariant.floating;

  const arrowBase = cn(
    'absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-[var(--radius-pill,9999px)]',
    'flex items-center justify-center select-none',
    'transition-[opacity,box-shadow,filter,transform] duration-[var(--duration-base,250ms)]',
    'motion-safe:active:scale-95',
    // Always tappable on touch; fades in on hover / keyboard focus for pointer devices.
    'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)]',
    'disabled:opacity-30 disabled:cursor-not-allowed',
    arrow.className,
    arrowClassName
  );

  // ─── Dot variants ──────────────────────────────────────────────
  const dotsCount = positions;
  const activeDot = Math.min(current, dotsCount - 1);

  const dotGeometry = (active: boolean) => {
    switch (dotStyle) {
      case 'pill':
        return cn('h-2 rounded-[var(--radius-pill,9999px)]', active ? 'w-6' : 'w-2');
      case 'line':
        return cn('h-1 rounded-[var(--radius-pill,9999px)]', active ? 'w-8' : 'w-4');
      default:
        return cn('w-2.5 h-2.5 rounded-full', active && 'motion-safe:scale-110');
    }
  };

  const dotColor = (active: boolean): React.CSSProperties =>
    active
      ? { backgroundColor: 'var(--color-primary, #2563eb)' }
      : { backgroundColor: 'color-mix(in srgb, var(--color-foreground, #111) 25%, transparent)' };

  const dots = showDots && total > slidesPerView && (
    <div
      className={cn(
        'flex justify-center gap-2',
        dotPosition === 'overlay'
          ? 'absolute bottom-3 start-1/2 ltr:-translate-x-1/2 rtl:translate-x-1/2 z-10 px-3 py-2 rounded-[var(--radius-pill,9999px)] backdrop-blur-sm'
          : 'mt-4'
      )}
      style={
        dotPosition === 'overlay'
          ? { backgroundColor: 'color-mix(in srgb, var(--color-background, #fff) 55%, transparent)' }
          : undefined
      }
      role="tablist"
    >
      {Array.from({ length: dotsCount }).map((_, i) => {
        const active = i === activeDot;
        return (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={cn(
              'transition-all duration-[var(--duration-base,250ms)] ease-[var(--ease-standard,ease-out)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)] focus-visible:ring-offset-1',
              dotGeometry(active),
              active ? dotActiveClassName : cn('hover:opacity-80', dotClassName)
            )}
            // Inline token colors only when no custom class is supplied,
            // so theme-level `dotClassName` overrides keep full control.
            style={active ? (dotActiveClassName ? undefined : dotColor(true)) : (dotClassName ? undefined : dotColor(false))}
            role="tab"
            aria-selected={active}
            aria-label={t('common:aria.go_to_slide', { index: i + 1, defaultValue: 'Go to slide {{index}}' })}
          />
        );
      })}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={cn('relative group', className)}
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="region"
      aria-label={t('common:aria.carousel')}
      aria-roledescription="carousel"
      aria-live={autoPlay > 0 && !paused ? 'off' : 'polite'}
    >
      {/* Track */}
      <div className="overflow-hidden">
        <div
          ref={trackRef}
          className={cn(
            'flex transition-transform motion-reduce:transition-none',
            'duration-[var(--duration-slow,400ms)] ease-[var(--ease-emphasized,cubic-bezier(0.2,0,0,1))]'
          )}
          style={{ transform: baseTransform, gap: `${gap}px`, touchAction: 'pan-y' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              className="shrink-0"
              style={{ width: slideWidth }}
              role="group"
              aria-roledescription="slide"
              aria-label={t('common:aria.slide_of', { index: i + 1, total, defaultValue: 'Slide {{index}} of {{total}}' })}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {/* Arrows */}
      {showArrows && total > slidesPerView && (
        <>
          <button
            onClick={prev}
            className={cn(arrowBase, 'start-2')}
            style={arrow.style}
            disabled={!loop && current === 0}
            aria-label={t('common:aria.previous_slide')}
          >
            <svg className="w-5 h-5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className={cn(arrowBase, 'end-2')}
            style={arrow.style}
            disabled={!loop && current >= maxIndex}
            aria-label={t('common:aria.next_slide')}
          >
            <svg className="w-5 h-5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dots */}
      {dots}
    </div>
  );
}

export function CarouselSlide({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('w-full', className)}>{children}</div>;
}
