import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, hasScope, PLATFORM_SCOPES, type TenantListRow } from '../../lib/api';
import { programsApi, LIMIT_KEYS, LIMIT_LABELS, type AccessProgram, type ProgramMember, type ProgramStatus } from '../../lib/api-programs';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageSpinner, EmptyState, ErrorState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { formatDate } from '../../lib/utils';
import { Layers, Plus, Pencil, Users, XCircle, RefreshCw, Search, UserMinus, UserPlus } from 'lucide-react';
import { ProgramFormModal, StatusToggle } from './ProgramFormModal';

const STATUS_VARIANT: Record<ProgramStatus, React.ComponentProps<typeof Badge>['variant']> = {
  draft: 'outline',
  active: 'success',
  closed: 'secondary',
};
const STATUSES: ProgramStatus[] = ['draft', 'active', 'closed'];

export default function Programs() {
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = hasScope(user, PLATFORM_SCOPES.FLAGS_WRITE);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatus = searchParams.get('status');
  const status = STATUSES.includes(rawStatus as ProgramStatus) ? (rawStatus as ProgramStatus) : undefined;

  const [rows, setRows] = useState<AccessProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AccessProgram | null>(null);
  const [closing, setClosing] = useState<AccessProgram | null>(null);
  const [membersOf, setMembersOf] = useState<AccessProgram | null>(null);
  const [toggling, setToggling] = useState<{ program: AccessProgram; on: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await programsApi.list({ status, limit: 100 });
      setRows(res.programs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatusFilter = (s: ProgramStatus | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (s) next.set('status', s);
    else next.delete('status');
    setSearchParams(next, { replace: true });
  };

  // Activating/deactivating changes every member's effective flags, so it
  // asks for a reason like every other audited write.
  const toggleActive = (p: AccessProgram, on: boolean) => setToggling({ program: p, on });

  const columns: DataListColumn<AccessProgram>[] = [
    {
      id: 'name',
      header: 'Program',
      primary: true,
      cell: (p) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{p.name}</span>
            <Badge variant={STATUS_VARIANT[p.status]} className="capitalize">{p.status}</Badge>
          </div>
          <div className="font-mono text-xs text-muted-foreground">{p.key}</div>
        </div>
      ),
    },
    {
      id: 'overrides',
      header: 'Overrides',
      cell: (p) => {
        const on = p.featureOverrides.filter((o) => o.value).length;
        const off = p.featureOverrides.length - on;
        const lim = LIMIT_KEYS.filter((k) => p.limitOverrides[k] != null).length;
        return (
          <span className="text-xs text-muted-foreground">
            {on} on · {off} off · {lim} limit{lim === 1 ? '' : 's'}
          </span>
        );
      },
    },
    { id: 'members', header: 'Members', cell: (p) => <span className="tabular-nums">{p.memberCount ?? '—'}</span> },
    {
      id: 'window',
      header: 'Window',
      cell: (p) => (
        <span className="text-xs text-muted-foreground">
          {p.startsAt || p.endsAt ? `${p.startsAt ? formatDate(p.startsAt) : 'open'} → ${p.endsAt ? formatDate(p.endsAt) : 'open'}` : 'no window'}
        </span>
      ),
    },
    {
      id: 'active',
      header: 'Active',
      cell: (p) => <StatusToggle program={p} disabled={!canWrite} onChange={(v) => toggleActive(p, v)} />,
    },
    {
      id: 'actions',
      cell: (p) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setMembersOf(p)}><Users className="h-3.5 w-3.5" /> Members</Button>
          {canWrite && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              {p.status !== 'closed' && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setClosing(p)}>
                  <XCircle className="h-3.5 w-3.5" /> Close
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Layers className="mt-0.5 h-6 w-6 shrink-0 text-indigo-600" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Access programs</h1>
            <p className="text-sm text-muted-foreground">
              Cohorts of stores (pilot, partner, early access) carrying feature and limit overrides on top of their plan. Closing a program stops its overrides without touching the stores.
              {!canWrite && ' (read-only — you lack the flags.write scope)'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
          {canWrite && <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New program</Button>}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto scrollbar-hide rounded-md border bg-card p-1 w-full sm:w-fit">
        {[undefined, ...STATUSES].map((s) => (
          <button
            key={s ?? 'all'}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 rounded px-2.5 py-1 text-xs capitalize transition-colors ${(s ?? '') === (status ?? '') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            {s ?? 'All'}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <PageSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No programs" description="Create a program to give a cohort of stores special features or limits." action={canWrite ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New program</Button> : undefined} />
      ) : (
        <DataList columns={columns} rows={rows} rowKey={(p) => p._id} />
      )}

      <ProgramFormModal open={creating} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await load(); }} />
      <ProgramFormModal open={!!editing} program={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />

      <ConfirmModal
        open={!!closing}
        onClose={() => setClosing(null)}
        title={`Close "${closing?.name ?? ''}"`}
        description="Its feature and limit overrides stop applying to every member immediately. Members keep their plan; nothing is deleted. This cannot be reopened."
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 4, placeholder: 'Pilot ended, rolled into GA…' }]}
        confirmLabel="Close program"
        confirmVariant="destructive"
        onConfirm={async (v) => {
          if (!closing) return;
          await programsApi.close(closing._id, v.reason);
          toast.success('Program closed');
          setClosing(null);
          await load();
        }}
      />

      <ConfirmModal
        open={!!toggling}
        onClose={() => setToggling(null)}
        title={toggling?.on ? `Activate "${toggling.program.name}"` : `Deactivate "${toggling?.program.name ?? ''}"`}
        description={toggling?.on ? 'Its feature and limit overrides start applying to every member.' : 'Its overrides stop applying; members keep their plan values. The program stays editable as a draft.'}
        fields={[{ name: 'reason', label: 'Reason', required: true, minLength: 4 }]}
        confirmLabel={toggling?.on ? 'Activate' : 'Deactivate'}
        onConfirm={async (v) => {
          if (!toggling) return;
          await programsApi.update(toggling.program._id, { status: toggling.on ? 'active' : 'draft', reason: v.reason });
          toast.success(toggling.on ? 'Program activated' : 'Program set to draft');
          setToggling(null);
          await load();
        }}
      />

      {membersOf && <MembersModal program={membersOf} canWrite={canWrite} onClose={() => { setMembersOf(null); void load(); }} />}
    </div>
  );
}

function MembersModal({ program, canWrite, onClose }: { program: AccessProgram; canWrite: boolean; onClose: () => void }) {
  const toast = useToast();
  const [members, setMembers] = useState<ProgramMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TenantListRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [removing, setRemoving] = useState<ProgramMember | null>(null);
  const [adding, setAdding] = useState<TenantListRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await programsApi.members(program._id, { limit: 100 });
      setMembers(r.members);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [program._id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.tenants.list({ q: term, limit: 8 });
        if (!cancelled) setResults(r.tenants.filter((tn) => !members.some((m) => m.tenantId === tn._id)));
      } catch { if (!cancelled) setResults([]); }
      finally { if (!cancelled) setSearching(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, members]);

  const add = (t: TenantListRow) => setAdding(t);

  return (
    <Modal open onClose={onClose} title={`Members of ${program.name}`} description={`${members.length} store(s) · overrides apply while the program is active.`} className="max-w-2xl">
      <div className="space-y-4">
        {canWrite && program.status !== 'closed' && (
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a store — search by name, slug or email" className="pl-8" />
            </div>
            {(results.length > 0 || searching) && (
              <div className="mt-1 divide-y rounded-md border">
                {searching && results.length === 0 && <p className="p-2 text-xs text-muted-foreground">Searching…</p>}
                {results.map((t) => (
                  <div key={t._id} className="flex items-center justify-between gap-2 p-2">
                    <div className="min-w-0"><p className="truncate text-sm">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.slug} · {t.email}</p></div>
                    <Button size="sm" variant="outline" onClick={() => add(t)}><UserPlus className="h-3.5 w-3.5" /> Add</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {loading ? <PageSpinner /> : members.length === 0 ? (
          <EmptyState title="No members yet" description="Search above to add stores." />
        ) : (
          <div className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
            {members.map((m) => (
              <div key={m.tenantId} className="flex items-center justify-between gap-2 p-2">
                <div className="min-w-0">
                  <Link to={`/tenants/${m.tenantId}`} className="truncate text-sm font-medium hover:underline">{m.name}</Link>
                  <p className="truncate text-xs text-muted-foreground">{m.slug} · {m.subscriptionPlan}{m.lifecycle ? ` · ${m.lifecycle}` : ''}</p>
                </div>
                {canWrite && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRemoving(m)}><UserMinus className="h-3.5 w-3.5" /></Button>}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Limit overrides in this program: {LIMIT_KEYS.filter((k) => program.limitOverrides[k] != null).map((k) => `${LIMIT_LABELS[k]} ${program.limitOverrides[k]}`).join(' · ') || 'none'}.</p>
      </div>
      <ConfirmModal
        open={!!adding}
        onClose={() => setAdding(null)}
        title={`Add ${adding?.name ?? ''} to ${program.name}`}
        description="The store receives this program's feature and limit overrides while the program is active."
        fields={[{ name: 'reason', label: 'Reason', required: true, minLength: 4, placeholder: 'Pilot cohort, partner agreement…' }]}
        confirmLabel="Add store"
        onConfirm={async (v) => {
          if (!adding) return;
          await programsApi.addMember(program._id, adding._id, v.reason);
          toast.success(`${adding.name} added`);
          setAdding(null);
          setQ('');
          await load();
        }}
      />
      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? ''} from ${program.name}`}
        description="The store loses this program's overrides immediately."
        fields={[{ name: 'reason', label: 'Reason', required: true, minLength: 4 }]}
        confirmLabel="Remove"
        confirmVariant="destructive"
        onConfirm={async (v) => {
          if (!removing) return;
          await programsApi.removeMember(program._id, removing.tenantId, v.reason);
          toast.success('Member removed');
          setRemoving(null);
          await load();
        }}
      />
    </Modal>
  );
}
