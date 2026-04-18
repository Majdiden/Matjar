import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { AddDomainDialog } from './AddDomainDialog';

// Poll every 10s while any row is in a transitional state
// (pending_dns, ownership_verified, dns_verified, provisioning_ssl).
// The state machine advances asynchronously so the dashboard reflects
// it without a manual refresh.
const POLL_INTERVAL_MS = 10_000;

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

// =============================================================================
// Main page
// =============================================================================
//
// Design notes
// ------------
// This page is written for merchants, not DevOps engineers. Everything a
// merchant needs to know about a domain is visible inline — no drawer,
// no tabs, no data tables. Each custom domain is a full card that
// renders its own status-specific body (DNS records when pending,
// progress indicator while provisioning, SSL details when live, error
// + retry when failed). Technical labels like "CNAME mismatch" or
// "provisioning_ssl" are translated into plain English.
//
// Structure:
//   1. Hero card — "Your store is live at <primary hostname>"
//   2. Platform subdomain card — the free <slug>.platform host
//   3. Custom domains — one expanded card per row, or empty-state CTA
//   4. Plan gate card if the tenant isn't on Pro/Enterprise

export const Domains: React.FC = () => {
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
          toast.error(errMsg(err, 'Failed to load domains'));
        }
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDomainInfo();
  }, [loadDomainInfo]);

  // Poll while any row is in an intermediate state. Clears the
  // interval as soon as everything settles.
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
          // Live domains first, then hostname alpha — this keeps the
          // "one I actually care about right now" at the top while
          // in-progress domains sit directly below.
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
      toast.success(`${row.hostname} is now your main storefront address`);
      await loadDomainInfo({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, 'Failed to update main address'));
    } finally {
      setActionLoading('');
    }
  };

  const handleRetrySsl = async (row: DomainRegistryRow) => {
    try {
      setActionLoading(`retry:${row._id}`);
      await api.domains.enableSSL();
      toast.success(`Retrying setup for ${row.hostname}`);
      await loadDomainInfo({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, 'Retry failed'));
    } finally {
      setActionLoading('');
    }
  };

  const handleRecheckDns = async (row: DomainRegistryRow) => {
    try {
      setActionLoading(`recheck:${row._id}`);
      await api.domains.verifyCustomDomain();
      toast.success(`Checked DNS for ${row.hostname}`);
      await loadDomainInfo({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, 'DNS check failed'));
    } finally {
      setActionLoading('');
    }
  };

  const handleRemove = async (row: DomainRegistryRow) => {
    if (
      !(await confirm({
        title: `Remove ${row.hostname}?`,
        description:
          'Your store will stop responding at this address and the security certificate will be revoked. You can add the domain back later.',
        confirmText: 'Remove domain',
        variant: 'destructive',
      }))
    ) {
      return;
    }
    try {
      setActionLoading(`remove:${row._id}`);
      await api.domains.removeCustomDomain(row._id);
      toast.success(`${row.hostname} removed`);
      await loadDomainInfo({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, 'Failed to remove domain'));
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
      toast.success('Address updated');
      setSubdomainDialog(false);
      await loadDomainInfo({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, 'Failed to update address'));
    } finally {
      setActionLoading('');
    }
  };

  const copyText = (text: string, label = 'Copied') => {
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
          <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
          <p className="text-muted-foreground mt-1">
            The web addresses people use to visit your store.
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          disabled={!domainInfo?.canUseCustomDomain}
          size="lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Connect a domain
        </Button>
      </div>

      {/* -- Hero: your store is live at ------------------------------ */}
      <PrimaryDomainHero
        hostname={primary?.hostname || domainInfo?.activeDomain || ''}
        onCopy={(h) => copyText(h, 'Address copied')}
      />

      {/* -- Platform subdomain --------------------------------------- */}
      <PlatformSubdomainCard
        fullDomain={domainInfo?.subdomain?.fullDomain || ''}
        isPrimary={
          rows.find((r) => r.kind === 'platform_subdomain')?.isPrimary ?? false
        }
        onRename={() => setSubdomainDialog(true)}
        onCopy={(h) => copyText(h, 'Address copied')}
        onSetPrimary={() => {
          const row = rows.find((r) => r.kind === 'platform_subdomain');
          if (row) handleSetPrimary(row);
        }}
        loading={actionLoading.startsWith('primary')}
      />

      {/* -- Custom domains ------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your custom domains</h2>
            <p className="text-sm text-muted-foreground">
              Connect a domain you already own — we'll handle the security
              certificate automatically.
            </p>
          </div>
          {customDomains.length > 0 && domainInfo?.canUseCustomDomain && (
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add another
            </Button>
          )}
        </div>

        {customDomains.length === 0 ? (
          <CustomDomainEmptyState
            canAdd={!!domainInfo?.canUseCustomDomain}
            onAdd={() => setAddOpen(true)}
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
              <p className="font-medium">Custom domains are a Pro feature</p>
              <p className="text-sm text-muted-foreground">
                You're on the <span className="capitalize">{domainInfo?.subscriptionPlan}</span> plan.
                Upgrade to connect a domain you already own.
              </p>
            </div>
            <Button>Upgrade plan</Button>
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
            <DialogTitle>Change your free address</DialogTitle>
            <DialogDescription>
              This will change the slug used for your free{' '}
              <span className="font-mono">.{platformSuffix}</span> address. Any
              bookmarks to your old address will stop working.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>New address</Label>
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
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSubdomain}
              disabled={actionLoading === 'subdomain'}
            >
              {actionLoading === 'subdomain' && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// =============================================================================
// Hero: big "your store is live at" card
// =============================================================================

function PrimaryDomainHero({
  hostname,
  onCopy,
}: {
  hostname: string;
  onCopy: (h: string) => void;
}) {
  if (!hostname) return null;
  return (
    <Card className="border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/10">
      <CardContent className="py-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">
              Your store is live at
            </p>
            <p
              className="font-mono text-xl md:text-2xl font-semibold truncate mt-0.5"
              title={hostname}
            >
              {hostname}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onCopy(hostname)}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy
            </Button>
            <Button
              size="sm"
              onClick={() => window.open(`https://${hostname}`, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Visit store
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
}: {
  fullDomain: string;
  isPrimary: boolean;
  onRename: () => void;
  onCopy: (h: string) => void;
  onSetPrimary: () => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Free platform address
              {isPrimary && (
                <Badge variant="secondary" className="gap-1 text-[10px] h-5">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Main address
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Always available. No DNS setup needed. Free forever.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRename}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Rename
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
            aria-label="Copy address"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(`https://${fullDomain}`, '_blank')}
            aria-label="Visit store"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
        {!isPrimary && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Not currently your main address.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onSetPrimary}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <Star className="h-3 w-3 mr-1.5" />
              )}
              Use as main address
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

// Translate state-machine statuses into plain English. The dashboard
// face of the Domain state machine — terms a merchant reads, not the
// backend enum values.
function toPlainStatus(row: DomainRegistryRow): PlainStatus {
  switch (row.status) {
    case 'active':
      return {
        label: 'Live',
        description: 'Your store is serving visitors at this address.',
        tone: 'success',
        Icon: CheckCircle2,
      };
    case 'pending_dns':
      return {
        label: 'Waiting for DNS records',
        description:
          'Add the DNS records shown below at your domain provider. This proves you own the domain.',
        tone: 'warning',
        Icon: Clock,
      };
    case 'ownership_verified':
      return {
        label: 'Checking DNS routing',
        description:
          'Ownership confirmed. Now checking that your domain points to our servers.',
        tone: 'progress',
        Icon: Loader2,
        spin: true,
      };
    case 'dns_verified':
      return {
        label: 'Requesting security certificate',
        description:
          'DNS is pointing at us. Preparing to issue an SSL certificate.',
        tone: 'progress',
        Icon: Loader2,
        spin: true,
      };
    case 'provisioning_ssl':
      return {
        label: 'Setting up security certificate',
        description:
          "This usually takes a few minutes. You don't need to do anything.",
        tone: 'progress',
        Icon: Loader2,
        spin: true,
      };
    case 'ssl_failed':
      return {
        label: "Couldn't issue certificate",
        description:
          "We weren't able to get a security certificate for this domain. You can try again.",
        tone: 'danger',
        Icon: AlertTriangle,
      };
    case 'dns_misconfigured':
      return {
        label: 'DNS is no longer pointing at us',
        description:
          'Your DNS records changed and no longer point to our servers. Update them and re-check.',
        tone: 'danger',
        Icon: AlertTriangle,
      };
    case 'disabled':
      return {
        label: 'Disabled',
        description: 'This domain is turned off and not serving traffic.',
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

// Healthy lifecycle steps the merchant sees during provisioning.
const SETUP_STEPS = [
  { key: 'pending_dns', label: 'Verify ownership' },
  { key: 'ownership_verified', label: 'Check DNS routing' },
  { key: 'dns_verified', label: 'Issue certificate' },
  { key: 'active', label: 'Live' },
] as const;

function stepIndex(status: DomainRegistryRow['status']): number {
  switch (status) {
    case 'pending_dns':
      return 0;
    case 'ownership_verified':
      return 1;
    case 'dns_verified':
    case 'provisioning_ssl':
      return 2;
    case 'active':
      return 3;
    default:
      return -1;
  }
}

function CustomDomainCard({
  row,
  actionLoading,
  onSetPrimary,
  onRetry,
  onRecheckDns,
  onRemove,
  onCopy,
}: {
  row: DomainRegistryRow;
  actionLoading: string;
  onSetPrimary: () => void;
  onRetry: () => void;
  onRecheckDns: () => void;
  onRemove: () => void;
  onCopy: (text: string, label?: string) => void;
}) {
  const plain = toPlainStatus(row);
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
                  Main address
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onCopy(row.hostname, 'Address copied')}
                aria-label="Copy hostname"
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
          <SetupProgress currentStatus={row.status} />
        )}

        {/* ---- Pending DNS: show records to add ---- */}
        {row.status === 'pending_dns' && (
          <DnsRecordsBlock row={row} onCopy={onCopy} />
        )}

        {/* ---- DNS misconfigured: show what we expected vs. got ---- */}
        {row.status === 'dns_misconfigured' && (
          <DnsMismatchBlock row={row} onCopy={onCopy} />
        )}

        {/* ---- SSL failure: show the error in plain language ---- */}
        {row.status === 'ssl_failed' && row.ssl?.error && (
          <ErrorBlock
            title="Why it failed"
            message={friendlySslError(row.ssl.error)}
          />
        )}

        {/* ---- Live: SSL certificate details ---- */}
        {row.status === 'active' && (
          <LiveDetailsBlock sslDays={sslDays} row={row} />
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
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              I've added the records — check now
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
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Try again
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
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Star className="h-3.5 w-3.5 mr-1.5" />
              )}
              Use as main address
            </Button>
          )}

          {row.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://${row.hostname}`, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Visit
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
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// CustomDomainCard sub-blocks
// =============================================================================

function SetupProgress({
  currentStatus,
}: {
  currentStatus: DomainRegistryRow['status'];
}) {
  const currentIdx = stepIndex(currentStatus);
  return (
    <div className="pt-1">
      <div className="flex items-center">
        {SETUP_STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 ${
                    done
                      ? 'bg-green-500 border-green-500 text-white'
                      : active
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-muted border-muted-foreground/20 text-muted-foreground'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[10px] text-center whitespace-nowrap ${
                    done || active ? 'font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < SETUP_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 -mt-4 rounded ${
                    done ? 'bg-green-500' : 'bg-muted-foreground/20'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function DnsRecordsBlock({
  row,
  onCopy,
}: {
  row: DomainRegistryRow;
  onCopy: (text: string, label?: string) => void;
}) {
  // Two records the merchant needs:
  //   1. TXT (ownership verification) — always required
  //   2. CNAME or A (routing to our edge) — always required
  const records: Array<{
    type: string;
    name: string;
    value: string;
    purpose: string;
  }> = [];

  if (row.verification?.recordName && row.verification?.recordValue) {
    records.push({
      type: 'TXT',
      name: row.verification.recordName,
      value: row.verification.recordValue,
      purpose: 'Proves you own the domain',
    });
  }
  if (row.dns?.expectedTarget) {
    records.push({
      type: row.dns.targetType || 'CNAME',
      name: row.hostname,
      value: row.dns.expectedTarget,
      purpose: 'Routes visitors to your store',
    });
  }

  if (records.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Add these records in your DNS settings</p>
        <span className="text-xs text-muted-foreground">
          Usually takes 5–30 minutes to take effect
        </span>
      </div>
      <div className="space-y-2">
        {records.map((rec, i) => (
          <div
            key={i}
            className="border rounded-lg p-3 bg-muted/20 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {rec.type}
              </Badge>
              <span className="text-xs text-muted-foreground">{rec.purpose}</span>
            </div>
            <DnsField label="Name" value={rec.name} onCopy={onCopy} />
            <DnsField label="Value" value={rec.value} onCopy={onCopy} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DnsField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (text: string, copyLabel?: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-12 shrink-0">{label}</span>
      <code className="font-mono bg-background px-2 py-1 rounded border flex-1 truncate">
        {value}
      </code>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => onCopy(value, `${label} copied`)}
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function DnsMismatchBlock({
  row,
  onCopy,
}: {
  row: DomainRegistryRow;
  onCopy: (text: string, label?: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 p-3">
        <p className="text-sm font-medium text-red-900 dark:text-red-200">
          DNS no longer points at our servers
        </p>
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground">Should point at:</span>
          <code className="font-mono">{row.dns?.expectedTarget || '—'}</code>
          <span className="text-muted-foreground">Currently resolves to:</span>
          <code className="font-mono">{row.dns?.lastResolved || 'nothing'}</code>
        </div>
      </div>
      {row.dns?.expectedTarget && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onCopy(row.dns!.expectedTarget!, 'Target copied')
          }
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Copy correct target
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
}: {
  sslDays: number | null;
  row: DomainRegistryRow;
}) {
  const issuedAt = row.ssl?.issuedAt
    ? new Date(row.ssl.issuedAt).toLocaleDateString()
    : null;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium">Security certificate</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Status</p>
          <p className="font-medium">Issued & valid</p>
        </div>
        {issuedAt && (
          <div>
            <p className="text-muted-foreground">Issued on</p>
            <p className="font-medium">{issuedAt}</p>
          </div>
        )}
        {sslDays !== null && (
          <div>
            <p className="text-muted-foreground">Expires in</p>
            <p
              className={`font-medium ${
                sslDays < 14
                  ? 'text-red-600 dark:text-red-400'
                  : sslDays < 30
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : ''
              }`}
            >
              {sslDays} days
              {sslDays < 30 && ' (will auto-renew)'}
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

// =============================================================================
// Empty state
// =============================================================================

function CustomDomainEmptyState({
  canAdd,
  onAdd,
}: {
  canAdd: boolean;
  onAdd: () => void;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center space-y-3">
        <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center">
          <Globe className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">No custom domains yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connect a domain like <span className="font-mono">mystore.com</span>{' '}
            to give your store a professional address. We'll handle the SSL
            certificate automatically.
          </p>
        </div>
        {canAdd && (
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Connect a domain
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
