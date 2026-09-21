import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasScope, PLATFORM_SCOPES, type Pagination } from '../../lib/api';
import { storefrontApi, type ThemeRow, type ThemeStoreRow, type ThemeCategoryOption } from '../../lib/api-storefront';
import { ThemeDetailsModal } from './ThemeDetailsModal';
import { useAuth } from '../../contexts/auth-context';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { LifecycleBadge } from '../../components/LifecycleBadge';
import { PageSpinner, EmptyState, ErrorState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { formatDate } from '../../lib/utils';
import { RefreshCw, Palette, Store, Eye, EyeOff, Hammer, Pencil } from 'lucide-react';
import { Pager } from '../commerce/shared';

/** Catalog statuses map onto the doc's vocabulary: active = available, inactive = deprecated, development = draft. */
const STATUS_META: Record<ThemeRow['status'], { label: string; variant: React.ComponentProps<typeof Badge>['variant'] }> = {
  active: { label: 'Available', variant: 'success' },
  inactive: { label: 'Deprecated', variant: 'outline' },
  development: { label: 'Development', variant: 'warning' },
};

export default function StorefrontThemes() {
  const toast = useToast();
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const canWrite = hasScope(user, PLATFORM_SCOPES.FLAGS_WRITE);
  const [rows, setRows] = useState<ThemeRow[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<ThemeCategoryOption[]>([]);
  const [editing, setEditing] = useState<ThemeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ row: ThemeRow; status: ThemeRow['status'] } | null>(null);
  const [stores, setStores] = useState<{ theme: ThemeRow; page: number; rows: ThemeStoreRow[]; pagination: Pagination | null; loading: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await storefrontApi.themes.list(); setRows(d.rows); setCategoryOptions(d.categoryOptions); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load themes'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (canRead) void load(); }, [canRead, load]);

  const openStores = async (theme: ThemeRow, page = 1) => {
    setStores({ theme, page, rows: [], pagination: null, loading: true });
    try {
      const d = await storefrontApi.themes.stores(theme.slug, { page, limit: 25 });
      setStores({ theme, page, rows: d.tenants, pagination: d.pagination, loading: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load stores');
      setStores(null);
    }
  };

  if (!canRead) return <ErrorState error="Viewing themes requires the support.read scope." />;

  const columns: DataListColumn<ThemeRow>[] = [
    { id: 'theme', header: 'Theme', primary: true, cell: (r) => (
      <div className="flex min-w-0 items-center gap-2">
        {r.previewImage ? <img src={r.previewImage} alt="" className="h-9 w-14 shrink-0 rounded object-cover object-top" /> : <div className="h-9 w-14 shrink-0 rounded bg-muted" />}
        <div className="min-w-0"><div className="truncate font-medium">{r.name}{r.isDefault && <Badge variant="secondary" className="ms-2 text-[10px]">default</Badge>}{r.overrides?.updatedAt && <Badge variant="outline" className="ms-2 text-[10px]" title={`Edited in the console${r.overrides.updatedBy ? ` by ${r.overrides.updatedBy}` : ''}`}>edited</Badge>}</div><div className="font-mono text-xs text-muted-foreground">{r.slug}</div></div>
      </div>
    ) },
    { id: 'version', header: 'Version', cell: (r) => <span className="font-mono text-xs">v{r.version}{r.manifestVersion && r.manifestVersion !== r.version ? <span className="ms-1 text-amber-600" title="Built manifest version differs from the catalog row">(manifest v{r.manifestVersion})</span> : ''}</span> },
    { id: 'status', header: 'Status', cell: (r) => <div><Badge variant={STATUS_META[r.status]?.variant ?? 'outline'}>{STATUS_META[r.status]?.label ?? r.status}</Badge>{r.catalogSync?.missingSince && <div className="text-[10px] text-destructive">manifest missing since {formatDate(r.catalogSync.missingSince)}</div>}</div> },
    { id: 'stores', header: 'Stores', align: 'end', cell: (r) => (
      <button className="underline-offset-2 hover:underline" onClick={() => openStores(r)}>{r.storesUsing}</button>
    ) },
    { id: 'cats', header: 'Categories', fullWidthOnMobile: true, cell: (r) => <div className="flex flex-wrap gap-1">{(r.categories || []).slice(0, 4).map((c) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}</div> },
    { id: 'actions', align: 'end', cell: (r) => canWrite ? (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" title="Edit name, cover, description, categories" onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></Button>
        {r.status !== 'active' && <Button variant="ghost" size="sm" title="Make available" onClick={() => setConfirm({ row: r, status: 'active' })}><Eye className="h-3.5 w-3.5" /></Button>}
        {r.status !== 'inactive' && <Button variant="ghost" size="sm" title="Deprecate (hide from catalog; existing stores keep it)" disabled={r.isDefault} onClick={() => setConfirm({ row: r, status: 'inactive' })}><EyeOff className="h-3.5 w-3.5" /></Button>}
        {r.status !== 'development' && <Button variant="ghost" size="sm" title="Mark as in development" disabled={r.isDefault} onClick={() => setConfirm({ row: r, status: 'development' })}><Hammer className="h-3.5 w-3.5" /></Button>}
      </div>
    ) : null },
  ];

  const storeCols: DataListColumn<ThemeStoreRow>[] = [
    { id: 'store', header: 'Store', primary: true, cell: (t) => <div className="min-w-0"><Link to={`/tenants/${t._id}`} className="font-medium hover:underline">{t.name}</Link><div className="text-xs text-muted-foreground" dir="ltr">{t.domains?.subdomain?.fullDomain || t.slug}</div></div> },
    { id: 'state', header: 'State', cell: (t) => <LifecycleBadge state={t.lifecycle?.state} /> },
    { id: 'plan', header: 'Plan', cell: (t) => <span className="text-xs">{t.subscriptionPlan || '—'}</span> },
    { id: 'published', header: 'Published', cell: (t) => <span className="text-xs text-muted-foreground">{t.themeCustomization?.published?.version ? `v${t.themeCustomization.published.version} · ` : ''}{formatDate(t.themeCustomization?.lastPublishedAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Palette className="h-6 w-6 text-indigo-600" />
          <div><h1 className="text-2xl font-bold tracking-tight">Themes</h1><p className="text-sm text-muted-foreground">Platform theme catalog. Deprecating a theme hides it from new stores; existing stores are never switched.</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>
      {!canWrite && <p className="text-xs text-muted-foreground">Read-only — changing catalog status requires the flags.write scope.</p>}

      {error ? <ErrorState error={error} onRetry={load} />
        : loading && rows.length === 0 ? <PageSpinner />
        : rows.length === 0 ? <EmptyState title="No themes" description="Run `node scripts/seed-themes.js` to register the built-in themes." />
        : <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />}

      <ConfirmModal
        open={!!confirm} onClose={() => setConfirm(null)}
        title={`${confirm ? STATUS_META[confirm.status].label : ''}: ${confirm?.row.name ?? ''}`}
        description={confirm?.status === 'inactive' ? `Hides "${confirm.row.name}" from the catalog and the signup picker. The ${confirm.row.storesUsing} store(s) using it keep it.` : confirm?.status === 'development' ? 'Marks the theme as in development — not offered to merchants.' : 'Makes the theme available to merchants again.'}
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', help: 'Recorded in the audit ledger.' }]}
        confirmLabel="Apply"
        onConfirm={async (v) => {
          if (!confirm) return;
          try { await storefrontApi.themes.setStatus(confirm.row._id, confirm.status, v.reason?.trim() || undefined); toast.success('Theme status updated'); setConfirm(null); await load(); }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); throw err; }
        }}
      />

      <ThemeDetailsModal
        theme={editing}
        categoryOptions={categoryOptions}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await load(); }}
      />

      <Modal open={!!stores} onClose={() => setStores(null)} title={stores ? `Stores on ${stores.theme.name}` : ''} description={stores ? `${stores.theme.storesUsing} store(s)` : undefined} className="max-w-2xl">
        {stores?.loading ? <PageSpinner /> : stores && stores.rows.length === 0 ? <EmptyState title="No stores use this theme" /> : stores ? (
          <div className="space-y-3">
            <DataList columns={storeCols} rows={stores.rows} rowKey={(t) => t._id} />
            <Pager pagination={stores.pagination} page={stores.page} loading={false} onPage={(n) => openStores(stores.theme, n)} />
          </div>
        ) : null}
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Store className="h-3 w-3" /> Stores are never moved between themes from here.</div>
      </Modal>
    </div>
  );
}
