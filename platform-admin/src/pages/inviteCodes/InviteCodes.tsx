import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, RefreshCw, Plus, Copy, Link2, Ban, Store, CheckCircle2, CircleSlash, Hash, Lock } from 'lucide-react';
import {
  inviteCodesApi,
  signupLinkFor,
  type InviteCode,
  type InviteCodeList,
  type SignupMode,
} from '../../lib/api-invite-codes';
import { isPromoter } from '../../lib/api';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input, Label, Select } from '../../components/ui/Input';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../../components/ui/Spinner';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../components/ui/toast-context';
import { KpiTile } from '../../components/tenant/OverviewCards';
import { formatDate, formatRelative } from '../../lib/utils';

const MAX_PER_BATCH = 20;

const errorText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (err instanceof Error ? err.message : fallback);

const MODES: { value: SignupMode; label: string; text: string }[] = [
  { value: 'open', label: 'Open', text: 'Anyone can sign up. No code field.' },
  { value: 'optional', label: 'Referral code', text: 'Signup shows an optional "Referral code" field.' },
  {
    value: 'required',
    label: 'Beta invitation code',
    text: 'Signup needs a code, asked for as "Beta invitation code".',
  },
];

const STATUS: Record<InviteCode['status'], { label: string; variant: 'success' | 'secondary' | 'outline' }> = {
  active: { label: 'Unused', variant: 'outline' },
  used: { label: 'Used', variant: 'success' },
  revoked: { label: 'Revoked', variant: 'secondary' },
};

/**
 * Invitation codes (PBI 10-47). Owners and promoters create signup codes; one
 * code registers one store. A promoter sees only their own codes and the
 * stores registered with them; an owner sees everyone's, can filter by
 * promoter and sets whether signup needs a code.
 */
export default function InviteCodes() {
  const toast = useToast();
  const { user } = useAuth();
  const owner = user?.role === 'owner';

  const [promoterId, setPromoterId] = useState('');
  const [data, setData] = useState<InviteCodeList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await inviteCodesApi.list(promoterId ? { promoterId } : {}));
    } catch (err) {
      setError(errorText(err, 'Failed to load codes'));
    } finally {
      setLoading(false);
    }
  }, [promoterId]);
  useEffect(() => {
    void load();
  }, [load]);

  // ── Create ───────────────────────────────────────────────
  const [count, setCount] = useState(1);
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const create = async () => {
    setCreating(true);
    try {
      const { codes } = await inviteCodesApi.create({ count, note: note.trim() || null });
      setFresh(new Set(codes.map((c) => c.id)));
      toast.success(codes.length === 1 ? `Code ${codes[0].code} created` : `${codes.length} codes created`);
      setNote('');
      await load();
    } catch (err) {
      toast.error(errorText(err, 'Could not create codes'));
    } finally {
      setCreating(false);
    }
  };

  // ── Revoke ───────────────────────────────────────────────
  const [revoking, setRevoking] = useState<InviteCode | null>(null);

  // ── Signup mode (owner) ──────────────────────────────────
  const [savingMode, setSavingMode] = useState<SignupMode | null>(null);
  const changeMode = async (mode: SignupMode) => {
    setSavingMode(mode);
    try {
      await inviteCodesApi.setSignupMode(mode);
      setData((d) => (d ? { ...d, signupMode: mode } : d));
      toast.success('Signup updated');
    } catch (err) {
      toast.error(errorText(err, 'Could not update signup'));
    } finally {
      setSavingMode(null);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error('Could not copy');
    }
  };

  const columns: DataListColumn<InviteCode>[] = [
    {
      id: 'code',
      header: 'Code',
      primary: true,
      cell: (c) => (
        <div className="flex items-center gap-2">
          <code
            dir="ltr"
            className={`rounded-md px-2 py-1 font-mono text-sm font-semibold tracking-wider ${
              fresh.has(c.id) ? 'bg-amber-100' : 'bg-muted'
            }`}
          >
            {c.code}
          </code>
          {c.note && <span className="truncate text-xs text-muted-foreground">{c.note}</span>}
        </div>
      ),
    },
    ...(owner
      ? [
          {
            id: 'by',
            header: 'Created by',
            hideOnMobile: false,
            cell: (c: InviteCode) => <span className="text-xs">{c.createdByName || c.createdByEmail || '—'}</span>,
          } satisfies DataListColumn<InviteCode>,
        ]
      : []),
    {
      id: 'status',
      header: 'Status',
      cell: (c) => <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge>,
    },
    {
      id: 'created',
      header: 'Created',
      cell: (c) => <Timestamp at={c.createdAt} />,
    },
    {
      id: 'used',
      header: 'Used',
      cell: (c) =>
        c.status === 'used' ? (
          <div className="text-xs">
            <Timestamp at={c.usedAt} />
            {c.usedByTenantId && (
              <Link to={`/invite-codes/stores/${c.usedByTenantId}`} className="mt-0.5 inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline">
                <Store className="h-3 w-3" /> {c.usedByTenantName || 'Store'}
              </Link>
            )}
          </div>
        ) : c.status === 'revoked' ? (
          <span className="text-xs text-muted-foreground">Revoked {c.revokedAt ? formatRelative(c.revokedAt) : ''}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Not used yet</span>
        ),
    },
    {
      id: 'actions',
      cell: (c) =>
        c.status === 'active' ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => copy(c.code, 'Code')} aria-label={`Copy ${c.code}`} title="Copy code">
              <Copy className="h-4 w-4" />
            </Button>
            {data && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copy(signupLinkFor(data.signupUrl, c.code), 'Signup link')}
                aria-label={`Copy signup link for ${c.code}`}
                title="Copy signup link (code filled in)"
              >
                <Link2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setRevoking(c)} aria-label={`Revoke ${c.code}`} title="Revoke">
              <Ban className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : null,
    },
  ];

  if (loading && !data) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Ticket className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invitation codes</h1>
            <p className="text-sm text-muted-foreground">
              Each code registers one store. {isPromoter(user) ? 'These are your codes and the stores registered with them.' : ''}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {owner && data?.signupMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" /> Signup
            </CardTitle>
            <CardDescription>Whether new merchants need a code to create their first store. Adding another store to an existing account never needs one.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Signup mode">
              {MODES.map((m) => {
                const on = data.signupMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!!savingMode}
                    onClick={() => !on && changeMode(m.value)}
                    className={`rounded-lg border p-3 text-start transition ${
                      on ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="text-sm font-semibold">{m.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{m.text}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiTile label="Codes created" value={data.stats.created.toLocaleString()} icon={<Hash className="h-4 w-4" />} />
          <KpiTile
            label="Stores registered"
            value={data.stats.registered.toLocaleString()}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone={data.stats.registered > 0 ? 'text-emerald-600' : undefined}
          />
          <KpiTile label="Unused" value={data.stats.unused.toLocaleString()} icon={<Ticket className="h-4 w-4" />} />
          <KpiTile label="Revoked" value={data.stats.revoked.toLocaleString()} icon={<CircleSlash className="h-4 w-4" />} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 sm:w-28">
              <Label htmlFor="count">How many</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={MAX_PER_BATCH}
                value={count}
                onChange={(e) => setCount(Math.min(MAX_PER_BATCH, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="note">For (optional)</Label>
              <Input id="note" maxLength={120} placeholder="e.g. Omdurman market visit" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button onClick={create} disabled={creating}>
              <Plus className="h-4 w-4" /> {count === 1 ? 'Create code' : `Create ${count} codes`}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{owner ? 'All codes' : 'Your codes'}</CardTitle>
            <CardDescription>Newest first, with when each was created and used.</CardDescription>
          </div>
          {owner && data?.promoters && data.promoters.length > 0 && (
            <Select value={promoterId} onChange={(e) => setPromoterId(e.target.value)} className="sm:w-64" aria-label="Filter by creator">
              <option value="">Everyone</option>
              {data.promoters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.email}
                </option>
              ))}
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorState error={error} onRetry={load} />
          ) : !data || data.codes.length === 0 ? (
            <EmptyState title="No codes yet" description="Create a code and share it with a merchant." />
          ) : (
            <DataList columns={columns} rows={data.codes} rowKey={(c) => c.id} />
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title={`Revoke ${revoking?.code}?`}
        description="Nobody will be able to sign up with this code."
        confirmLabel="Revoke"
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!revoking) return;
          try {
            await inviteCodesApi.revoke(revoking.id);
            toast.success(`${revoking.code} revoked`);
            setRevoking(null);
            await load();
          } catch (err) {
            toast.error(errorText(err, 'Could not revoke'));
          }
        }}
      />
    </div>
  );
}

function Timestamp({ at }: { at: string | null }) {
  if (!at) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="text-xs leading-tight" title={formatRelative(at)}>
      <div>{formatDate(at)}</div>
      <div className="text-muted-foreground">{formatRelative(at)}</div>
    </div>
  );
}
