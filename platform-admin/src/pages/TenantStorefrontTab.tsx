import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasScope, PLATFORM_SCOPES } from '../lib/api';
import { storefrontApi, storefrontUrl, OVERALL_TONE, type DomainRow, type HealthRow } from '../lib/api-storefront';
import { useAuth } from '../contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageSpinner, ErrorState } from '../components/ui/Spinner';
import { useToast } from '../components/ui/toast-context';
import { formatDate, formatRelative } from '../lib/utils';
import { RefreshCw, Play, ExternalLink, Star } from 'lucide-react';
import { DomainStatusBadge, CheckCell } from '../components/StorefrontBadges';

/**
 * Per-tenant storefront view: registry domains, active theme + published
 * version, and the latest health probe with an on-demand re-check.
 */
export default function TenantStorefrontTab({ tenantId, activeTheme }: { tenantId: string; activeTheme?: string | null }) {
  const toast = useToast();
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [health, setHealth] = useState<HealthRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [d, h] = await Promise.all([storefrontApi.domains.list({ tenantId, limit: 50 }), storefrontApi.health.get(tenantId)]);
      setDomains(d.domains); setHealth(h);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load storefront data'); }
    finally { setLoading(false); }
  }, [tenantId]);
  useEffect(() => { if (canRead) void load(); }, [canRead, load]);

  const check = async () => {
    setChecking(true);
    try { const r = await storefrontApi.health.check(tenantId); setHealth(r); toast.success(`Checked ${r.host}: ${r.overall}`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Check failed'); }
    finally { setChecking(false); }
  };

  if (!canRead) return <ErrorState error="Requires the support.read scope." />;
  if (loading) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Health</CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={check} loading={checking}><Play className="h-3.5 w-3.5" /> Check now</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!health ? <p className="text-muted-foreground">Not probed yet. Run a check to see how the storefront responds.</p> : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={OVERALL_TONE[health.overall]}>{health.overall}</Badge>
                <span className="text-xs text-muted-foreground" title={formatDate(health.checkedAt)}>{formatRelative(health.checkedAt)}{health.source === 'manual' ? ' · manual' : ''}</span>
              </div>
              <div className="break-all text-xs text-muted-foreground" dir="ltr">{health.baseUrl}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div><dt className="text-[11px] uppercase text-muted-foreground">Home</dt><dd><CheckCell c={health.checks.home} /></dd></div>
                <div><dt className="text-[11px] uppercase text-muted-foreground">Product page</dt><dd><CheckCell c={health.checks.product} /></dd></div>
                <div><dt className="text-[11px] uppercase text-muted-foreground">Cart</dt><dd><CheckCell c={health.checks.cart} /></dd></div>
                <div><dt className="text-[11px] uppercase text-muted-foreground">SSL</dt><dd className="text-xs">{health.ssl?.ok == null ? <span className="text-muted-foreground">n/a (http)</span> : health.ssl.ok ? <span className="text-emerald-600">✓ {health.ssl.expiresAt ? `expires ${formatDate(health.ssl.expiresAt)}` : ''}</span> : <span className="text-destructive">✗ {health.ssl.error || ''}</span>}</dd></div>
              </dl>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Theme</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Active theme</span><span className="font-mono">{activeTheme || health?.theme?.slug || '—'}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Theme version</span><span className="font-mono">{health?.theme?.version ? `v${health.theme.version}` : '—'}</span></div>
          <p className="text-xs text-muted-foreground">Catalog status and stores per theme live under <Link to="/storefront/themes" className="underline">Storefront → Themes</Link>. A store's active theme is never changed from the console.</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Domains</CardTitle>
          <Link to={`/storefront/domains?tenantId=${tenantId}`} className="text-xs text-muted-foreground hover:underline">Manage</Link>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? <p className="text-sm text-muted-foreground">No registry rows.</p> : (
            <ul className="divide-y text-sm">
              {domains.map((d) => (
                <li key={d._id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-1">
                    <a href={storefrontUrl(d.hostname) || '#'} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline" dir="ltr">{d.hostname}</a>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    {d.isPrimary && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500" />}
                    <span className="ms-1 text-xs text-muted-foreground">{d.kind.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <DomainStatusBadge status={d.status} />
                    {d.kind !== 'platform_subdomain' && d.ssl?.status && <span className="text-muted-foreground">ssl {d.ssl.status}</span>}
                    {(d.ssl?.error || d.dns?.error) && <span className="text-destructive">{(d.ssl?.error || d.dns?.error || '').slice(0, 60)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
