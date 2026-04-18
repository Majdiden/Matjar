import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { useMarket } from '../../hooks/useMarket';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'currencySelector';

/**
 * CurrencySelector — header dropdown for switching the active market.
 *
 * The component reads the active market and the full market list from
 * the SDK `useMarket` hook (which calls /api/markets/resolve and
 * /api/markets). When the customer picks a new market, we persist the
 * choice to localStorage under `selected_market` so the next page load
 * can short-circuit the resolve call (the storefront also reads this
 * key on the server side via a cookie set in a future iteration).
 *
 * Themes can override the trigger button via the `renderTrigger` render
 * prop — useful for themes with a flag-icon design vs. a code badge.
 */
interface CurrencySelectorProps {
  className?: string;
  /**
   * Render-prop for the closed dropdown trigger. Receives the currently
   * active market so the trigger can show the code/symbol/flag.
   */
  renderTrigger?: (active: { code: string; name?: string; flag?: string } | null) => React.ReactNode;
}

export function CurrencySelector(props: CurrencySelectorProps) {
  const Override = useThemeSlot<React.ComponentType<CurrencySelectorProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { className, renderTrigger } = props;
  const { activeMarket, markets, loading } = useMarket();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside to close. Mounted lazily so SSR doesn't trip on
  // document.addEventListener.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (loading || markets.length === 0) {
    // No-op render: we only show the selector when there are at least
    // two markets to choose from. Single-market stores get nothing in
    // the header (no "select" affordance for a non-choice).
    return null;
  }

  if (markets.length < 2) return null;

  const active = activeMarket || markets[0];
  const activeCode = active?.currency || active?.code || 'USD';

  const handleSelect = (market: any) => {
    try {
      localStorage.setItem('selected_market', market._id || market.id || '');
      localStorage.setItem('selected_currency', market.currency || market.code || '');
    } catch {
      // localStorage may be blocked (private mode, embedded iframe) — fail silent
    }
    setOpen(false);
    // Hard reload so prices re-quote in the new currency. A soft refetch
    // would require threading a re-quote into every cart/product hook,
    // which is more invasive than a single reload for a rare action.
    window.location.reload();
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {renderTrigger ? (
          renderTrigger({
            code: activeCode,
            name: active?.name,
            flag: active?.flag,
          })
        ) : (
          <>
            {active?.flag && <span className="text-base leading-none">{active.flag}</span>}
            <span>{activeCode}</span>
            <svg className="w-3 h-3 text-gray-400" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 8L2 4h8z" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-white dark:bg-gray-900 border rounded-lg shadow-xl py-1 max-h-72 overflow-y-auto"
        >
          {markets.map((m) => {
            const isActive =
              (active?._id && m._id === active._id) ||
              (active?.currency && m.currency === active.currency);
            return (
              <li key={m._id || m.code || m.currency}>
                <button
                  type="button"
                  onClick={() => handleSelect(m)}
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800',
                    isActive && 'bg-gray-50 dark:bg-gray-800/60 font-semibold'
                  )}
                >
                  {m.flag && <span className="text-base leading-none">{m.flag}</span>}
                  <span className="flex-1 truncate">{m.name || m.currency}</span>
                  <span className="text-xs text-gray-500">{m.currency}</span>
                  {isActive && (
                    <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
