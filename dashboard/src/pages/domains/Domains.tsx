import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Globe,
  Plus,
  Star,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  Clock,
  Trash2,
  Loader2,
  Copy,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  CircleDot,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';
import type { DomainRegistryRow, DomainInfoResponse } from './types';
import { isTransitional, daysUntilExpiry } from './types';
import { AddDomainDialog } from './components/AddDomainDialog';
import { LiveStoreBanner } from './components/LiveStoreBanner';
import { SetupProgress, stepIndex } from './components/SetupProgress';
import { DnsRecordsBlock } from './components/DnsRecordsBlock';
import { errMsg } from '../../lib/errors';
import { EmptyState } from '../../components/EmptyState';

// Poll every 10s while any row is in a transitional state
// (pending_dns, ownership_verified, dns_verified, provisioning_ssl).
// The state machine advances asynchronously so the dashboard reflects
// it without a manual refresh.
const POLL_INTERVAL_MS = 10_000;

// =============================================================================
// Main page
// =============================================================================

export const Domains: React.FC = () => {
  const { t } = useTranslation(['domains', 'common']);
  const [domainInfo, setDomainInfo] = useState<DomainInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string>('');

  const [addOpen, setAddOpen] = useState(false);
  const [subdomainDialog, setSubdomainDialog] = useState(false);
  const [newSubdomain, setNewSubdomain] = useState('');

  const confirm = useConfirm();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDomainInfo = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      try {
        if (!opts.silent) setLoading(true);
        const response = await api.domains.getInfo() as { data?: DomainInfoResponse; responseObject?: DomainInfoResponse };
        const data: DomainInfoResponse = (response.data || response.responseObject) as DomainInfoResponse;
        setDomainInfo(data);
        setNewSubdomain(data?.subdomain?.name || '');
      } catch (err) {
        if (!opts.silent) {
          toast.error(errMsg(err, t('domains:toast.error_load')));
        }
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    loadDomainInfo();
  }, [loadDomainInfo]);

  // Poll while any row is in an intermediate state.
  useEffect(() => {
    const rows = domainInfo?.registry || [];
    const anyTransitional = rows.some((r) => isTransitional(r.status));

    if (anyTransitional && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(() => {
        loadDomainInfo({ silent: true });
      }, POLL_INTERVAL_MS);
    }
    if (!anyTransitional && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [domainInfo?.registry, loadDomainInfo]);

  // --- Derived state -------------------------------------------------

  const rows: DomainRegistryRow[] = useMemo(
    () => domainInfo?.registry || [],
    [domainInfo?.registry]
  );

  const primary = useMemo(() => rows.find((r) => r.isPrimary), [rows]);

  const customDomains = useMemo(
    () =>
      rows
        .filter((r) => r.kind !== 'platform_subdomain')
        .sort((a, b) => {
          if (a.status !== b.status) {
            if (a.status === 'active') return -1;
            if (b.status === 'active') return 1;
          }
          return a.hostname.localeCompare(b.hostname);
        }),
    [rows]
  );

  const platformSuffix = useMemo(() => {
    const full = domainInfo?.subdomain?.fullDomain || '';
    return full.split('.').slice(1).join('.') || 'platform';
  }, [domainInfo?.subdomain?.fullDomain]);

  // --- Actions -------------------------------------------------------

  const handleSetPrimary = async (row: DomainRegistryRow) => {
    const type = row.kind === 'platform_subdomain' ? 'subdomain' : 'custom';
    try {
      setActionLoading(`primary:${row._id}`);
      await api.domains.setPrimaryDomain(type);
      toast.success(t('domains:toast.set_primary', { hostname: row.hostname }));
      await loadDomainInfo({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, t('domains:toast.error_primary')));
    } finally {
      setActionLoading('');
    }
  };

  const handleRetrySsl = async (row: DomainRegistryRow) => {
    try {
      setActionLoading(`retry:${row._id}`);
      await api.domains.enableSSL();
      toast.success(t('domains:toast.retry_ssl', { hostname: row.hostname }));
      await loadDomainInfo({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, t('domains:toast.error_retry')));
    } finally {
      setActionLoading('');
    }
  };

  const handleRecheckDns = async (row: DomainRegistryRow) => {
    try {
      setActionLoading(`recheck:${row._id}`);
      await api.domains.verifyCustomDomain();
      toast.success(t('domains:toast.recheck_dns', { hostname: row.hostname }));
      await loadDomainInfo({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, t('domains:toast.error_recheck')));
    } finally {
      setActionLoading('');
    }
  };

  const handleRemove = async (row: DomainRegistryRow) => {
    if (
      !(await confirm({
        title: t('domains:confirm.remove_title', { hostname: row.hostname }),
        description: t('domains:confirm.remove_description'),
        confirmText: t('domains:confirm.remove_confirm'),
        variant: 'destructive',
      }))
    ) {
      return;
    }
    try {
      setActionLoading(`remove:${row._id}`);
      await api.domains.removeCustomDomain(row._id);
      toast.success(t('domains:toast.removed', { hostname: row.hostname }));
      await loadDomainInfo({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, t('domains:toast.error_remove')));
    } finally {
      setActionLoading('');
    }
  };

  const handleUpdateSubdomain = async () => {
    if (!newSubdomain || newSubdomain === domainInfo?.subdomain.name) {
      setSubdomainDialog(false);
      return;
    }
    try {
      setActionLoading('subdomain');
      await api.domains.updateSubdomain(newSubdomain);
      toast.success(t('domains:subdomain_dialog.toast.updated'));
      setSubdomainDialog(false);
      await loadDomainInfo({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, t('domains:subdomain_dialog.toast.error')));
    } finally {
      setActionLoading('');
    }
  };

  const copyText = (text: string, label = t('domains:toast.address_copied')) => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  // --- Render --------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* -- Header --------------------------------------------------- */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('domains:list.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('domains:list.subtitle')}
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          disabled={!domainInfo?.canUseCustomDomain}
          size="lg"
        >
          <Plus className="h-4 w-4 me-2" />
          {t('domains:list.action.connect')}
        </Button>
      </div>

      {/* -- Hero: your store is live at ------------------------------ */}
      <LiveStoreBanner
        hostname={primary?.hostname || domainInfo?.activeDomain || ''}
        onCopy={(h) => copyText(h, t('domains:toast.address_copied'))}
      />

      {/* -- Platform subdomain --------------------------------------- */}
      <PlatformSubdomainCard
        fullDomain={domainInfo?.subdomain?.fullDomain || ''}
        isPrimary={
          rows.find((r) => r.kind === 'platform_subdomain')?.isPrimary ?? false
        }
        onRename={() => setSubdomainDialog(true)}
        onCopy={(h) => copyText(h, t('domains:toast.address_copied'))}
        onSetPrimary={() => {
          const row = rows.find((r) => r.kind === 'platform_subdomain');
          if (row) handleSetPrimary(row);
        }}
        loading={actionLoading.startsWith('primary')}
        t={t}
      />

      {/* -- Custom domains ------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('domains:list.custom.section_title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('domains:list.custom.section_hint')}
            </p>
          </div>
          {customDomains.length > 0 && domainInfo?.canUseCustomDomain && (
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 me-1.5" />
              {t('domains:list.custom.add_another')}
            </Button>
          )}
        </div>

        {customDomains.length === 0 ? (
          <EmptyState
            icon={Globe}
            title={t('domains:list.empty.title')}
            description={t('domains:list.empty.hint')}
            action={domainInfo?.canUseCustomDomain ? (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 me-1.5" />
                {t('domains:list.empty.action')}
              </Button>
            ) : undefined}
          />
        ) : (
          <div className="space-y-4">
            {customDomains.map((row) => (
              <CustomDomainCard
                key={row._id}
                row={row}
                actionLoading={actionLoading}
                onSetPrimary={() => handleSetPrimary(row)}
                onRetry={() => handleRetrySsl(row)}
                onRecheckDns={() => handleRecheckDns(row)}
                onRemove={() => handleRemove(row)}
                onCopy={copyText}
                t={t}
              />
            ))}
          </div>
        )}
      </section>

      {/* -- Plan gate ------------------------------------------------ */}
      {!domainInfo?.canUseCustomDomain && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{t('domains:list.plan_gate.title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('domains:list.plan_gate.hint', { plan: domainInfo?.subscriptionPlan })}
              </p>
            </div>
            <Button>{t('domains:list.plan_gate.upgrade')}</Button>
          </CardContent>
        </Card>
      )}

      {/* -- Dialogs -------------------------------------------------- */}
      <AddDomainDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onComplete={() => loadDomainInfo({ silent: true })}
      />

      <Dialog open={subdomainDialog} onOpenChange={setSubdomainDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('domains:subdomain_dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('domains:subdomain_dialog.description', { suffix: platformSuffix })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>{t('domains:subdomain_dialog.field.new_address.label')}</Label>
            <div className="flex items-center gap-2">
              <Input
                value={newSubdomain}
                onChange={(e) =>
                  setNewSubdomain(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                  )
                }
                placeholder="mystore"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap font-mono">
                .{platformSuffix}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubdomainDialog(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button
              onClick={handleUpdateSubdomain}
              disabled={actionLoading === 'subdomain'}
            >
              {actionLoading === 'subdomain' && (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
              )}
              {t('common:action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// =============================================================================
// Platform subdomain card
// =============================================================================

function PlatformSubdomainCard({
  fullDomain,
  isPrimary,
  onRename,
  onCopy,
  onSetPrimary,
  loading,
  t,
}: {
  fullDomain: string;
  isPrimary: boolean;
  onRename: () => void;
  onCopy: (h: string) => void;
  onSetPrimary: () => void;
  loading: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {t('domains:list.platform.title')}
              {isPrimary && (
                <Badge variant="secondary" className="gap-1 text-[10px] h-5">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  {t('domains:list.platform.badge_main')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {t('domains:list.platform.description')}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRename}>
            <Pencil className="h-3.5 w-3.5 me-1.5" />
            {t('domains:list.platform.rename')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/40 border">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-mono text-sm flex-1 truncate">{fullDomain}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onCopy(fullDomain)}
            aria-label={t('domains:list.platform.copy_aria')}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(`https://${fullDomain}`, '_blank')}
            aria-label={t('domains:list.platform.visit_aria')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
        {!isPrimary && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t('domains:list.platform.not_primary')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onSetPrimary}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 me-1.5 animate-spin" />
              ) : (
                <Star className="h-3 w-3 me-1.5" />
              )}
              {t('domains:list.platform.use_as_main')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Custom domain card — one per domain, renders everything inline
// =============================================================================

type PlainStatus = {
  label: string;
  description: string;
  tone: 'success' | 'progress' | 'warning' | 'danger' | 'neutral';
  Icon: React.ComponentType<{ className?: string }>;
  spin?: boolean;
};

function toPlainStatus(row: DomainRegistryRow, t: (key: string) => string): PlainStatus {
  switch (row.status) {
    case 'active':
      return {
        label: t('domains:ssl.status.active'),
        description: t('domains:ssl.description.active'),
        tone: 'success',
        Icon: CheckCircle2,
      };
    case 'pending_dns':
      return {
        label: t('domains:ssl.status.pending_dns'),
        description: t('domains:ssl.description.pending_dns'),
        tone: 'warning',
        Icon: Clock,
      };
    case 'ownership_verified':
      return {
        label: t('domains:ssl.status.ownership_verified'),
        description: t('domains:ssl.description.ownership_verified'),
        tone: 'progress',
        Icon: Loader2,
        spin: true,
      };
    case 'dns_verified':
      return {
        label: t('domains:ssl.status.dns_verified'),
        description: t('domains:ssl.description.dns_verified'),
        tone: 'progress',
        Icon: Loader2,
        spin: true,
      };
    case 'provisioning_ssl':
      return {
        label: t('domains:ssl.status.provisioning_ssl'),
        description: t('domains:ssl.description.provisioning_ssl'),
        tone: 'progress',
        Icon: Loader2,
        spin: true,
      };
    case 'ssl_failed':
      return {
        label: t('domains:ssl.status.ssl_failed'),
        description: t('domains:ssl.description.ssl_failed'),
        tone: 'danger',
        Icon: AlertTriangle,
      };
    case 'dns_misconfigured':
      return {
        label: t('domains:ssl.status.dns_misconfigured'),
        description: t('domains:ssl.description.dns_misconfigured'),
        tone: 'danger',
        Icon: AlertTriangle,
      };
    case 'disabled':
      return {
        label: t('domains:ssl.status.disabled'),
        description: t('domains:ssl.description.disabled'),
        tone: 'neutral',
        Icon: CircleDot,
      };
    default:
      return {
        label: row.status,
        description: '',
        tone: 'neutral',
        Icon: CircleDot,
      };
  }
}

const TONE_CARD_BORDER: Record<PlainStatus['tone'], string> = {
  success: 'border-green-200 dark:border-green-900/60',
  progress: 'border-blue-200 dark:border-blue-900/60',
  warning: 'border-yellow-200 dark:border-yellow-900/60',
  danger: 'border-red-200 dark:border-red-900/60',
  neutral: 'border-border',
};

const TONE_PILL: Record<PlainStatus['tone'], string> = {
  success:
    'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  progress:
    'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  warning:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  neutral: 'bg-muted text-muted-foreground',
};

function CustomDomainCard({
  row,
  actionLoading,
  onSetPrimary,
  onRetry,
  onRecheckDns,
  onRemove,
  onCopy,
  t,
}: {
  row: DomainRegistryRow;
  actionLoading: string;
  onSetPrimary: () => void;
  onRetry: () => void;
  onRecheckDns: () => void;
  onRemove: () => void;
  onCopy: (text: string, label?: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const plain = toPlainStatus(row, t);
  const { Icon } = plain;
  const inProgress = stepIndex(row.status) >= 0;
  const sslDays = daysUntilExpiry(row.ssl?.expiresAt);

  const isBusy = (key: string) => actionLoading === `${key}:${row._id}`;

  return (
    <Card className={TONE_CARD_BORDER[plain.tone]}>
      {/* ---- Header: hostname + status pill + primary badge ---- */}
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-mono text-lg font-semibold truncate"
                title={row.hostname}
              >
                {row.hostname}
              </h3>
              {row.isPrimary && (
                <Badge variant="secondary" className="gap-1 text-[10px] h-5">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  {t('domains:list.custom.main_address_badge')}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onCopy(row.hostname, t('domains:toast.address_copied'))}
                aria-label={t('domains:list.copy_aria')}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div
              className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${TONE_PILL[plain.tone]}`}
            >
              <Icon className={`h-3.5 w-3.5 ${plain.spin ? 'animate-spin' : ''}`} />
              {plain.label}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {plain.description}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ---- Setup progress stepper (only during setup) ---- */}
        {inProgress && row.status !== 'active' && (
          <SetupProgress currentStatus={row.status} t={t} />
        )}

        {/* ---- Pending DNS: show records to add ---- */}
        {row.status === 'pending_dns' && (
          <DnsRecordsBlock row={row} onCopy={onCopy} t={t} />
        )}

        {/* ---- DNS misconfigured: show what we expected vs. got ---- */}
        {row.status === 'dns_misconfigured' && (
          <DnsMismatchBlock row={row} onCopy={onCopy} t={t} />
        )}

        {/* ---- SSL failure: show the error in plain language ---- */}
        {row.status === 'ssl_failed' && row.ssl?.error && (
          <ErrorBlock
            title={t('domains:ssl.status.ssl_failed')}
            message={friendlySslError(row.ssl.error)}
          />
        )}

        {/* ---- Live: SSL certificate details ---- */}
        {row.status === 'active' && (
          <LiveDetailsBlock sslDays={sslDays} row={row} t={t} />
        )}

        {/* ---- Action buttons ---- */}
        <div className="flex items-center gap-2 flex-wrap pt-2">
          {row.status === 'pending_dns' && (
            <Button
              onClick={onRecheckDns}
              disabled={isBusy('recheck')}
              size="sm"
            >
              {isBusy('recheck') ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              )}
              {t('domains:dns.check_now')}
            </Button>
          )}

          {(row.status === 'ssl_failed' ||
            row.status === 'dns_misconfigured') && (
            <Button
              onClick={
                row.status === 'dns_misconfigured' ? onRecheckDns : onRetry
              }
              disabled={isBusy('retry') || isBusy('recheck')}
              size="sm"
            >
              {isBusy('retry') || isBusy('recheck') ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              )}
              {t('domains:dns.recheck')}
            </Button>
          )}

          {row.status === 'active' && !row.isPrimary && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSetPrimary}
              disabled={isBusy('primary')}
            >
              {isBusy('primary') ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <Star className="h-3.5 w-3.5 me-1.5" />
              )}
              {t('domains:list.custom.use_as_main')}
            </Button>
          )}

          {row.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://${row.hostname}`, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5 me-1.5" />
              {t('domains:list.custom.visit')}
            </Button>
          )}

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={isBusy('remove')}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            {isBusy('remove') ? (
              <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 me-1.5" />
            )}
            {t('domains:list.custom.remove')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// CustomDomainCard sub-blocks
// =============================================================================

function DnsMismatchBlock({
  row,
  onCopy,
  t,
}: {
  row: DomainRegistryRow;
  onCopy: (text: string, label?: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 p-3">
        <p className="text-sm font-medium text-red-900 dark:text-red-200">
          {t('domains:dns.mismatch_title')}
        </p>
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground">{t('domains:dns.should_point')}</span>
          <code className="font-mono">{row.dns?.expectedTarget || '—'}</code>
          <span className="text-muted-foreground">{t('domains:dns.currently_resolves')}</span>
          <code className="font-mono">{row.dns?.lastResolved || 'nothing'}</code>
        </div>
      </div>
      {row.dns?.expectedTarget && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onCopy(row.dns!.expectedTarget!, t('domains:toast.target_copied'))
          }
        >
          <Copy className="h-3.5 w-3.5 me-1.5" />
          {t('domains:dns.copy_target')}
        </Button>
      )}
    </div>
  );
}

function ErrorBlock({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 p-3">
      <p className="text-sm font-medium text-red-900 dark:text-red-200">{title}</p>
      <p className="text-xs text-red-800 dark:text-red-300 mt-1">{message}</p>
    </div>
  );
}

function LiveDetailsBlock({
  sslDays,
  row,
  t,
}: {
  sslDays: number | null;
  row: DomainRegistryRow;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const issuedAt = row.ssl?.issuedAt
    ? new Date(row.ssl.issuedAt).toLocaleDateString()
    : null;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium">{t('domains:ssl.title')}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">{t('domains:ssl.status_label')}</p>
          <p className="font-medium">{t('domains:ssl.issued_valid')}</p>
        </div>
        {issuedAt && (
          <div>
            <p className="text-muted-foreground">{t('domains:ssl.issued_on')}</p>
            <p className="font-medium">{issuedAt}</p>
          </div>
        )}
        {sslDays !== null && (
          <div>
            <p className="text-muted-foreground">{t('domains:ssl.expires_in')}</p>
            <p
              className={`font-medium ${
                sslDays < 14
                  ? 'text-red-600 dark:text-red-400'
                  : sslDays < 30
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : ''
              }`}
            >
              {t('domains:ssl.days', { count: sslDays })}
              {sslDays < 30 && ` ${t('domains:ssl.auto_renew')}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Rough translation of common backend error codes into merchant-facing
// copy. Anything unrecognized falls through to the raw message.
function friendlySslError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('rate_limit')) {
    return 'We hit a temporary rate limit from the certificate authority. Try again in a few minutes.';
  }
  if (s.includes('timeout') || s.includes('deadline')) {
    return 'The certificate authority took too long to respond. Try again.';
  }
  if (s.includes('not_configured') || s.includes('edge_target')) {
    return 'The platform isn\'t fully configured for SSL yet. Please contact support.';
  }
  if (s.includes('cert_not_issued')) {
    return 'The certificate authority refused to issue a certificate. This usually means DNS validation failed during issuance.';
  }
  return raw;
}

