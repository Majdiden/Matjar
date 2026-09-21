import { useAuth } from '../../contexts/auth-context';
import { analyticsApi, type PlatformAnalytics } from '../../lib/api-analytics';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { BarList } from '../../components/ui/BarList';
import { Sparkline } from '../../components/ui/Sparkline';
import { AnalyticsShell, MetricErrors, RangeControl, Section, StatTile } from './shared';
import { formatKey, useAnalytics, useRange } from './hooks';

const STATE_LABEL: Record<string, string> = {
  pending: 'Pending',
  onboarding: 'Onboarding',
  active: 'Active',
  suspended: 'Suspended',
  closed: 'Closed',
  archived: 'Archived',
  legacy: 'Not migrated',
};

export default function PlatformAnalyticsPage() {
  const { user } = useAuth();
  const [range, setRange] = useRange();
  const { data, loading, error, reload } = useAnalytics<PlatformAnalytics>(analyticsApi.platform, range);

  return (
    <AnalyticsShell user={user} title="Analytics" description="How the platform is growing: new stores, activation, churn and plan mix.">
      <RangeControl range={range} onChange={setRange} onRefresh={reload} loading={loading} />
      {loading && !data ? (
        <PageSpinner />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-4">
          <MetricErrors errors={data.errors} />
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatTile label="New stores" value={data.totals.created.toLocaleString()} values={data.series.map((p) => p.created)} />
            <StatTile label="Activated" value={data.totals.activated.toLocaleString()} values={data.series.map((p) => p.activated)} tone="text-emerald-600" />
            <StatTile label="Closed / archived" value={data.totals.closed.toLocaleString()} values={data.series.map((p) => p.closed)} tone="text-red-600" />
            <StatTile label="Suspended" value={data.totals.suspended.toLocaleString()} values={data.series.map((p) => p.suspended)} tone="text-amber-600" />
          </div>

          <Section title="Stores over time" hint={`per ${range.granularity}`}>
            <Sparkline values={data.series.map((p) => p.created)} height={72} className="text-primary" label="New stores over time" />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{formatKey(data.series[0]?.key || '')}</span>
              <span>{formatKey(data.series[data.series.length - 1]?.key || '')}</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 text-start font-medium">Bucket</th>
                    <th className="py-1 text-end font-medium">New</th>
                    <th className="py-1 text-end font-medium">Activated</th>
                    <th className="py-1 text-end font-medium">Closed</th>
                    <th className="py-1 text-end font-medium">Suspended</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series
                    .filter((p) => p.created || p.activated || p.closed || p.suspended)
                    .slice(-24)
                    .map((p) => (
                      <tr key={p.key} className="border-t">
                        <td className="py-1 tabular-nums">{p.key}</td>
                        <td className="py-1 text-end tabular-nums">{p.created}</td>
                        <td className="py-1 text-end tabular-nums">{p.activated}</td>
                        <td className="py-1 text-end tabular-nums">{p.closed}</td>
                        <td className="py-1 text-end tabular-nums">{p.suspended}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Plan distribution" hint="current assignments">
              <BarList rows={data.planDistribution.byFamily.map((f) => ({ key: f.family, label: f.family, value: f.stores }))} tone="bg-indigo-500/15" />
              <div className="mt-3">
                <BarList
                  rows={data.planDistribution.plans.map((p) => ({ key: p.planKey, label: p.name, hint: p.planKey, value: p.stores, href: `/tenants?plan=${encodeURIComponent(p.planKey)}` }))}
                />
              </div>
            </Section>
            <Section title="Lifecycle distribution" hint="all stores">
              <BarList
                rows={data.lifecycleDistribution.map((s) => ({
                  key: s.state,
                  label: STATE_LABEL[s.state] || s.state,
                  value: s.stores,
                  href: s.state === 'legacy' ? undefined : `/tenants?lifecycle=${s.state}`,
                }))}
              />
            </Section>
          </div>

          <Section title="Retention by signup month" hint="% of activated stores still active after N months">
            {data.cohorts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No cohorts in this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 text-start font-medium">Cohort</th>
                      <th className="py-1 text-end font-medium">Stores</th>
                      <th className="py-1 text-end font-medium">Activated</th>
                      <th className="py-1 text-end font-medium">+1 mo</th>
                      <th className="py-1 text-end font-medium">+2 mo</th>
                      <th className="py-1 text-end font-medium">+3 mo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cohorts.map((c) => (
                      <tr key={c.cohort} className="border-t">
                        <td className="py-1 tabular-nums">{c.cohort}</td>
                        <td className="py-1 text-end tabular-nums">{c.size}</td>
                        <td className="py-1 text-end tabular-nums">{c.activated}</td>
                        {c.retainedPct.map((pct, i) => (
                          <td key={i} className="py-1 text-end tabular-nums">
                            {pct == null ? <span className="text-muted-foreground">—</span> : <span className={pct >= 80 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-red-700'}>{pct}%</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
          <p className="text-[11px] text-muted-foreground">As of {new Date(data.generatedAt).toLocaleString()}. Figures cached for 5 minutes.</p>
        </div>
      ) : null}
    </AnalyticsShell>
  );
}
