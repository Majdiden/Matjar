import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OBJECT_ID, parsePage, allowed, makeSetParam } from '../../lib/list-helpers';
import { hasScope, PLATFORM_SCOPES, type Pagination } from '../../lib/api';
import { storefrontApi, storefrontUrl, DOMAIN_STATUSES, type DomainRow } from '../../lib/api-storefront';
import { useAuth } from '../../contexts/auth-context';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageSpinner, EmptyState, ErrorState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { formatDate } from '../../lib/utils';
import { RefreshCw, Search, Globe, ExternalLink, RotateCcw, Star, Trash2 } from 'lucide-react';
import { PillStrip, Pager, TenantLink } from '../commerce/shared';
import { DomainStatusBadge } from '../../components/StorefrontBadges';


export default function StorefrontDomains() {
  const toast = useToast();
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const canWrite = hasScope(user, PLATFORM_SCOPES.TENANT_LIFECYCLE);
  const [sp, setSp] = useSearchParams();
  const page = parsePage(sp.get('page'));
  const status = allowed(sp.get('status'), DOMAIN_STATUSES);
  const tenantId = OBJECT_ID.test(sp.get('tenantId') || '') ? sp.get('tenantId')! : '';
  const q = sp.get('q') || '';

  const [qLocal, setQLocal] = useState(q);
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'retry' | 'primary' | 'remove'; row: DomainRow } | null>(null);

  useEffect(() => setQLocal(q), [q]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await storefrontApi.domains.list({ status, tenantId, q, page, limit: 25 });
      setRows(d.domains); setPagination(d.pagination); setCounts(d.counts || {});
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load domains'); }
    finally { setLoading(false); }
  }, [status, tenantId, q, page]);

  useEffect(() => { if (canRead) void load(); }, [canRead, load]);

  const setParam = makeSetParam(sp, setSp);

  if (!canRead) return <ErrorState error="Viewing domains requires the support.read scope." />;

  const run = async (row: DomainRow, fn: () => Promise<unknown>, ok: string) => {
    setBusy(row._id);
    try { await fn(); toast.success(ok); await load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Action failed'); throw err; }
    finally { setBusy(null); }
  };

  const columns: DataListColumn<DomainRow>[] = [
    { id: 'host', header: 'Hostname', primary: true, cell: (r) => (
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <a href={storefrontUrl(r.hostname) || '#'} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline" dir="ltr">{r.hostname}</a>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          {r.isPrimary && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500" />}
        </div>
        <TenantLink id={r.tenantId} tenant={r.tenant} />
      </div>
    ) },
    { id: 'kind', header: 'Kind', cell: (r) => <span className="text-xs">{r.kind.replace(/_/g, ' ')}</span> },
    { id: 'status', header: 'Status', cell: (r) => <DomainStatusBadge status={r.status} /> },
    { id: 'ssl', header: 'SSL', cell: (r) => r.kind === 'platform_subdomain' ? <span className="text-xs text-muted-foreground">platform</span> : (
      <div className="text-xs"><span className="capitalize">{r.ssl?.status || '—'}</span>{r.ssl?.expiresAt && <div className="text-muted-foreground">exp {formatDate(r.ssl.expiresAt)}</div>}{r.ssl?.error && <div className="text-destructive">{r.ssl.error.slice(0, 80)}</div>}</div>
    ) },
    { id: 'dns', header: 'DNS', fullWidthOnMobile: true, cell: (r) => r.kind === 'platform_subdomain' ? <span className="text-xs text-muted-foreground">—</span> : (
      <div className="text-xs"><span dir="ltr">{r.dns?.targetType ? `${r.dns.targetType} → ${r.dns.expectedTarget}` : '—'}</span>{r.dns?.error && <div className="text-destructive">{r.dns.error.slice(0, 80)}</div>}</div>
    ) },
    { id: 'updated', header: 'Updated', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span> },
    { id: 'actions', align: 'end', cell: (r) => canWrite && r.kind !== 'platform_subdomain' ? (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" disabled={busy === r._id || r.status === 'pending_dns' || r.status === 'disabled'} onClick={() => setConfirm({ kind: 'retry', row: r })} title="Retry DNS/SSL verification"><RotateCcw className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="sm" disabled={busy === r._id || r.isPrimary || r.status !== 'active'} onClick={() => setConfirm({ kind: 'primary', row: r })} title="Set as primary"><Star className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy === r._id} onClick={() => setConfirm({ kind: 'remove', row: r })} title="Remove"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    ) : null },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-indigo-600" />
          <div><h1 className="text-2xl font-bold tracking-tight">Domains</h1><p className="text-sm text-muted-foreground">Every hostname in the registry. Platform subdomains are managed automatically.</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['active', 'provisioning_ssl', 'ssl_failed', 'dns_misconfigured'] as const).map((k) => (
          <button key={k} onClick={() => setParam('status', status === k ? null : k)} className={`rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent ${status === k ? 'ring-2 ring-primary' : ''}`}>
            <div className="text-xs text-muted-foreground">{k.replace(/_/g, ' ')}</div>
            <div className={`mt-1 text-2xl font-semibold ${k === 'ssl_failed' || k === 'dns_misconfigured' ? (counts[k] ? 'text-red-600' : '') : ''}`}>{counts[k] || 0}</div>
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setParam('q', qLocal.trim() || null); }} className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={qLocal} onChange={(e) => setQLocal(e.target.value)} placeholder="Hostname" className="pl-8" />
      </form>
      {tenantId && <div className="text-xs text-muted-foreground">Filtered to one store. <button className="underline" onClick={() => setParam('tenantId', null)}>Clear</button></div>}
      <PillStrip options={DOMAIN_STATUSES} value={status} onChange={(v) => setParam('status', v || null)} allLabel="All statuses" />

      {error ? <ErrorState error={error} onRetry={load} />
        : loading && rows.length === 0 ? <PageSpinner />
        : rows.length === 0 ? <EmptyState title="No domains match" />
        : <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />}
      <Pager pagination={pagination} page={page} loading={loading} onPage={(n) => setParam('page', n <= 1 ? null : String(n))} />

      <ConfirmModal
        open={confirm?.kind === 'retry'} onClose={() => setConfirm(null)}
        title="Retry verification" description={`Re-run the DNS check and SSL provisioning for ${confirm?.row.hostname}. Ownership must already be proven.`}
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', placeholder: 'Merchant fixed their DNS…', help: 'Recorded in the audit ledger.' }]}
        confirmLabel="Retry"
        onConfirm={async (v) => { if (confirm) await run(confirm.row, () => storefrontApi.domains.retry(confirm.row._id, v.reason?.trim() || undefined), 'Verification re-run'); }}
      />
      <ConfirmModal
        open={confirm?.kind === 'primary'} onClose={() => setConfirm(null)}
        title="Set primary domain" description={`Make ${confirm?.row.hostname} the canonical host for this store. Other hosts will redirect to it.`}
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', help: 'Recorded in the audit ledger.' }]}
        confirmLabel="Set primary"
        onConfirm={async (v) => { if (confirm) await run(confirm.row, () => storefrontApi.domains.setPrimary(confirm.row._id, v.reason?.trim() || undefined), 'Primary domain updated'); }}
      />
      <ConfirmModal
        open={confirm?.kind === 'remove'} onClose={() => setConfirm(null)}
        title="Remove custom domain" description="Deletes the registry row and revokes its certificate. The store falls back to its platform subdomain. The merchant will need to add the domain again."
        confirmPhrase={confirm?.row.hostname}
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 4, help: 'Required. Recorded in the audit ledger.' }]}
        confirmLabel="Remove domain" confirmVariant="destructive"
        onConfirm={async (v) => { if (confirm) await run(confirm.row, () => storefrontApi.domains.remove(confirm.row._id, v.reason.trim()), 'Domain removed'); }}
      />
    </div>
  );
}
