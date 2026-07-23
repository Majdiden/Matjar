import React from 'react';
import { cn } from '../lib/utils';

/**
 * Responsive container for a row of StatCards.
 *
 * - Phone (< sm): a horizontal snap-scroll strip — each card is ~72% wide so
 *   the next one peeks in, signalling there's more to swipe. The whole strip
 *   bleeds to the screen edges (`-mx-4` cancels the page's `p-4`); the inset is
 *   re-applied as `px-4` on the INNER track (not the scroll container) so BOTH
 *   the first and last card keep a margin from the edge. Putting the padding on
 *   the scroll container instead drops the trailing side on iOS/WebKit, leaving
 *   one card flush against the screen.
 * - sm and up: a normal grid — pass the desktop column classes via `className`
 *   (e.g. "sm:grid-cols-2 lg:grid-cols-4").
 *
 * Each child is wrapped in the sizing element and stretched to `h-full` so all
 * cards in the row share the same height regardless of content.
 */
export function StatCardRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="-mx-4 snap-x snap-mandatory overflow-x-auto scrollbar-hide sm:mx-0 sm:snap-none sm:overflow-visible">
      <div
        className={cn(
          'flex items-stretch gap-3 px-4 pb-1',
          'sm:grid sm:gap-4 sm:px-0 sm:pb-0',
          className,
        )}
      >
        {React.Children.map(children, (child) =>
          React.isValidElement(child) ? (
            <div className="w-[72%] shrink-0 snap-start sm:w-auto">
              {React.cloneElement(
                child as React.ReactElement<{ className?: string }>,
                {
                  className: cn(
                    (child as React.ReactElement<{ className?: string }>).props
                      .className,
                    'h-full',
                  ),
                },
              )}
            </div>
          ) : (
            child
          ),
        )}
      </div>
    </div>
  );
}

export default StatCardRow;
