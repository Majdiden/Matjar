import React, { useState, useRef, useCallback, useEffect, Children } from 'react';
import { cn } from '../../utils/cn';

interface CarouselProps {
  children: React.ReactNode;
  className?: string;
  /** Auto-play interval in ms (0 = disabled) */
  autoPlay?: number;
  showArrows?: boolean;
  showDots?: boolean;
  loop?: boolean;
  /** Items visible at once */
  slidesPerView?: number;
  /** Gap between slides in px */
  gap?: number;
  pauseOnHover?: boolean;
  arrowClassName?: string;
  dotClassName?: string;
  dotActiveClassName?: string;
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
}: CarouselProps) {
  const slides = Children.toArray(children);
  const total = slides.length;
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const maxIndex = Math.max(0, total - slidesPerView);

  const goTo = useCallback((index: number) => {
    if (loop) {
      setCurrent(((index % total) + total) % total);
    } else {
      setCurrent(Math.max(0, Math.min(index, maxIndex)));
    }
  }, [total, maxIndex, loop]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Autoplay
  useEffect(() => {
    if (autoPlay <= 0 || paused || total <= slidesPerView) return;
    const timer = setInterval(next, autoPlay);
    return () => clearInterval(timer);
  }, [autoPlay, paused, next, total, slidesPerView]);

  // Touch/swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    if (Math.abs(touchDeltaX.current) > 50) {
      touchDeltaX.current < 0 ? next() : prev();
    }
  };

  // Keyboard
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  };

  if (total === 0) return null;

  const slideWidth = slidesPerView === 1
    ? '100%'
    : `calc((100% - ${gap * (slidesPerView - 1)}px) / ${slidesPerView})`;

  const translateX = slidesPerView === 1
    ? `${-current * 100}%`
    : `calc(${-current} * (${100 / slidesPerView}% + ${gap / slidesPerView}px))`;

  return (
    <div
      className={cn('relative group', className)}
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Carousel"
      aria-roledescription="carousel"
    >
      {/* Track */}
      <div className="overflow-hidden">
        <div
          ref={trackRef}
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(${translateX})`, gap: `${gap}px` }}
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
              aria-label={`Slide ${i + 1} of ${total}`}
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
            className={cn(
              'absolute left-2 top-1/2 -translate-y-1/2 z-10',
              'w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg',
              'flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:bg-white dark:hover:bg-gray-800',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              arrowClassName
            )}
            disabled={!loop && current === 0}
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 z-10',
              'w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg',
              'flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:bg-white dark:hover:bg-gray-800',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              arrowClassName
            )}
            disabled={!loop && current >= maxIndex}
            aria-label="Next slide"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dots */}
      {showDots && total > slidesPerView && (
        <div className="flex justify-center gap-2 mt-4" role="tablist">
          {Array.from({ length: slidesPerView === 1 ? total : maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-all',
                i === current
                  ? cn('bg-gray-800 dark:bg-white scale-110', dotActiveClassName)
                  : cn('bg-gray-300 dark:bg-gray-600 hover:bg-gray-400', dotClassName)
              )}
              role="tab"
              aria-selected={i === current}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CarouselSlide({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('w-full', className)}>{children}</div>;
}
