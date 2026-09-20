import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { auditApi, type ActivityItem } from '../lib/api-audit';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageSpinner, EmptyState, ErrorState } from '../components/ui/Spinner';
import { formatDate } from '../lib/utils';

/**
 * Tenant "Activity" tab — merged human-readable timeline of what operators
 * did to the store (platform ledger) and what the merchant's staff did
 * inside it (tenant audit log). Newest first, load-more pagination.
 */
export default function TenantActivityTab({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(
    async (p: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const data = await auditApi.tenantActivity(tenantId, { page: p, limit: 25 });
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setHasMore(data.hasMore);
        setPage(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        setLoading(false);
      }
    },
    [tenantId]
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  if (error) return <ErrorState error={error} onRetry={() => load(1, false)} />;
  if (loading && items.length === 0) return <PageSpinner />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Operator actions (platform) and merchant staff actions (merchant), newest first.
        </p>
        <Button variant="outline" size="sm" onClick={() => load(1, false)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No activity yet" description="Nothing has been recorded for this store." />
      ) : (
        <ol className="relative space-y-0 border-s ps-4">
          {items.map((it, i) => {
            const open = expanded === i;
            const hasDetail = it.before != null || it.after != null || it.details != null || it.metadata != null;
            return (
              <li key={`${it.at}-${i}`} className="relative py-2.5">
                <span
                  className={`absolute -start-[21px] top-4 h-2.5 w-2.5 rounded-full ring-2 ring-background ${
                    it.outcome === 'failure' ? 'bg-red-500' : it.source === 'platform' ? 'bg-indigo-500' : 'bg-emerald-500'
                  }`}
                  aria-hidden
                />
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="break-words text-sm [overflow-wrap:anywhere]">{it.label}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant={it.source === 'platform' ? 'secondary' : 'outline'} className="text-[10px] capitalize">
                        {it.source}
                      </Badge>
                      <span className="font-mono">{it.action}</span>
                      {it.outcome === 'failure' && <Badge variant="destructive" className="text-[10px]">failed</Badge>}
                      {hasDetail && (
                        <button type="button" className="underline hover:no-underline" onClick={() => setExpanded(open ? null : i)}>
                          {open ? 'hide details' : 'details'}
                        </button>
                      )}
                    </div>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">{formatDate(it.at)}</time>
                </div>
                {open && (
                  <pre className="mt-2 max-h-56 max-w-full overflow-auto rounded-md bg-muted p-2 text-[11px] sm:text-xs">
                    {JSON.stringify({ before: it.before ?? undefined, after: it.after ?? undefined, details: it.details ?? undefined, metadata: it.metadata ?? undefined }, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => load(page + 1, true)} loading={loading}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
