import { useCallback, useEffect, useState } from 'react';
import { Wallet, Plus, RefreshCw, Pencil, Trash2, Landmark, Banknote, CreditCard } from 'lucide-react';
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/Toggle';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../../components/ui/Spinner';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../components/ui/toast-context';
import {
  paymentsApi,
  BUILT_IN_CODES,
  TYPE_LABEL,
  type CatalogEntry,
  type PaymentIntegration,
  type PaymentMethodType,
} from '../../lib/api-payments';
import { PaymentMethodFormModal } from './PaymentMethodFormModal';

const typeVariant: Record<PaymentMethodType, 'default' | 'secondary' | 'outline'> = {
  cod: 'secondary',
  manual: 'outline',
  gateway: 'default',
};

function MethodMark({ entry }: { entry: CatalogEntry }) {
  if (entry.logo) {
    return <img src={entry.logo} alt="" className="h-9 w-9 shrink-0 rounded-md border bg-white object-contain" />;
  }
  const Icon = entry.type === 'cod' ? Banknote : entry.type === 'gateway' ? CreditCard : Landmark;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
      <Icon className="h-4 w-4" />
    </div>
  );
}

export default function Payments() {
  const toast = useToast();
  const { user: me } = useAuth();
  const canWrite = hasScope(me, PLATFORM_SCOPES.PAYMENTS_WRITE);

  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [integrations, setIntegrations] = useState<PaymentIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogEntry | null>(null);
  const [deleting, setDeleting] = useState<CatalogEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await paymentsApi.list();
      setEntries(data.entries);
      setIntegrations(data.integrations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upsert = (saved: CatalogEntry) =>
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e._id === saved._id);
      const next = idx === -1 ? [...prev, { ...saved, storesEnabled: 0 }] : prev.map((e) => (e._id === saved._id ? { ...e, ...saved } : e));
      return next.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
    });

  const toggleEnabled = async (entry: CatalogEntry, enabled: boolean) => {
    setToggling(entry._id);
    try {
      const saved = await paymentsApi.update(entry._id, { enabled });
      upsert(saved);
      toast.success(enabled ? `${entry.label} is now offered` : `${entry.label} withdrawn from all storefronts`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setToggling(null);
    }
  };

  const columns: DataListColumn<CatalogEntry>[] = [
    {
      id: 'method',
      header: 'Method',
      primary: true,
      cell: (e) => (
        <div className="flex min-w-0 items-center gap-3">
          <MethodMark entry={e} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 font-medium">
              <span className="truncate">{e.label}</span>
              {e.labelAr && <span className="truncate text-xs font-normal text-muted-foreground" dir="rtl">{e.labelAr}</span>}
            </div>
            <div className="truncate font-mono text-xs text-muted-foreground" dir="ltr">{e.code}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'integration',
      header: 'Integration',
      cell: (e) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {e.type && <Badge variant={typeVariant[e.type]}>{TYPE_LABEL[e.type]}</Badge>}
          <span className="text-xs text-muted-foreground">{e.integration?.label ?? e.integrationKey}</span>
        </div>
      ),
    },
    {
      id: 'offered',
      header: 'Offered',
      cell: (e) => (
        <div className="flex items-center gap-2">
          <Toggle checked={e.enabled} disabled={!canWrite || toggling === e._id} onChange={(v) => toggleEnabled(e, v)} label={`Offer ${e.label}`} />
          <span className="text-xs text-muted-foreground">{e.enabled ? 'Yes' : 'No'}</span>
        </div>
      ),
    },
    {
      id: 'default',
      header: 'New stores',
      cell: (e) =>
        e.enabledByDefault ? <Badge variant="success">On by default</Badge> : <span className="text-xs text-muted-foreground">Merchant opts in</span>,
    },
    {
      id: 'stores',
      header: 'Stores enabled',
      align: 'end',
      cell: (e) => <span className="tabular-nums">{e.storesEnabled}</span>,
    },
    {
      id: 'order',
      header: 'Order',
      align: 'end',
      hideOnMobile: true,
      cell: (e) => <span className="tabular-nums text-muted-foreground">{e.order}</span>,
    },
    {
      id: 'actions',
      align: 'end',
      cell: (e) =>
        canWrite ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" title="Edit" onClick={() => { setEditing(e); setFormOpen(true); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              title={BUILT_IN_CODES.has(e.code) ? 'Built-in — disable instead' : 'Delete'}
              disabled={BUILT_IN_CODES.has(e.code)}
              onClick={() => setDeleting(e)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ];

  if (loading && entries.length === 0) return <PageSpinner />;
  if (error && entries.length === 0) return <ErrorState error={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Wallet className="mt-1 h-6 w-6 shrink-0 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payment methods</h1>
            <p className="text-sm text-muted-foreground">
              What merchants can offer at checkout. Integrations ship in code; you decide which appear, how they are presented and whether they are on by default. Merchants only enable a method for their store and add their own details.
              {!canWrite && ' (read-only — you lack the payments.write scope)'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-3.5 w-3.5" /> Add method
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={load} />}

      {entries.length === 0 ? (
        <EmptyState
          title="No payment methods"
          description="Add one from a code integration to offer it to merchants."
          action={canWrite ? <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-3.5 w-3.5" /> Add method</Button> : undefined}
        />
      ) : (
        <DataList columns={columns} rows={entries} rowKey={(e) => e._id} rowClassName={(e) => (e.enabled ? undefined : 'opacity-70')} />
      )}

      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Available integrations:</span>{' '}
        {integrations.map((i) => i.label).join(' · ') || 'none'}. To add a gateway, ship its adapter and register it in <code>config/paymentIntegrations.js</code>; it then appears here.
      </div>

      <PaymentMethodFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        integrations={integrations}
        entry={editing}
        onSaved={upsert}
      />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.label ?? ''}?`}
        description={
          deleting && deleting.storesEnabled > 0
            ? `${deleting.storesEnabled} store(s) currently have this enabled. Their copies are withdrawn (not deleted) and hidden from checkout; existing orders keep their payment record.`
            : 'Store copies are withdrawn and hidden from checkout; existing orders keep their payment record.'
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 4, placeholder: 'Why this method is being removed (audited)' }]}
        onConfirm={async (v) => {
          if (!deleting) return;
          await paymentsApi.remove(deleting._id, v.reason);
          setEntries((prev) => prev.filter((e) => e._id !== deleting._id));
          toast.success('Payment method deleted');
          setDeleting(null);
        }}
      />
    </div>
  );
}
