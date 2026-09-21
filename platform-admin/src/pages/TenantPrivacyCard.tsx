import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserX, Download } from 'lucide-react';
import { privacyApi, type PrivacyCustomer } from '../lib/api-privacy';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input, Label } from '../components/ui/Input';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ui/toast-context';
import { formatDate } from '../lib/utils';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Customers & privacy" — lets an operator with tenant.export honour a
 * customer's data request on behalf of a merchant: exact-email lookup, then
 * anonymise (irreversible) or queue a per-customer export. Both mutations
 * need a reason and a fresh re-authentication (`ensureReauth`), and are
 * audited on the platform ledger and the tenant's own audit log.
 */
export function TenantPrivacyCard({ tenantId, ensureReauth }: { tenantId: string; ensureReauth: () => Promise<void> }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [customers, setCustomers] = useState<PrivacyCustomer[]>([]);
  const [action, setAction] = useState<{ kind: 'anonymise' | 'export'; c: PrivacyCustomer } | null>(null);

  const search = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e)) {
      toast.error('Enter the customer\'s exact email address.');
      return;
    }
    setSearching(true);
    try {
      const data = await privacyApi.lookup(tenantId, e);
      setCustomers(data.customers);
      setSearched(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setSearching(false);
    }
  };

  const run = async (reason: string) => {
    if (!action) return;
    await ensureReauth();
    if (action.kind === 'anonymise') {
      const r = await privacyApi.anonymise(tenantId, action.c.id, reason);
      setCustomers((prev) => prev.map((c) => (c.id === r.userId ? { ...c, anonymizedAt: r.anonymizedAt, isActive: false } : c)));
      toast.success('Customer anonymised');
    } else {
      await privacyApi.requestExport(tenantId, action.c.id, reason);
      toast.success('Customer export queued — see the Exports tab');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customers &amp; privacy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Honour a customer's data request on the merchant's behalf. Exact email match only; staff accounts are never
          returned. Both actions need a reason and a fresh re-authentication and are written to the store's audit log.
        </p>
        <div className="space-y-1">
          <Label htmlFor="priv-email">Customer email</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="priv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search();
              }}
              placeholder="customer@example.com"
            />
            <Button variant="outline" onClick={search} loading={searching} className="sm:shrink-0">
              <Search className="h-3.5 w-3.5" /> Look up
            </Button>
          </div>
        </div>

        {searched && customers.length === 0 && <p className="text-xs text-muted-foreground">No customer with that email.</p>}
        {customers.map((c) => (
          <div key={c.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{c.name || '—'}</div>
                <div className="truncate text-xs text-muted-foreground">{c.email}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {c.anonymizedAt ? <Badge variant="outline">Anonymised {formatDate(c.anonymizedAt)}</Badge> : c.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                <Badge variant="secondary">{c.ordersCount} orders</Badge>
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Joined {formatDate(c.createdAt)}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setAction({ kind: 'export', c })}>
                <Download className="h-3.5 w-3.5" /> Export data
              </Button>
              <Button size="sm" variant="destructive" disabled={!!c.anonymizedAt} onClick={() => setAction({ kind: 'anonymise', c })}>
                <UserX className="h-3.5 w-3.5" /> Anonymise
              </Button>
            </div>
          </div>
        ))}
        {searched && customers.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Exports appear in the <Link to={`/tenants/${tenantId}?tab=exports`} className="underline">Exports tab</Link> once processed.
          </p>
        )}
      </CardContent>

      <ConfirmModal
        open={!!action}
        onClose={() => setAction(null)}
        title={action?.kind === 'anonymise' ? 'Anonymise customer' : 'Export customer data'}
        description={
          action?.kind === 'anonymise'
            ? `Irreversibly scrubs ${action.c.email}'s personal data (name, email, phone, addresses) while keeping their orders for the merchant's records. The customer can no longer log in.`
            : `Queues a JSON export of everything the store holds about ${action?.c.email}. The file is downloadable from the Exports tab and the download is audited.`
        }
        fields={[
          {
            name: 'reason',
            label: 'Reason',
            type: 'textarea',
            required: true,
            minLength: 4,
            placeholder: 'Customer request via ticket #1234',
            help: 'Written to the platform audit log and the store\'s audit log.',
          },
        ]}
        confirmLabel={action?.kind === 'anonymise' ? 'Anonymise' : 'Queue export'}
        confirmVariant={action?.kind === 'anonymise' ? 'destructive' : 'default'}
        onConfirm={async (v) => {
          await run(v.reason);
        }}
      />
    </Card>
  );
}
