import { Badge } from './ui/Badge';
import { DOMAIN_TONE, type HealthCheck } from '../lib/api-storefront';

/** Domain registry status pill (shared by the Domains page and the tenant Storefront tab). */
export const DomainStatusBadge = ({ status }: { status?: string }) => (
  <Badge variant={DOMAIN_TONE[status || ''] ?? 'outline'}>{(status || '—').replace(/_/g, ' ')}</Badge>
);

/** One storefront health probe result (home / product / cart). */
export const CheckCell = ({ c }: { c?: HealthCheck }) => {
  if (!c) return <span className="text-muted-foreground">—</span>;
  if (c.status === 'skipped') return <span className="text-xs text-muted-foreground" title={c.error || ''}>skipped</span>;
  return (
    <span className={`text-xs ${c.status === 'ok' ? 'text-emerald-600' : 'text-destructive'}`} title={c.error || c.url || ''}>
      {c.status === 'ok' ? '✓' : '✗'} {c.httpStatus ?? ''}{c.ms != null ? ` · ${c.ms}ms` : ''}
      {c.status !== 'ok' && c.error && <div className="text-[10px] text-destructive">{c.error.slice(0, 60)}</div>}
    </span>
  );
};
