import { useCallback, useEffect, useRef, useState } from 'react';

// Encapsulates the dominant list-page state machine (audit 3.1.6):
// page/limit/search/filters/sort → api call → loading/error/data + reload.
// Modeled on the manual pattern in Orders.tsx/Customers.tsx. This is a
// CONVENTION, not a cache — react-query adoption is explicitly deferred.

export interface ListPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ListQuery<F> {
  page: number;
  limit: number;
  /** Trimmed search term; undefined when empty. */
  search?: string;
  sort?: string;
  filters: F;
}

export interface ListResult<T> {
  items: T[];
  pagination?: Partial<ListPagination>;
}

export interface UseListPageOptions<T, F> {
  /** Performs the API call for the current query and maps the envelope to { items, pagination }. */
  fetcher: (query: ListQuery<F>) => Promise<ListResult<T>>;
  limit?: number;
  initialFilters: F;
  initialSort?: string;
  /** Called on fetch failure (typically toast.error(errMsg(err, ...))). */
  onError?: (err: unknown) => void;
}

export function useListPage<T, F = Record<string, never>>({
  fetcher,
  limit = 20,
  initialFilters,
  initialSort,
  onError,
}: UseListPageOptions<T, F>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(1);
  const [search, setSearchState] = useState('');
  const [filters, setFiltersState] = useState<F>(initialFilters);
  const [sort, setSortState] = useState<string | undefined>(initialSort);
  const [pagination, setPagination] = useState<ListPagination>({ page: 1, limit, total: 0, pages: 1 });
  const [reloadTick, setReloadTick] = useState(0);

  // Keep the latest fetcher/onError without retriggering the effect —
  // pages declare them inline, so they change identity every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetcherRef.current({
          page,
          limit,
          search: search.trim() || undefined,
          sort,
          filters,
        });
        if (cancelled) return;
        setItems(res.items || []);
        setPagination((prev) => ({ ...prev, page, limit, ...(res.pagination || {}) }));
      } catch (err) {
        if (cancelled) return;
        setError(err);
        onErrorRef.current?.(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, limit, search, sort, filters, reloadTick]);

  // Search/filter/sort changes reset to the first page, per the shared
  // list-page convention.
  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const setFilters = useCallback((value: F | ((prev: F) => F)) => {
    setFiltersState(value);
    setPage(1);
  }, []);

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const setSort = useCallback((value: string | undefined) => {
    setSortState(value);
    setPage(1);
  }, []);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  return {
    items,
    /** Escape hatch for optimistic in-place updates (e.g. status change on one row). */
    setItems,
    loading,
    error,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilters,
    setFilter,
    sort,
    setSort,
    pagination,
    reload,
  };
}
