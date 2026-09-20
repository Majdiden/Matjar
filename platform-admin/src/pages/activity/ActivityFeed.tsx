import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Rss, RefreshCw } from 'lucide-react';
import { auditApi, type ActivityItem } from '../../lib/api-audit';
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select, Label } from '../../components/ui/Input';
import { PageSpinner, EmptyState, ErrorState } from '../../components/ui/Spinner';
import { formatDate, formatRelative } from '../../lib/utils';

const SOURCES = ['', 'platform', 'merchant'] as const;

/**
 * Platform-wide activity feed: what operators did (ledger) and what
 * merchants' staff did in their stores (last 7 days), newest first.
 */
export default function ActivityFeed() {
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.AUDIT_READ);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSource = searchParams.get('source') || '';
  const source = (SOURCES as readonly string[]).includes(rawSource) ? (rawSource as 'platform' | 'merchant' | '') : '';

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(
    async (p: number, append: boolean) => {
      if (!canRead) return;
      setLoading(true);
      setError(null);
      try {
        const data = await auditApi.platformActivity({ page: p, limit: 30, source: source || undefined });
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setHasMore(data.hasMore);
        setPage(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        setLoading(false);
      }
    },
    [canRead, source]
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  if (!canRead) return <ErrorState error="You lack the audit.read scope." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Rss className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
            <p className="text-sm text-muted-foreground">Everything happening across the platform, in plain language. Merchant activity covers the last 7 days.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(1, false)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="max-w-xs space-y-1">
        <Label htmlFor="act-source">Source</Label>
        <Select
          id="act-source"
          value={source}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            if (e.target.value) next.set('source', e.target.value);
            else next.delete('source');
            setSearchParams(next, { replace: true });
          }}
        >
          <option value="">Operators + merchants</option>
          <option value="platform">Operators only</option>
          <option value="merchant">Merchants only</option>
        </Select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => load(1, false)} />
      ) : loading && items.length === 0 ? (
        <PageSpinner />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing yet" description="No activity recorded for this selection." />
      ) : (
        <ol className="space-y-2">
          {items.map((it, i) => {
            const hasDetail = Boolean(it.before || it.after || it.metadata || it.details);
            return (
              <li key={`${it.at}-${i}`} className="rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={it.source === 'platform' ? 'default' : 'secondary'} className="text-[10px]">
                    {it.source === 'platform' ? 'operator' : 'merchant'}
                  </Badge>
                  {it.outcome === 'failure' && <Badge variant="destructive" className="text-[10px]">failed</Badge>}
                  {it.tenant && (
                    <Link to={`/tenants/${it.tenantId}`} className="text-xs text-muted-foreground hover:underline">
                      {it.tenant.name}
                    </Link>
                  )}
                  <span className="ms-auto text-xs text-muted-foreground" title={formatDate(it.at)}>{formatRelative(it.at)}</span>
                </div>
                <div className="mt-1 text-sm [overflow-wrap:anywhere]">{it.label}</div>
                {hasDetail && (
                  <button type="button" className="mt-1 text-xs text-muted-foreground underline" onClick={() => setExpanded(expanded === i ? null : i)}>
                    {expanded === i ? 'Hide details' : 'Details'}
                  </button>
                )}
                {expanded === i && hasDetail && (
                  <pre className="mt-2 max-h-64 max-w-full overflow-auto rounded-md bg-muted p-2 text-[11px]">
                    {JSON.stringify({ before: it.before ?? undefined, after: it.after ?? undefined, metadata: it.metadata ?? undefined, details: it.details ?? undefined }, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => load(page + 1, true)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
