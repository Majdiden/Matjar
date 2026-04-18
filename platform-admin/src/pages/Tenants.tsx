import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type Pagination, type TenantListRow } from '../lib/api';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table';
import { PageSpinner, ErrorState, EmptyState } from '../components/ui/Spinner';
import { formatDate, shortId } from '../lib/utils';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PauseCircle,
  Trash2,
  Users,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';

const STATUS_OPTIONS = [
  '',
  'pending',
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
  'deleted',
];

type StatsPayload = {
  total: number;
  byStatus: Record<string, number>;
  setupFailed: number;
  scheduledForDeletion: number;
};

export default function Tenants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const status = searchParams.get('status') || '';
  const q = searchParams.get('q') || '';

  const [qLocal, setQLocal] = useState(q);
  const [rows, setRows] = useState<TenantListRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQLocal(q);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([
        api.tenants.list({
          page,
          limit: 25,
          status: status || undefined,
          q: q || undefined,
        }),
        api.tenants.stats().catch(() => null),
      ]);
      setRows(data.tenants);
      setPagination(data.pagination);
      if (s) setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [page, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value == null || value === '') next.delete(key);
    else next.set(key, value);
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('q', qLocal.trim() || null);
  };

  const goPage = (n: number) => {
    const next = new URLSearchParams(searchParams);
    if (n <= 1) next.delete('page');
    else next.set('page', String(n));
    setSearchParams(next, { replace: true });
  };

  const primaryDomain = (row: TenantListRow): string => {
    const d = row.domains as Record<string, unknown> | undefined;
    if (!d) return row.slug;
    const sub = (d.subdomain as Record<string, string> | undefined)?.fullDomain;
    const cust = (d.customDomain as Record<string, unknown> | undefined)?.name as string | undefined;
    const primaryKey = (d.primaryDomain as string) || 'subdomain';
    if (primaryKey === 'custom' && cust) return cust;
    return sub || row.slug;
  };

  const domainUrl = (host: string) => {
    if (!host) return '#';
    const isLocal = host.endsWith('.localhost') || host === 'localhost';
    const proto = isLocal ? 'http' : 'https';
    const port = isLocal ? ':3000' : '';
    return `${proto}://${host}${port}`;
  };

  const tiles: Array<{
    key: string;
    label: string;
    value: number;
    filter: string | null;
    tone: string;
    icon: React.ReactNode;
  }> = stats
    ? [
        {
          key: 'all',
          label: 'Total',
          value: stats.total,
          filter: null,
          tone: 'text-foreground',
          icon: <Users className="h-4 w-4" />,
        },
        {
          key: 'active',
          label: 'Active',
          value: (stats.byStatus.active || 0) + (stats.byStatus.trial || 0),
          filter: 'active',
          tone: 'text-emerald-600',
          icon: <CheckCircle2 className="h-4 w-4" />,
        },
        {
          key: 'past_due',
          label: 'Past due',
          value: stats.byStatus.past_due || 0,
          filter: 'past_due',
          tone: 'text-amber-600',
          icon: <Clock className="h-4 w-4" />,
        },
        {
          key: 'suspended',
          label: 'Suspended',
          value: stats.byStatus.suspended || 0,
          filter: 'suspended',
          tone: 'text-orange-600',
          icon: <PauseCircle className="h-4 w-4" />,
        },
        {
          key: 'setup_failed',
          label: 'Setup failed',
          value: stats.setupFailed,
          filter: null,
          tone: 'text-red-600',
          icon: <AlertTriangle className="h-4 w-4" />,
        },
        {
          key: 'deletion',
          label: 'Pending deletion',
          value: stats.scheduledForDeletion,
          filter: null,
          tone: 'text-red-600',
          icon: <Trash2 className="h-4 w-4" />,
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            Every store on the platform. Click a row to inspect or take action.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((t) => {
            const active =
              (t.filter === null && status === '' && t.key === 'all') ||
              (t.filter !== null && t.filter === status);
            const clickable = t.filter !== null || t.key === 'all';
            return (
              <button
                key={t.key}
                onClick={() => clickable && updateParam('status', t.filter)}
                disabled={!clickable}
                className={`rounded-lg border bg-card p-3 text-left transition-colors ${
                  clickable ? 'hover:bg-accent' : 'cursor-default opacity-80'
                } ${active ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t.label}</span>
                  <span className={t.tone}>{t.icon}</span>
                </div>
                <div className="mt-1 text-2xl font-semibold">{t.value}</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            placeholder="Search by name, email, slug, domain"
            className="pl-8"
          />
        </form>

        <div className="flex items-center gap-1 rounded-md border bg-card p-1">
          {STATUS_OPTIONS.map((s) => {
            const active = (s || '') === status;
            return (
              <button
                key={s || 'all'}
                onClick={() => updateParam('status', s || null)}
                className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {s || 'All'}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <PageSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No tenants match" description="Try broadening the filters or search terms." />
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Primary domain</TH>
                  <TH>Plan</TH>
                  <TH>Status</TH>
                  <TH>Setup</TH>
                  <TH>Flags</TH>
                  <TH>Created</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => {
                  const host = primaryDomain(row);
                  const setupState = row.setupStatus?.status;
                  const setupFailed = setupState && String(setupState).includes('fail');
                  return (
                    <TR key={row._id}>
                      <TD>
                        <Link
                          to={`/tenants/${row._id}`}
                          className="font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {row.email} · {shortId(row._id)}
                        </div>
                      </TD>
                      <TD>
                        <a
                          href={domainUrl(host)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {host}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TD>
                      <TD>
                        <Badge variant="outline" className="capitalize">
                          {row.subscriptionPlan || 'free'}
                        </Badge>
                      </TD>
                      <TD>
                        <StatusBadge status={row.subscriptionStatus} />
                      </TD>
                      <TD className="text-xs">
                        {setupState ? (
                          <span
                            className={`capitalize ${
                              setupFailed ? 'text-red-600 font-medium' : ''
                            }`}
                          >
                            {String(setupState).replace(/_/g, ' ')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {row.deletionScheduledAt && (
                            <Badge variant="destructive" className="text-[10px]">
                              deletion {formatDate(row.deletionScheduledAt)}
                            </Badge>
                          )}
                          {row.suspendedAt && !row.deletionScheduledAt && (
                            <Badge variant="outline" className="text-[10px]">
                              suspended
                            </Badge>
                          )}
                        </div>
                      </TD>
                      <TD className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Page {pagination.page} of {pagination.pages} · {pagination.total} total
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => goPage(page - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages || loading}
                  onClick={() => goPage(page + 1)}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
