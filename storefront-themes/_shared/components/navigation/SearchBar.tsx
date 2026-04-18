import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { storefrontApi } from '../../api/client';
import type { Product } from '../../types/commerce';
import { useStore } from '../../contexts/StoreContext';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'searchBar';

// Command-palette style search. The header renders a pill trigger; activating
// it opens a full-viewport overlay with backdrop-blur, a centered input, and
// results (recent + live products + category shortcuts) stacked underneath.
// Themes get the look for free via `--color-primary`, `--font-heading`, etc.

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  /** Expanded (pill trigger in header) or compact (icon button) */
  variant?: 'expanded' | 'compact';
  /** Visual style: pill (rounded-full) or rounded (rounded-xl) */
  shape?: 'pill' | 'rounded';
  /** Theme accent — falls back to --color-primary CSS var */
  accentColor?: string;
  /** Called when the overlay closes (mirrors previous API for callers) */
  onClose?: () => void;
  /** Start with the overlay open — used by MobileBottomNav's search tab */
  defaultOpen?: boolean;
}

const RECENT_KEY = 'storefront_recent_searches';
const MAX_RECENT = 6;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveRecent(q: string) {
  try {
    const list = loadRecent();
    const next = [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}
function clearRecent() {
  try { localStorage.removeItem(RECENT_KEY); } catch {}
}

export function SearchBar(props: SearchBarProps) {
  const Override = useThemeSlot<React.ComponentType<SearchBarProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    placeholder = 'Search products, brands and more...',
    className,
    variant = 'expanded',
    shape = 'pill',
    accentColor,
    onClose,
    defaultOpen = false,
  } = props;
  const [open, setOpen] = useState(defaultOpen);
  const accent = accentColor || 'var(--color-primary, #2563eb)';
  const radius = shape === 'pill' ? 'rounded-full' : 'rounded-xl';

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  // Global hotkey: "/" opens the overlay (Google/GitHub-style). Ignored when
  // focus is already in an input/textarea/contenteditable so typing "/" in a
  // form field doesn't hijack.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* Header trigger — looks like a search input, acts as a button. */}
      {variant === 'expanded' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open search"
          className={cn(
            'group relative w-full flex items-center gap-2 pl-4 pr-3 py-2.5 text-left text-sm',
            'bg-white/90 border border-gray-200 shadow-sm transition',
            'hover:bg-white hover:border-gray-300',
            radius,
            className
          )}
        >
          <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="flex-1 text-gray-400 truncate">{placeholder}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open search"
          className={cn(
            'p-2 rounded-full text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition',
            className
          )}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      )}

      {open && <SearchOverlay placeholder={placeholder} accent={accent} onClose={handleClose} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay — portaled so it escapes any header `overflow:hidden` ancestor.

interface SearchOverlayProps {
  placeholder: string;
  accent: string;
  onClose: () => void;
}

function SearchOverlay({ placeholder, accent, onClose }: SearchOverlayProps) {
  const navigate = useNavigate();
  const { formatPrice } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const [trending, setTrending] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Focus on mount + lock body scroll while open
  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Preload a few trending products for the empty state
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storefrontApi.getProducts({ limit: 6, sort: '-sales' });
        if (!cancelled) setTrending(res.data?.products || []);
      } catch {
        if (!cancelled) setTrending([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await storefrontApi.getProducts({ search: q, limit: 8 });
        setResults(res.data?.products || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedIndex(-1);
    search(val);
  };

  const goToProduct = (product: Product) => {
    saveRecent(product.name);
    navigate(`/products/${product.slug}`);
    onClose();
  };

  const goToSearch = (q: string) => {
    if (!q.trim()) return;
    saveRecent(q);
    navigate(`/search?q=${encodeURIComponent(q)}`);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && results[selectedIndex]) {
      goToProduct(results[selectedIndex]);
    } else if (query.trim()) {
      goToSearch(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const showEmpty = !query.trim();
  const showResults = query.trim() && (results.length > 0 || loading);
  const showNoResults = query.trim() && !loading && results.length === 0;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh] pb-8 overflow-y-auto"
      onMouseDown={(e) => {
        // Click on backdrop (not inside the panel) closes the overlay.
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-md animate-[fadeIn_.15s_ease-out]"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-2xl animate-[scaleIn_.18s_ease-out]"
        style={{ fontFamily: 'var(--font-heading, inherit)' }}
      >
        {/* Input */}
        <form onSubmit={handleSubmit} className="relative">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Search"
            className="w-full pl-14 pr-14 py-5 text-lg bg-white rounded-2xl shadow-2xl border border-white/20 placeholder:text-gray-400 text-gray-900 focus:outline-none focus:ring-2 transition"
            style={{ ['--tw-ring-color' as any]: accent }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {loading && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2">
              <div
                className="w-4 h-4 border-2 border-gray-200 rounded-full animate-spin"
                style={{ borderTopColor: accent }}
              />
            </div>
          )}
        </form>

        {/* Results panel */}
        <div className="mt-3 bg-white rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Empty state: recent + trending */}
          {showEmpty && (
            <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {recent.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">
                      Recent
                    </span>
                    <button
                      type="button"
                      onClick={() => { clearRecent(); setRecent([]); }}
                      className="text-[11px] text-gray-400 hover:text-gray-700 transition"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => goToSearch(term)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full transition border border-gray-100"
                      >
                        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {term}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {trending.length > 0 && (
                <section>
                  <span className="block mb-3 text-[11px] uppercase tracking-wider font-semibold text-gray-500">
                    Trending now
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {trending.slice(0, 6).map((product) => {
                      const img = product.images?.[0] || 'https://placehold.co/120x120?text=•';
                      return (
                        <button
                          key={product._id}
                          type="button"
                          onClick={() => goToProduct(product)}
                          className="group flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition text-left"
                        >
                          <div className="w-12 h-12 shrink-0 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
                            <img src={img} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
                            <p className="text-xs text-gray-500">{formatPrice(product.price)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {recent.length === 0 && trending.length === 0 && (
                <div className="py-8 text-center">
                  <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm text-gray-500">Start typing to find products</p>
                </div>
              )}
            </div>
          )}

          {/* Live results */}
          {showResults && (
            <>
              <div className="px-5 pt-4 pb-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">
                  Products
                </span>
              </div>
              <div className="max-h-[55vh] overflow-y-auto">
                {results.map((product, i) => {
                  const img = product.images?.[0] || 'https://placehold.co/80x80?text=•';
                  const active = i === selectedIndex;
                  return (
                    <button
                      key={product._id}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(i)}
                      onClick={() => goToProduct(product)}
                      className={cn(
                        'w-full flex items-center gap-4 px-5 py-3 text-left transition border-l-[3px]',
                        active ? 'bg-gray-50' : 'border-transparent hover:bg-gray-50/70'
                      )}
                      style={active ? { borderLeftColor: accent } : undefined}
                    >
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 overflow-hidden flex-shrink-0">
                        <img src={img} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-semibold" style={{ color: accent }}>
                            {formatPrice(product.price)}
                          </span>
                          {product.compareAtPrice && product.compareAtPrice > product.price && (
                            <span className="text-xs text-gray-400 line-through">
                              {formatPrice(product.compareAtPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => goToSearch(query)}
                className="w-full px-5 py-3.5 text-sm text-center font-semibold transition border-t border-gray-100 hover:bg-gray-50"
                style={{ color: accent }}
              >
                See all results for &ldquo;{query}&rdquo; →
              </button>
            </>
          )}

          {/* No results */}
          {showNoResults && (
            <div className="p-10 text-center">
              <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1014.12 11.88 3 3 0 009.88 16.12zM21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-700 mb-1">No products found</p>
              <p className="text-xs text-gray-400">Try a different search term or browse our categories</p>
            </div>
          )}
        </div>

        {/* Keyboard hint footer */}
        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20">↑↓</kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20">↵</kbd>
            select
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20">esc</kbd>
            close
          </span>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { opacity: 0; transform: translateY(-8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
