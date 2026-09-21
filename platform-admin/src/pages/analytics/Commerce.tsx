import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-context';
import { analyticsApi, type CommerceAnalytics } from '../../lib/api-analytics';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { BarList } from '../../components/ui/BarList';
import { Sparkline } from '../../components/ui/Sparkline';
import { AnalyticsShell, MetricErrors, RangeControl, Section, StatTile } from './shared';
import { formatKey, money, useAnalytics, useRange } from './hooks';

const CURRENCY = /^[A-Z]{3}$/;

export default function CommerceAnalyticsPage() {
  const { user } = useAuth();
  const [range, setRange] = useRange();
  const [sp, setSp] = useSearchParams();
  const rawCurrency = (sp.get('currency') || '').toUpperCase();
  const currency = CURRENCY.test(rawCurrency) ? rawCurrency : '';
  const { data, loading, error, reload } = useAnalytics<CommerceAnalytics>(analyticsApi.commerce, range, { currency: currency || undefined });

  const setCurrency = (c: string) => {
    const next = new URLSearchParams(sp);
    if (c) next.set('currency', c);
    else next.delete('currency');
    setSp(next, { replace: true });
  };

  const primary = data?.byCurrency[0] || null;

  return (
    <AnalyticsShell user={user} title="Analytics" description="Orders and merchant sales across every store. GMV is merchant revenue, not platform revenue, and is shown per currency.">
      <RangeControl range={range} onChange={setRange} onRefresh={reload} loading={loading} />
      {loading && !data ? (
        <PageSpinner />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-4">
          <MetricErrors errors={data.errors} />
          {data.byCurrency.length > 1 || currency ? (
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              <button type="button" onClick={() => setCurrency('')} className={`shrink-0 rounded-md border px-2.5 py-1 text-xs ${!currency ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent'}`}>
                All currencies
              </button>
              {[...new Set([...(data.byCurrency.map((c) => c.currency)), ...(currency ? [currency] : [])])].map((c) => (
                <button key={c} type="button" onClick={() => setCurrency(c)} className={`shrink-0 rounded-md border px-2.5 py-1 text-xs ${currency === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent'}`}>
                  {c}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatTile label="Orders" value={data.outcomes.total.toLocaleString()} hint="excluding drafts" values={primary?.series.map((p) => p.orders)} />
            <StatTile label="Paid" value={data.outcomes.paid.toLocaleString()} tone="text-emerald-600" />
            <StatTile label="Cancelled" value={data.outcomes.cancelled.toLocaleString()} tone="text-amber-600" />
            <StatTile label="Refunded" value={data.outcomes.refunded.toLocaleString()} tone="text-red-600" />
          </div>

          {data.byCurrency.length === 0 ? (
            <Section title="Sales">
              <p className="py-4 text-center text-sm text-muted-foreground">No orders in this range.</p>
            </Section>
          ) : (
            data.byCurrency.map((c) => (
              <Section key={c.currency} title={`Sales in ${c.currency}`} hint={`per ${range.granularity}`}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="col-span-2 sm:col-span-1"><StatTile label="GMV" value={<span className="text-lg">{money(c.totals.gmv, c.currency)}</span>} /></div>
                  <StatTile label="Orders" value={c.totals.orders.toLocaleString()} />
                  <StatTile label="Avg order" value={<span className="text-lg">{money(c.totals.aov, c.currency)}</span>} />
                </div>
                <Sparkline values={c.series.map((p) => p.gmv)} height={72} className="mt-3 text-primary" label={`GMV in ${c.currency}`} />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{formatKey(c.series[0]?.key || '')}</span>
                  <span>{formatKey(c.series[c.series.length - 1]?.key || '')}</span>
                </div>
              </Section>
            ))
          )}

          <Section title="Top stores by orders" hint="in range">
            <BarList
              rows={data.topStores.map((s) => ({
                key: s.tenantId,
                label: s.name,
                hint: s.slug,
                value: s.orders,
                display: `${s.orders.toLocaleString()} · ${money(s.gmv, s.currency)}`,
                href: `/tenants/${s.tenantId}`,
              }))}
              empty="No orders in this range."
            />
          </Section>
          <p className="text-[11px] text-muted-foreground">As of {new Date(data.generatedAt).toLocaleString()}. Figures cached for 5 minutes.</p>
        </div>
      ) : null}
    </AnalyticsShell>
  );
}
