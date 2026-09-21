import { useAuth } from '../../contexts/auth-context';
import { analyticsApi, type UsageAnalytics, type UsageMetric } from '../../lib/api-analytics';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { BarList } from '../../components/ui/BarList';
import { AnalyticsShell, MetricErrors, RangeControl, Section, StatTile } from './shared';
import { useAnalytics, useRange } from './hooks';

const METRICS: { key: UsageMetric; label: string; unit?: string }[] = [
  { key: 'products', label: 'Products' },
  { key: 'staff', label: 'Staff accounts' },
  { key: 'ordersThisMonth', label: 'Orders this month' },
  { key: 'storageMB', label: 'Storage', unit: 'MB' },
];

export default function UsageAnalyticsPage() {
  const { user } = useAuth();
  const [range, setRange] = useRange();
  const { data, loading, error, reload } = useAnalytics<UsageAnalytics>(analyticsApi.usage, range);

  return (
    <AnalyticsShell user={user} title="Analytics" description="Resource usage across stores from the latest nightly snapshots: how much each store uses and who the heaviest users are.">
      <RangeControl range={range} onChange={setRange} onRefresh={reload} loading={loading} />
      {loading && !data ? (
        <PageSpinner />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-4">
          <MetricErrors errors={data.errors} />
          {!data.available || data.tenants === 0 ? (
            <Section title="Usage">
              <p className="py-4 text-center text-sm text-muted-foreground">No usage snapshots yet. They are taken nightly, or on demand from a tenant's Usage tab.</p>
            </Section>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {METRICS.map((m) => (
                  <StatTile key={m.key} label={`${m.label} (total)`} value={`${(data.totals[m.key] ?? 0).toLocaleString()}${m.unit ? ` ${m.unit}` : ''}`} hint={`${data.tenants} stores`} />
                ))}
              </div>
              {METRICS.map((m) => (
                <div key={m.key} className="grid gap-4 md:grid-cols-2">
                  <Section title={`${m.label} — distribution`} hint="stores per bucket">
                    <BarList rows={(data.distributions[m.key] || []).map((b) => ({ key: b.label, label: `${b.label}${m.unit ? ` ${m.unit}` : ''}`, value: b.count }))} tone="bg-indigo-500/15" />
                  </Section>
                  <Section title={`${m.label} — top stores`}>
                    <BarList
                      rows={(data.top[m.key] || []).map((t) => ({
                        key: t.tenantId,
                        label: t.name,
                        hint: t.slug,
                        value: t.value,
                        display: `${t.value.toLocaleString()}${m.unit ? ` ${m.unit}` : ''}`,
                        href: `/tenants/${t.tenantId}?tab=usage`,
                      }))}
                      empty="No stores with usage."
                    />
                  </Section>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Snapshots as of {data.snapshotAsOf ? new Date(data.snapshotAsOf).toLocaleString() : '—'}. Figures cached for 5 minutes.
              </p>
            </>
          )}
        </div>
      ) : null}
    </AnalyticsShell>
  );
}
