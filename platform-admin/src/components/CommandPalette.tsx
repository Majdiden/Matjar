import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Building2, CornerDownLeft, History, Search, Store } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { api, hasScope, PLATFORM_SCOPES, type TenantListRow } from '../lib/api';
import { lockBodyScroll } from '../lib/scrollLock';
import { cn } from '../lib/utils';
import {
  PALETTE_DEBOUNCE_MS,
  PALETTE_MAX_QUERY,
  PALETTE_MIN_STORE_QUERY,
  PALETTE_STORE_LIMIT,
  buildPageIndex,
  currentStoreTabs,
  filterPages,
  pushRecent,
  readRecent,
  storeHost,
  type RecentEntry,
} from '../lib/commandPalette';
import { LifecycleBadge } from './LifecycleBadge';
import { Spinner } from './ui/Spinner';

/**
 * Quick navigator ("command palette"). Opened from the top-bar search button
 * or Ctrl/Cmd+K (see usePaletteShortcut in lib/commandPalette.ts).
 *
 * Sections: Recent (empty query only), Pages (every page/tab the operator can
 * open — derived from components/nav.ts), Stores (server search via the
 * tenants list endpoint, debounced, stale requests aborted).
 *
 * Accessibility: modal dialog with focus trapped inside; the input is an ARIA
 * combobox driving a listbox via aria-activedescendant.
 */
export const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) =>
  open ? <PaletteDialog onClose={onClose} /> : null;

type Item =
  | { key: string; kind: 'page'; to: string; label: string; context: string | null; icon: LucideIcon; recent?: boolean }
  | { key: string; kind: 'store'; to: string; label: string; context: string | null; state?: string | null; recent?: boolean }
  | { key: string; kind: 'all-stores'; to: string; label: string };

interface Section {
  id: string;
  title: string;
  items: Item[];
  /** Non-selectable status row (loading / empty / error) shown under the title. */
  status?: React.ReactNode;
}

type StoreSearch =
  | { status: 'idle' }
  | { status: 'loading'; query: string; rows: TenantListRow[] }
  | { status: 'done'; query: string; rows: TenantListRow[]; total: number }
  | { status: 'error'; query: string; message: string };

const PAGE_RESULT_CAP = 12;

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const titleId = `${baseId}-title`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [stores, setStores] = useState<StoreSearch>({ status: 'idle' });
  const [recent] = useState<RecentEntry[]>(() => readRecent(user));

  const canSearchStores = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const trimmed = query.trim();

  // Focus the input, lock page scroll, and give focus back on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockBodyScroll();
    inputRef.current?.focus();
    return () => {
      unlock();
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  // Remote store search: debounced; each new query aborts the previous request.
  useEffect(() => {
    if (!canSearchStores || trimmed.length < PALETTE_MIN_STORE_QUERY) {
      setStores({ status: 'idle' });
      return;
    }
    setStores((prev) => ({ status: 'loading', query: trimmed, rows: prev.status === 'done' || prev.status === 'loading' ? prev.rows : [] }));
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const data = await api.tenants.list({ q: trimmed, limit: PALETTE_STORE_LIMIT }, { signal: controller.signal });
        setStores({ status: 'done', query: trimmed, rows: data.tenants, total: data.pagination.total });
      } catch (err) {
        // The api interceptor re-wraps errors, so check our own signal.
        if (controller.signal.aborted) return;
        setStores({ status: 'error', query: trimmed, message: err instanceof Error && err.message ? err.message : 'Store search failed.' });
      }
    }, PALETTE_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, canSearchStores]);

  const pageIndex = useMemo(() => {
    const storeTabs = currentStoreTabs(user, location.pathname, Store);
    return [...storeTabs, ...buildPageIndex(user)];
  }, [user, location.pathname]);

  const sections: Section[] = useMemo(() => {
    const out: Section[] = [];
    const pageItem = (p: (typeof pageIndex)[number]): Extract<Item, { kind: 'page' }> => ({
      key: `page:${p.to}`,
      kind: 'page',
      to: p.to,
      label: p.label,
      context: p.context,
      icon: p.icon,
    });

    if (!trimmed) {
      // Only show recents the operator can still open (scopes may have changed).
      const byPath = new Map(pageIndex.map((p) => [p.to, p]));
      const recentItems: Item[] = recent.flatMap((r): Item[] => {
        if (r.kind === 'store') {
          return canSearchStores
            ? [{ key: `recent:${r.to}`, kind: 'store', to: r.to, label: r.label, context: r.context, recent: true }]
            : [];
        }
        const page = byPath.get(r.to);
        return page ? [{ ...pageItem(page), key: `recent:${r.to}`, recent: true }] : [];
      });
      if (recentItems.length) out.push({ id: 'recent', title: 'Recent', items: recentItems });
      out.push({ id: 'pages', title: 'Pages', items: pageIndex.map(pageItem) });
      return out;
    }

    const pages = filterPages(pageIndex, trimmed).slice(0, PAGE_RESULT_CAP);
    if (pages.length) out.push({ id: 'pages', title: 'Pages', items: pages.map(pageItem) });

    if (canSearchStores && trimmed.length >= PALETTE_MIN_STORE_QUERY) {
      const rows = stores.status === 'done' || stores.status === 'loading' ? stores.rows : [];
      const items: Item[] = rows.map((t) => ({
        key: `store:${t._id}`,
        kind: 'store',
        to: `/tenants/${t._id}`,
        label: t.name || t.slug,
        context: [storeHost(t), t.email].filter(Boolean).join(' · '),
        state: t.lifecycle?.state ?? null,
      }));
      let status: React.ReactNode = null;
      if (stores.status === 'loading' && !rows.length) {
        status = (
          <span className="flex items-center gap-2">
            <Spinner className="h-3.5 w-3.5" /> Searching stores…
          </span>
        );
      } else if (stores.status === 'error') {
        status = <span className="text-destructive">{stores.message}</span>;
      } else if (stores.status === 'done' && !rows.length) {
        status = <>No stores match “{trimmed}”.</>;
      }
      if (stores.status === 'done' && stores.total > rows.length) {
        items.push({
          key: 'all-stores',
          kind: 'all-stores',
          to: `/tenants?q=${encodeURIComponent(trimmed)}`,
          label: `See all ${stores.total.toLocaleString()} matching stores`,
        });
      }
      out.push({ id: 'stores', title: 'Stores', items, status });
    }
    return out;
  }, [trimmed, pageIndex, recent, canSearchStores, stores]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : -1;

  // Keep the highlighted option visible while arrowing through a long list.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
    // optionId is derived from a stable useId value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const select = useCallback(
    (item: Item) => {
      if (item.kind === 'page') {
        pushRecent(user, { kind: 'page', to: item.to, label: item.label, context: item.context });
      } else if (item.kind === 'store') {
        pushRecent(user, { kind: 'store', to: item.to, label: item.label, context: item.context });
      }
      onClose();
      navigate(item.to);
    },
    [user, onClose, navigate]
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!flat.length) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((Math.max(activeIndex, 0) + delta + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) select(flat[activeIndex]);
    }
  };

  // Esc closes; Tab cycles within the dialog (focus trap).
  const onDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const announce = (() => {
    if (stores.status === 'loading') return 'Searching…';
    if (!flat.length) return trimmed ? 'No results.' : '';
    return `${flat.length} result${flat.length === 1 ? '' : 's'} available.`;
  })();

  let index = -1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center sm:px-4 sm:pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onDialogKeyDown}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className={cn(
          'relative z-10 flex w-full flex-col overflow-hidden border bg-background shadow-lg',
          'h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          'sm:h-auto sm:max-h-[min(70vh,36rem)] sm:max-w-xl sm:rounded-lg sm:pt-0 sm:pb-0'
        )}
      >
        <h2 id={titleId} className="sr-only">
          Quick navigation
        </h2>
        <div className="flex shrink-0 items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value.slice(0, PALETTE_MAX_QUERY));
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder={canSearchStores ? 'Search pages and stores…' : 'Search pages…'}
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            role="combobox"
            aria-label={canSearchStores ? 'Search pages and stores' : 'Search pages'}
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={PALETTE_MAX_QUERY}
          />
          {stores.status === 'loading' && <Spinner className="h-4 w-4 shrink-0" />}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:border sm:px-1.5 sm:py-0.5 sm:text-[11px] sm:font-medium"
            aria-label="Close search"
          >
            <span className="sm:hidden">Cancel</span>
            <span className="hidden sm:inline">Esc</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          <div id={listId} role="listbox" aria-label="Results">
            {sections.map((section) => {
              const headId = `${baseId}-sec-${section.id}`;
              return (
                <div key={section.id} role="group" aria-labelledby={headId} className="mb-2 last:mb-0">
                  <div
                    id={headId}
                    className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80"
                  >
                    {section.title}
                  </div>
                  {section.status && (
                    <div className="px-2 py-2 text-sm text-muted-foreground" role="presentation">
                      {section.status}
                    </div>
                  )}
                  {section.items.map((item) => {
                    index += 1;
                    const i = index;
                    const isActive = i === activeIndex;
                    return (
                      <div
                        key={item.key}
                        id={optionId(i)}
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => i !== activeIndex && setActive(i)}
                        onClick={() => select(item)}
                        className={cn(
                          'flex min-h-[44px] cursor-pointer select-none items-center gap-3 rounded-md px-2 py-2 text-sm sm:min-h-0',
                          isActive ? 'bg-accent text-accent-foreground' : 'text-foreground'
                        )}
                      >
                        <OptionIcon item={item} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{item.label}</div>
                          {item.kind !== 'all-stores' && item.context && (
                            <div className="truncate text-xs text-muted-foreground">{item.context}</div>
                          )}
                        </div>
                        {item.kind === 'store' && item.state && (
                          <LifecycleBadge state={item.state} className="hidden shrink-0 sm:inline-flex" />
                        )}
                        {isActive && <CornerDownLeft className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {!flat.length && !sections.some((s) => s.status) && (
              <div className="px-2 py-10 text-center text-sm text-muted-foreground">
                {trimmed ? <>No pages match “{trimmed}”.</> : 'Nothing to show.'}
                {canSearchStores && trimmed.length > 0 && trimmed.length < PALETTE_MIN_STORE_QUERY && (
                  <div className="mt-1 text-xs">Type at least {PALETTE_MIN_STORE_QUERY} characters to search stores.</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-4 border-t px-3 py-2 text-[11px] text-muted-foreground sm:flex">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate
          </span>
          <span>
            <Kbd>↵</Kbd> to open
          </span>
          <span>
            <Kbd>Esc</Kbd> to close
          </span>
        </div>
        <div className="sr-only" aria-live="polite">
          {announce}
        </div>
      </div>
    </div>
  );
}

function OptionIcon({ item }: { item: Item }) {
  const Icon = item.kind === 'page' ? item.icon : item.kind === 'store' ? Building2 : Search;
  return (
    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground">
      <Icon className="h-4 w-4" aria-hidden />
      {'recent' in item && item.recent && (
        <History className="absolute -bottom-1 -end-1 h-3.5 w-3.5 rounded-full bg-background p-px" aria-hidden />
      )}
    </span>
  );
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[10px] font-medium">{children}</kbd>
);
