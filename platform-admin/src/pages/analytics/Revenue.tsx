import { useAuth } from '../../contexts/auth-context';
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import { analyticsApi, type RevenueAnalytics } from '../../lib/api-analytics';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { Sparkline } from '../../components/ui/Sparkline';
import { AnalyticsShell, MetricErrors, RangeControl, Section, StatTile } from './shared';
import { formatKey, money, useAnalytics, useRange } from './hooks';

export default function RevenueAnalyticsPage() {
  const { user } = useAuth();
  const [range, setRange] = useRange();
  const canRead = hasScope(user, PLATFORM_SCOPES.BILLING_READ);
  // Never fire the request for operators without billing.read.
  const { data, loading, error, reload } = useAnalytics<RevenueAnalytics>(analyticsApi.revenue, range, {}, canRead);

  if (!canRead) {
    return (
      <AnalyticsShell user={user} title="Analytics" description="Platform revenue.">
        <ErrorState error="You need the billing.read scope to view revenue analytics." />
      </AnalyticsShell>
    );
  }

  return (
    <AnalyticsShell user={user} title="Analytics" description="What the platform earns: subscription base fees (MRR), recognised commission and statement outcomes — per currency.">
      <RangeControl range={range} onChange={setRange} onRefresh={reload} loading={loading} />
      {loading && !data ? (
        <PageSpinner />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-4">
          <MetricErrors errors={data.errors} />
          {!data.available && <p className="text-sm text-muted-foreground">Billing is not set up on this deployment.</p>}

          <Section title="Monthly recurring revenue" hint="approximation: today's plan assignments">
            {data.mrr.byCurrency.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No paid subscription plans are assigned.</p>
            ) : (
              <div className="space-y-4">
                {data.mrr.byCurrency.map((c) => (
                  <div key={c.currency}>
                    <div className="grid grid-cols-2 gap-2">
                      <StatTile label={`MRR (${c.currency})`} value={<span className="text-lg">{money(c.current.mrr, c.currency)}</span>} />
                      <StatTile label="Paying stores" value={c.current.stores.toLocaleString()} />
                    </div>
                    <Sparkline values={c.series.map((p) => p.mrr)} height={56} className="mt-2 text-primary" label={`MRR in ${c.currency}`} />
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>{formatKey(c.series[0]?.key || '')}</span>
                      <span>{formatKey(c.series[c.series.length - 1]?.key || '')}</span>
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Each bucket counts every store that existed by then at its <em>current</em> plan's base fee (yearly plans ÷ 12). Plan changes inside the window are not replayed.
                </p>
              </div>
            )}
          </Section>

          <Section title="Commission recognised" hint="delivered orders, net of reversals">
            {data.commissionByCurrency.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No commission events in this range.</p>
            ) : (
              <div className="space-y-4">
                {data.commissionByCurrency.map((c) => (
                  <div key={c.currency}>
                    <div className="grid grid-cols-2 gap-2">
                      <StatTile label={`Commission (${c.currency})`} value={<span className="text-lg">{money(c.total, c.currency)}</span>} />
                      <StatTile label="Fee events" value={c.series.reduce((a, p) => a + p.events, 0).toLocaleString()} />
                    </div>
                    <Sparkline values={c.series.map((p) => p.amount)} height={56} className="mt-2 text-emerald-600" label={`Commission in ${c.currency}`} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Statements" hint="by issue date">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <StatTile label="Issued" value={data.statements.reduce((a, s) => a + s.issued, 0)} values={data.statements.map((s) => s.issued)} />
              <StatTile label="Paid" value={data.statements.reduce((a, s) => a + s.paid, 0)} tone="text-emerald-600" />
              <StatTile label="Partially paid" value={data.statements.reduce((a, s) => a + s.partially_paid, 0)} tone="text-amber-600" />
              <StatTile label="Overdue" value={data.statements.reduce((a, s) => a + s.overdue, 0)} tone="text-red-600" />
            </div>
          </Section>
          <p className="text-[11px] text-muted-foreground">As of {new Date(data.generatedAt).toLocaleString()}. Figures cached for 5 minutes.</p>
        </div>
      ) : null}
    </AnalyticsShell>
  );
}
