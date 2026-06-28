import React from 'react';
import { cn } from '../../utils/cn';

interface ProductRailProps {
  children: React.ReactNode;
  /** Desktop column count (md and up). Mobile is always a swipe rail. */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
  /** Per-card width on the mobile rail. Default shows ~1.3 cards so the
   *  next one peeks, signalling swipeability. */
  cardWidthClassName?: string;
}

// Static map so Tailwind's JIT can see the classes (it scans _shared).
const GRID_COLS: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
};

/**
 * ProductRail — responsive product layout.
 *
 * MOBILE: a horizontal, scroll-snapping rail of FULL-SIZE product cards
 * (edge-to-edge, the next card peeking) instead of cramming them into a
 * tiny 2-column grid. Native touch swipe; scrollbar hidden.
 *
 * DESKTOP (md+): a normal `columns`-wide grid.
 *
 * Drop-in replacement for a `<div className="grid grid-cols-2 md:grid-cols-N">`
 * wrapper around product cards. Each child is wrapped so it sizes correctly
 * in both modes — pass the cards directly as children.
 */
export function ProductRail({
  children,
  columns = 4,
  className,
  cardWidthClassName = 'w-[78%] min-[420px]:w-[62%] sm:w-[44%]',
}: ProductRailProps) {
  const gridCols = GRID_COLS[columns] || GRID_COLS[4];
  return (
    <div
      className={cn(
        // Mobile: edge-to-edge swipe rail (bleed past the section padding).
        'flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-pl-4 pb-3 -mx-4 px-4',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        // Desktop: reset to a grid.
        'md:mx-0 md:px-0 md:pb-0 md:gap-6 md:grid md:overflow-visible md:snap-none',
        gridCols,
        className
      )}
    >
      {React.Children.map(children, (child) =>
        child == null || child === false ? (
          child
        ) : (
          <div className={cn('snap-start shrink-0 md:w-auto md:shrink', cardWidthClassName)}>
            {child}
          </div>
        )
      )}
    </div>
  );
}

export default ProductRail;
