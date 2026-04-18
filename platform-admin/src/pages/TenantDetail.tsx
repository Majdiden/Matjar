import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, hasScope, PLATFORM_SCOPES } from '../lib/api';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatusBadge } from '../components/StatusBadge';
import { PageSpinner, ErrorState } from '../components/ui/Spinner';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ui/toast-context';
import { formatDate, shortId } from '../lib/utils';
import {
  ArrowLeft,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  XCircle,
  Skull,
  RotateCcw,
  UserCog,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  FileArchive,
  Users as UsersIcon,
  Package,
  ExternalLink,
} from 'lucide-react';
import TenantOrdersTab from './TenantOrdersTab';
import TenantPaymentsTab from './TenantPaymentsTab';
import TenantExportsTab from './TenantExportsTab';
import TenantFailedWebhooksTab from './TenantFailedWebhooksTab';

type Tab = 'overview' | 'orders' | 'payments' | 'exports' | 'webhooks';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'payments', label: 'Payments' },
  { id: 'exports', label: 'Exports' },
  { id: 'webhooks', label: 'Failed webhooks' },
];

interface TenantDetail {
  _id: string;
  name: string;
  slug: string;
  email: string;
  domains?: {
    subdomain?: { name?: string; fullDomain?: string };
    customDomain?: { name?: string; isVerified?: boolean };
    primaryDomain?: 'subdomain' | 'custom';
  };
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  deletionScheduledAt?: string | null;
  deletedAt?: string | null;
  setupStatus?: {
    status?: string;
    steps?: Record<string, { status?: string; error?: string | null; completedAt?: string | null }>;
    startedAt?: string | null;
    completedAt?: string | null;
    failedAt?: string | null;
    lastError?: string | null;
  };
  settings?: { activeTheme?: string; niche?: string };
  createdAt: string;
  updatedAt?: string;
}

export default function TenantDetailPage() {
  const { tenantId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'overview';
  const toast = useToast();
  const { user } = useAuth();
  // Scope flags — used to hide buttons and tabs the operator can't use
  // so they don't get a 403 surprise. The server still enforces.
  const canLifecycle = hasScope(user, PLATFORM_SCOPES.TENANT_LIFECYCLE);
  const canImpersonate = hasScope(user, PLATFORM_SCOPES.SUPPORT_IMPERSONATE);
  const canExport = hasScope(user, PLATFORM_SCOPES.TENANT_EXPORT);
  const canReadBilling = hasScope(user, PLATFORM_SCOPES.BILLING_READ);

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [stats, setStats] = useState<{
    orders30d: number;
    revenue30d: number;
    failedWebhooks: number;
    pendingExports: number;
    usersTotal: number;
    productsTotal: number;
    recentAudit: Array<{
      _id: string;
      action: string;
      resource?: string;
      actorName?: string | null;
      createdAt: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modal, setModal] = useState<
    | null
    | 'suspend'
    | 'schedule-deletion'
    | 'purge'
    | 'impersonate'
    | 'cancel-deletion'
    | 'retry-setup'
    | 'unsuspend'
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([
        api.tenants.get(tenantId),
        api.tenants.getStats(tenantId).catch(() => null),
      ]);
      setTenant(data);
      if (s) setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId, load]);

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const primaryHost = (() => {
    const d = tenant?.domains;
    if (!d) return null;
    if (d.primaryDomain === 'custom' && d.customDomain?.name && d.customDomain.isVerified) {
      return d.customDomain.name;
    }
    return d.subdomain?.fullDomain || d.subdomain?.name || null;
  })();

  // --- Actions -----------------------------------------------------

  const wrap = async (name: string, fn: () => Promise<unknown>, successMsg: string) => {
    setActionLoading(name);
    try {
      await fn();
      toast.success(successMsg);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
      throw err;
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = () =>
    wrap('unsuspend', () => api.tenants.unsuspend(tenantId), 'Tenant unsuspended');

  const handleCancelDeletion = () =>
    wrap('cancel-deletion', () => api.tenants.cancelDeletion(tenantId), 'Deletion cancelled');

  const handleRetrySetup = () =>
    wrap('retry-setup', () => api.tenants.retrySetup(tenantId), 'Setup retry enqueued');

  if (loading && !tenant) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!tenant) return null;

  const isSuspended = tenant.subscriptionStatus === 'suspended' || !!tenant.suspendedAt;
  const isScheduledForDeletion = !!tenant.deletionScheduledAt && !tenant.deletedAt;
  const isDeleted = !!tenant.deletedAt;
  const setupState = tenant.setupStatus?.status || null;
  const setupInterrupted = setupState && !['completed', 'skipped'].includes(setupState);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/tenants"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All tenants
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
              <StatusBadge status={tenant.subscriptionStatus} />
              {isDeleted && <Badge variant="destructive">Deleted</Badge>}
              {isScheduledForDeletion && <Badge variant="warning">Deletion scheduled</Badge>}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {primaryHost && (() => {
                const isLocal =
                  primaryHost.endsWith('.localhost') || primaryHost === 'localhost';
                const href = isLocal
                  ? `http://${primaryHost}:3000`
                  : `https://${primaryHost}`;
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                  >
                    {primaryHost}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                );
              })()}
              {primaryHost && <span className="mx-2">·</span>}
              <span>{tenant.email}</span>
              <span className="mx-2">·</span>
              <span>{shortId(tenant._id)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canImpersonate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal('impersonate')}
                disabled={isDeleted}
              >
                <UserCog className="h-3.5 w-3.5" /> Impersonate
              </Button>
            )}
            {canLifecycle && (isSuspended ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnsuspend}
                loading={actionLoading === 'unsuspend'}
                disabled={isDeleted}
              >
                <Play className="h-3.5 w-3.5" /> Unsuspend
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal('suspend')}
                disabled={isDeleted}
              >
                <Pause className="h-3.5 w-3.5" /> Suspend
              </Button>
            ))}
            {canLifecycle && (isScheduledForDeletion ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelDeletion}
                loading={actionLoading === 'cancel-deletion'}
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel deletion
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal('schedule-deletion')}
                disabled={isDeleted}
              >
                <Trash2 className="h-3.5 w-3.5" /> Schedule deletion
              </Button>
            ))}
            {canLifecycle && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setModal('purge')}
                disabled={isDeleted}
              >
                <Skull className="h-3.5 w-3.5" /> Purge
              </Button>
            )}
          </div>
        </div>
      </div>

      {setupInterrupted && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <div className="flex-1">
            <div className="font-medium">Setup {String(setupState).replace(/_/g, ' ')}</div>
            {tenant.setupStatus?.lastError && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {tenant.setupStatus.lastError}
              </div>
            )}
          </div>
          {canLifecycle && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModal('retry-setup')}
              loading={actionLoading === 'retry-setup'}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry setup
            </Button>
          )}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <KpiTile
            label="Orders (30d)"
            value={stats.orders30d.toLocaleString()}
            icon={<ShoppingCart className="h-4 w-4" />}
            onClick={() => setTab('orders')}
          />
          <KpiTile
            label="Revenue (30d)"
            value={`$${stats.revenue30d.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<DollarSign className="h-4 w-4" />}
            tone={stats.revenue30d > 0 ? 'text-emerald-600' : undefined}
          />
          <KpiTile
            label="Failed webhooks"
            value={stats.failedWebhooks.toLocaleString()}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone={stats.failedWebhooks > 0 ? 'text-red-600' : undefined}
            onClick={() => setTab('webhooks')}
          />
          <KpiTile
            label="Pending exports"
            value={stats.pendingExports.toLocaleString()}
            icon={<FileArchive className="h-4 w-4" />}
            onClick={canExport ? () => setTab('exports') : undefined}
          />
          <KpiTile
            label="Users"
            value={stats.usersTotal.toLocaleString()}
            icon={<UsersIcon className="h-4 w-4" />}
          />
          <KpiTile
            label="Products"
            value={stats.productsTotal.toLocaleString()}
            icon={<Package className="h-4 w-4" />}
          />
        </div>
      )}

      <div className="border-b">
        <div className="flex gap-1 -mb-px">
          {TABS.filter((t) => {
            // Hide tabs the operator has no scope to read. Server
            // enforces; this just avoids dead UI.
            if (t.id === 'payments') return canReadBilling;
            if (t.id === 'exports') return canExport;
            return true;
          }).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-3 py-2 text-sm transition-colors ${
                tab === t.id
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Plan" value={tenant.subscriptionPlan || 'free'} />
              <Row
                label="Status"
                value={<StatusBadge status={tenant.subscriptionStatus} />}
              />
              <Row
                label="Suspended at"
                value={tenant.suspendedAt ? formatDate(tenant.suspendedAt) : '—'}
              />
              {tenant.suspensionReason && (
                <Row label="Reason" value={tenant.suspensionReason} />
              )}
              <Row
                label="Deletion scheduled"
                value={
                  tenant.deletionScheduledAt ? formatDate(tenant.deletionScheduledAt) : '—'
                }
              />
              <Row
                label="Deleted at"
                value={tenant.deletedAt ? formatDate(tenant.deletedAt) : '—'}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row
                label="Status"
                value={
                  tenant.setupStatus?.status ? (
                    <span className="capitalize">
                      {String(tenant.setupStatus.status).replace(/_/g, ' ')}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <Row
                label="Started"
                value={
                  tenant.setupStatus?.startedAt ? formatDate(tenant.setupStatus.startedAt) : '—'
                }
              />
              <Row
                label="Completed"
                value={
                  tenant.setupStatus?.completedAt
                    ? formatDate(tenant.setupStatus.completedAt)
                    : '—'
                }
              />
              {tenant.setupStatus?.lastError && (
                <Row label="Last error" value={tenant.setupStatus.lastError} />
              )}
              {tenant.setupStatus?.steps && (
                <div className="pt-2">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Steps</div>
                  <ul className="space-y-1 text-xs">
                    {Object.entries(tenant.setupStatus.steps).map(([key, val]) => (
                      <li key={key} className="flex items-center justify-between">
                        <span className="capitalize text-muted-foreground">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="capitalize">
                          {val?.status ? val.status.replace(/_/g, ' ') : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Domains</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Slug" value={<code className="text-xs">{tenant.slug}</code>} />
              <Row
                label="Subdomain"
                value={tenant.domains?.subdomain?.fullDomain || tenant.domains?.subdomain?.name || '—'}
              />
              <Row
                label="Custom"
                value={
                  tenant.domains?.customDomain?.name ? (
                    <span>
                      {tenant.domains.customDomain.name}{' '}
                      {tenant.domains.customDomain.isVerified ? (
                        <Badge variant="success" className="ml-1">
                          verified
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="ml-1">
                          pending
                        </Badge>
                      )}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <Row label="Primary" value={tenant.domains?.primaryDomain || 'subdomain'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-xs text-muted-foreground">
                All exports go through the async pipeline (Exports tab) so the
                dump is off-dyno and the download is audited.
              </div>
              <Row label="Active theme" value={tenant.settings?.activeTheme || '—'} />
              <Row label="Niche" value={tenant.settings?.niche || '—'} />
              <Row label="Created" value={formatDate(tenant.createdAt)} />
              <Row label="Updated" value={formatDate(tenant.updatedAt)} />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'orders' && <TenantOrdersTab tenantId={tenantId} />}
      {tab === 'payments' && <TenantPaymentsTab tenantId={tenantId} />}
      {tab === 'exports' && <TenantExportsTab tenantId={tenantId} tenantSlug={tenant.slug} />}
      {tab === 'webhooks' && <TenantFailedWebhooksTab tenantId={tenantId} />}

      {/* --- Modals --- */}
      <ConfirmModal
        open={modal === 'suspend'}
        onClose={() => setModal(null)}
        title="Suspend tenant"
        description="The store's authenticated API calls will be blocked. Merchants see a suspension notice. Public read endpoints stay live unless you also schedule deletion."
        fields={[
          {
            name: 'reason',
            label: 'Reason',
            type: 'textarea',
            required: true,
            minLength: 4,
            placeholder: 'Billing overdue, fraud investigation, etc.',
            help: 'Shown in audit log. Not shown to merchant.',
          },
        ]}
        confirmLabel="Suspend"
        confirmVariant="destructive"
        onConfirm={async (v) => {
          await wrap('suspend', () => api.tenants.suspend(tenantId, v.reason), 'Tenant suspended');
        }}
      />

      <ConfirmModal
        open={modal === 'schedule-deletion'}
        onClose={() => setModal(null)}
        title="Schedule deletion"
        description="After the grace period passes, the tenant is purged (all data wiped). Use 'Cancel deletion' before that to abort. Default grace is 30 days."
        fields={[
          {
            name: 'graceDays',
            label: 'Grace period (days)',
            type: 'number',
            placeholder: '30',
            help: 'Leave blank for platform default.',
          },
        ]}
        confirmLabel="Schedule deletion"
        confirmVariant="destructive"
        onConfirm={async (v) => {
          const days = v.graceDays ? Number(v.graceDays) : undefined;
          await wrap(
            'schedule-deletion',
            () => api.tenants.scheduleDeletion(tenantId, days),
            'Deletion scheduled'
          );
        }}
      />

      <ConfirmModal
        open={modal === 'purge'}
        onClose={() => setModal(null)}
        title="Purge tenant immediately"
        description="This wipes every row in the tenant's database and marks the record deleted. Irreversible. Normally you should schedule deletion and let the grace period run. Use 'force' if the scheduled deletion hasn't matured yet."
        confirmPhrase={tenant.slug}
        fields={[
          {
            name: 'force',
            label: "Type 'force' to bypass grace period check",
            placeholder: 'leave blank to purge only if grace expired',
            help: "If blank, the server refuses unless deletion has already matured.",
          },
        ]}
        confirmLabel="Purge tenant"
        confirmVariant="destructive"
        onConfirm={async (v) => {
          const force = v.force?.trim().toLowerCase() === 'force';
          await wrap('purge', () => api.tenants.purge(tenantId, force), 'Tenant purged');
        }}
      />

      <ConfirmModal
        open={modal === 'impersonate'}
        onClose={() => setModal(null)}
        title="Impersonate tenant admin"
        description="Mints a short-lived JWT (max 30 minutes) for this tenant's admin user. Every mint is audit-logged with your platform account and the reason below."
        fields={[
          {
            name: 'reason',
            label: 'Reason',
            type: 'textarea',
            required: true,
            minLength: 4,
            placeholder: 'Support ticket #1234, reproducing checkout bug, etc.',
          },
          {
            name: 'ttlSeconds',
            label: 'Token TTL (seconds)',
            type: 'number',
            placeholder: '1800',
            help: 'Max 1800 (30 min). Leave blank for max.',
          },
        ]}
        confirmLabel="Mint & open"
        onConfirm={async (v) => {
          setActionLoading('impersonate');
          try {
            const ttl = v.ttlSeconds ? Number(v.ttlSeconds) : undefined;
            const result = await api.tenants.impersonate(tenantId, v.reason, ttl);
            toast.success('Impersonation token minted');
            // Open the merchant dashboard on the tenant's host with the
            // token in the URL fragment so it's not logged in proxies.
            if (primaryHost) {
              const isLocal =
                window.location.hostname === 'localhost' ||
                window.location.hostname.endsWith('.localhost');
              // Strip any scheme/port the tenant domain record may have
              // been saved with — we only want the bare hostname.
              const bareHost = primaryHost
                .replace(/^[a-z]+:\/\//i, '')
                .replace(/:\d+$/, '')
                .replace(/\/.*$/, '');
              const proto = isLocal ? window.location.protocol : 'https:';
              // Dashboard dev server runs on 5173; platform-admin on 5174.
              // Never reuse platform-admin's port here.
              const port = isLocal ? ':5173' : '';
              let target: string;
              try {
                const u = new URL(
                  `${proto}//${bareHost}${port}/login`
                );
                u.hash = `impersonation=${encodeURIComponent(result.token)}`;
                target = u.toString();
              } catch (e) {
                toast.error(`Cannot build dashboard URL for host "${bareHost}"`);
                console.error('Impersonation URL build failed', { bareHost, e });
                return;
              }
              const opened = window.open(target, '_blank', 'noopener');
              if (!opened) {
                // Popup blocked — fall back to copying the token.
                navigator.clipboard?.writeText(result.token).catch(() => {});
                toast.info('Popup blocked — token copied to clipboard');
              }
            } else {
              // No host — fall back to showing the token so the operator
              // can paste it manually.
              navigator.clipboard?.writeText(result.token).catch(() => {});
              toast.info('Token copied to clipboard (no tenant host available)');
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Impersonation failed');
            throw err;
          } finally {
            setActionLoading(null);
          }
        }}
      />

      <ConfirmModal
        open={modal === 'retry-setup'}
        onClose={() => setModal(null)}
        title="Retry tenant setup"
        description="Re-enqueues the setup job. Safe to call multiple times — each step is idempotent."
        confirmLabel="Retry"
        onConfirm={async () => {
          await handleRetrySetup();
        }}
      />
    </div>
  );
}

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right">{value}</span>
  </div>
);

const KpiTile: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: string;
  onClick?: () => void;
}> = ({ label, value, icon, tone, onClick }) => {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`rounded-lg border bg-card p-3 text-left transition-colors ${
        clickable ? 'hover:bg-accent' : 'cursor-default'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={tone || 'text-muted-foreground'}>{icon}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold ${tone || ''}`}>{value}</div>
    </button>
  );
};
