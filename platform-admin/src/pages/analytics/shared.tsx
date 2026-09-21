import { NavLink } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Sparkline } from '../../components/ui/Sparkline';
import { GRANULARITIES, type Granularity, type MetricError } from '../../lib/api-analytics';
import { hasScope, type PlatformUser } from '../../lib/api';
import { ANALYTICS_TABS, DAY, ISO_DAY, defaultTo, toDay, type Range } from './hooks';

// ─── Range control ─────────────────────────────────────────────────────────

const PRESETS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '12m', days: 365 },
];

export const RangeControl: React.FC<{ range: Range; onChange: (p: Partial<Range>) => void; onRefresh?: () => void; loading?: boolean }> = ({ range, onChange, onRefresh, loading }) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
      {PRESETS.map((p) => {
        const from = toDay(new Date(Date.now() - p.days * DAY));
        const active = range.from === from && range.to === defaultTo();
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange({ from, to: defaultTo(), granularity: p.days > 120 ? 'month' : p.days > 35 ? 'week' : 'day' })}
            className={`shrink-0 rounded-md border px-2.5 py-1 text-xs ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent'}`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
    <div className="flex items-center gap-2">
      <Input type="date" value={range.from} max={range.to} onChange={(e) => ISO_DAY.test(e.target.value) && onChange({ from: e.target.value })} className="h-8 text-xs" aria-label="From" />
      <span className="text-xs text-muted-foreground">→</span>
      <Input type="date" value={range.to} min={range.from} onChange={(e) => ISO_DAY.test(e.target.value) && onChange({ to: e.target.value })} className="h-8 text-xs" aria-label="To" />
    </div>
    <div className="flex items-center gap-2">
      <Select value={range.granularity} onChange={(e) => onChange({ granularity: e.target.value as Granularity })} className="h-8 w-auto text-xs" aria-label="Granularity">
        {GRANULARITIES.map((g) => (
          <option key={g} value={g}>
            per {g}
          </option>
        ))}
      </Select>
      {onRefresh && (
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      )}
    </div>
  </div>
);

// ─── Shell ─────────────────────────────────────────────────────────────────

export const AnalyticsShell: React.FC<{ user: PlatformUser | null; title: string; description: string; children: React.ReactNode }> = ({ user, title, description, children }) => (
  <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="-mb-px flex gap-1 overflow-x-auto border-b scrollbar-hide">
      {ANALYTICS_TABS.filter((t) => !t.scope || hasScope(user, t.scope)).map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) => `shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${isActive ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          {t.label}
        </NavLink>
      ))}
    </div>
    {children}
  </div>
);

// ─── Presentational pieces ─────────────────────────────────────────────────

export const StatTile: React.FC<{ label: string; value: React.ReactNode; hint?: string; values?: number[]; tone?: string }> = ({ label, value, hint, values, tone }) => (
  <div className="min-w-0 rounded-lg border bg-card p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`mt-1 break-words text-2xl font-semibold tabular-nums ${tone || ''}`}>{value}</div>
    {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    {values && values.length > 1 && <Sparkline values={values} height={36} className="mt-2 text-primary" label={`${label} trend`} />}
  </div>
);

export const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="rounded-lg border bg-card p-3 sm:p-4">
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
    {children}
  </section>
);

export const MetricErrors: React.FC<{ errors: MetricError[] }> = ({ errors }) =>
  errors.length ? (
    <p className="text-xs text-amber-700">
      Some figures are unavailable right now: {errors.map((e) => e.metric).join(', ')}.
    </p>
  ) : null;
