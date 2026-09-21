import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  RefreshCw,
  Building2,
  ShoppingCart,
  Receipt,
  Activity,
} from 'lucide-react';
import { overviewApi, type CurrencyRow, type OverviewAlert, type OverviewSummary } from '../../lib/api-overview';
import { incidentsApi, SEVERITY_LABEL, STATUS_LABEL, type IncidentSummary } from '../../lib/api-incidents';
import { Siren } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { formatDate } from '../../lib/utils';
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import { useAuth } from '../../contexts/auth-context';

// Order totals / fees are stored in MAJOR units (75 = 75 SDG), unlike the
// cents-based formatMoney helper used for payment provider amounts.
const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

// ─── Small presentational pieces ───────────────────────────────────────────

const Tile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: string;
}> = ({ label, value, hint, href, tone }) => {
  const body = (
    <>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone || ''}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </>
  );
  const cls = 'block rounded-lg border bg-card p-3 text-left min-w-0';
  return href ? (
    <Link to={href} className={`${cls} transition-colors hover:bg-accent`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
};

/** Per-currency rows (GMV / MRR / commission) — never summed across currencies. */
const CurrencyList: React.FC<{ rows: CurrencyRow[]; field: keyof CurrencyRow; empty?: string; sub?: (r: CurrencyRow) => string }> = ({
  rows,
  field,
  empty = '—',
  sub,
}) => {
  if (!rows.length) return <span>{empty}</span>;
  return (
    <div className="space-y-0.5">
      {rows.map((r) => (
        <div key={r.currency} className="flex items-baseline justify-between gap-2 text-base">
          <span className="truncate">{money(Number(r[field] ?? 0), r.currency)}</span>
          {sub && <span className="shrink-0 text-[11px] font-normal text-muted-foreground">{sub(r)}</span>}
        </div>
      ))}
    </div>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section>
    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
      {icon}
      {title}
    </h2>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
  </section>
);

const ALERT_STYLE: Record<OverviewAlert['severity'], { cls: string; icon: React.ReactNode }> = {
  critical: { cls: 'border-red-500/40 bg-red-500/10 text-red-800', icon: <AlertOctagon className="h-4 w-4 shrink-0 text-red-600" /> },
  warning: { cls: 'border-amber-500/40 bg-amber-500/10 text-amber-900', icon: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> },
  info: { cls: 'border-border bg-muted/40 text-foreground', icon: <Info className="h-4 w-4 shrink-0 text-muted-foreground" /> },
};

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Overview() {
  const { user } = useAuth();
  const canReadBilling = hasScope(user, PLATFORM_SCOPES.BILLING_READ);
  const [data, setData] = useState<OverviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await overviewApi.summary(refresh));
      // Open incidents are a separate, cheap call so a failure there never hides the summary.
      incidentsApi.openSummary().then((d) => setIncidents(d.incidents)).catch(() => setIncidents([]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <PageSpinner />;
  if (error && !data) return <ErrorState error={error} onRetry={() => load(true)} />;
  if (!data) return null;

  const { platform, commerce, revenue, operations, alerts } = data;
  const firstFailedQueue = operations.failedJobsByQueue.find((q) => q.failed > 0)?.queue;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Platform at a glance. As of {formatDate(data.generatedAt)}
            {data.errors.length > 0 && (
              <span className="ml-2 text-amber-600">· {data.errors.length} metric(s) unavailable</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {incidents.length > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium text-red-800">
            <Siren className="h-4 w-4" /> {incidents.length} open incident{incidents.length === 1 ? '' : 's'}
          </div>
          <ul className="space-y-1">
            {incidents.map((i) => (
              <li key={i.id}>
                <Link to={`/incidents?open=1&id=${i.id}`} className="flex items-center gap-2 hover:underline">
                  <span className="shrink-0 rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold">{SEVERITY_LABEL[i.severity].split(' ')[0]} {SEVERITY_LABEL[i.severity].split(' ')[1]}</span>
                  <span className="min-w-0 flex-1 truncate">{i.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{STATUS_LABEL[i.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {alerts.length > 0 ? (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.title}>
              <Link
                to={a.href}
                className={`flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:opacity-90 ${ALERT_STYLE[a.severity].cls}`}
              >
                {ALERT_STYLE[a.severity].icon}
                <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
                <span className="shrink-0 rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {a.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800">
          No operational alerts.
        </div>
      )}

      <Section title="Stores" icon={<Building2 className="h-4 w-4" />}>
        <Tile label="Total stores" value={platform.total} href="/tenants" />
        <Tile label="Active" value={platform.active} tone="text-emerald-600" href="/tenants?lifecycle=active" />
        <Tile label="Onboarding" value={platform.onboarding + platform.pending} href="/tenants?lifecycle=onboarding" />
        <Tile label="Suspended" value={platform.suspended} tone={platform.suspended ? 'text-orange-600' : undefined} href="/tenants?lifecycle=suspended" />
        <Tile label="Closed / archived" value={platform.closed + platform.archived} href="/tenants?lifecycle=closed" />
        <Tile label="New stores" value={platform.new7d} hint={`${platform.new30d} in 30 days`} />
        <Tile label="Staff users" value={platform.usersTotal} hint="active merchant staff" />
      </Section>

      <Section title="Commerce" icon={<ShoppingCart className="h-4 w-4" />}>
        <Tile label="Orders today" value={commerce.ordersToday} hint={`${commerce.orders7d} this week`} />
        <Tile label="Orders (30d)" value={commerce.orders30d} />
        <Tile label="Pending orders" value={commerce.pending} tone={commerce.pending ? 'text-amber-600' : undefined} />
        <Tile label="Cancelled (30d)" value={commerce.cancelled30d} hint={`${commerce.refunded30d} refunded`} />
        <Tile
          label="GMV (30d)"
          value={<CurrencyList rows={commerce.gmv30dByCurrency} field="gmv" sub={(r) => `${r.orders} orders`} />}
          hint="merchant sales, not platform revenue"
        />
        <Tile
          label="Average order (30d)"
          value={<CurrencyList rows={commerce.gmv30dByCurrency} field="aov" />}
        />
      </Section>

      {canReadBilling && revenue && (
      <Section title="Revenue" icon={<Receipt className="h-4 w-4" />}>
        <Tile label="MRR" value={<CurrencyList rows={revenue.mrrByCurrency} field="mrr" sub={(r) => `${r.stores} stores`} />} hint="active subscription base fees" href="/billing" />
        <Tile
          label="Commission this month"
          value={<CurrencyList rows={revenue.commissionThisPeriodByCurrency} field="amount" />}
          hint="accrued on delivered orders"
          href="/billing"
        />
        <Tile
          label="Overdue statements"
          value={revenue.overdueStatements}
          tone={revenue.overdueStatements ? 'text-red-600' : undefined}
          hint={revenue.overdueByCurrency.map((r) => money(r.amount ?? 0, r.currency)).join(' · ') || undefined}
          href="/billing?status=overdue"
        />
        <Tile label="Stores on trial" value={revenue.trialStores} href="/tenants?plan=trial" />
      </Section>
      )}

      <Section title="Operations" icon={<Activity className="h-4 w-4" />}>
        <Tile
          label="Failed jobs"
          value={operations.failedJobs}
          tone={operations.failedJobs ? 'text-red-600' : undefined}
          href={`/queues${firstFailedQueue ? `?queue=${firstFailedQueue}` : ''}`}
        />
        <Tile label="Queue backlog" value={operations.queueBacklog} hint="waiting + delayed" href="/queues" />
        <Tile label="Failed webhooks" value={operations.failedWebhooks} tone={operations.failedWebhooks ? 'text-red-600' : undefined} />
        <Tile
          label="Setup problems"
          value={operations.failedSetups + operations.stuckSetups}
          hint={`${operations.failedSetups} failed · ${operations.stuckSetups} stuck`}
          tone={operations.failedSetups ? 'text-red-600' : undefined}
          href="/tenants?setup=failed"
        />
        <Tile label="Domain problems" value={operations.domainProblems} hint="SSL failed / DNS misconfigured" tone={operations.domainProblems ? 'text-amber-600' : undefined} />
        <Tile label="Queues unavailable" value={operations.queuesUnavailable} tone={operations.queuesUnavailable ? 'text-red-600' : undefined} href="/queues" />
      </Section>
    </div>
  );
}
