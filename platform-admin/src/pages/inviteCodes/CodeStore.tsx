import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Phone, RefreshCw, Users as UsersIcon, Package, Ticket } from 'lucide-react';
import { inviteCodesApi, type CodeStore as CodeStoreData } from '../../lib/api-invite-codes';
import { storefrontUrl } from '../../lib/api-storefront';
import { Button } from '../../components/ui/Button';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { SetupCard, DomainsCard, DataCard, KpiTile } from '../../components/tenant/OverviewCards';
import { formatDate } from '../../lib/utils';

const errorText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (err instanceof Error ? err.message : fallback);

/**
 * A store registered with one of the viewer's invitation codes (PBI 10-47):
 * the store page reduced to what a promoter may see — name, link, email and
 * phone; users and products counts; setup, domains and data. The server only
 * answers for stores registered with the viewer's own codes (owners: any code).
 */
export default function CodeStore() {
  const { tenantId = '' } = useParams();
  const [data, setData] = useState<CodeStoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await inviteCodesApi.store(tenantId));
    } catch (err) {
      setError(errorText(err, 'Failed to load the store'));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);
  useEffect(() => {
    if (tenantId) void load();
  }, [tenantId, load]);

  if (loading && !data) return <PageSpinner />;
  if (error || !data) return <ErrorState error={error || 'Store not found'} onRetry={load} />;

  const { store, stats, code } = data;
  const d = store.domains;
  const host =
    d?.primaryDomain === 'custom' && d.customDomain?.name && d.customDomain.isVerified
      ? d.customDomain.name
      : d?.subdomain?.fullDomain || d?.subdomain?.name || null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/invite-codes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Invitation codes
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight">{store.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {host && (
                <a
                  href={storefrontUrl(host) || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 break-all hover:text-foreground hover:underline"
                >
                  {host}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
              {host && <span aria-hidden>·</span>}
              <span className="break-all">{store.email}</span>
              {store.phone && (
                <>
                  <span aria-hidden>·</span>
                  <a href={`tel:${store.phone}`} dir="ltr" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                    <Phone className="h-3 w-3 shrink-0" />
                    {store.phone}
                  </a>
                </>
              )}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Ticket className="h-3 w-3" /> Registered with <code dir="ltr" className="font-mono">{code.code}</code>
              {code.usedAt && <> · {formatDate(code.usedAt)}</>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        <KpiTile label="Users" value={stats.usersTotal.toLocaleString()} icon={<UsersIcon className="h-4 w-4" />} />
        <KpiTile label="Products" value={stats.productsTotal.toLocaleString()} icon={<Package className="h-4 w-4" />} />
      </div>

      <div className="-mx-4 border-b md:mx-0">
        <div className="-mb-px flex gap-1 px-4 md:px-0">
          <span className="border-b-2 border-primary px-3 py-2 text-sm font-medium">Overview</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SetupCard tenant={store} />
        <DomainsCard tenant={store} />
        <DataCard tenant={store} />
      </div>
    </div>
  );
}
