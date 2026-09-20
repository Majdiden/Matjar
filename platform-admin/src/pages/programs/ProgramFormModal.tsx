import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Label, Select, Textarea } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { useToast } from '../../components/ui/toast-context';
import { api, type FeatureFlagDef } from '../../lib/api';
import { programsApi, LIMIT_KEYS, LIMIT_LABELS, type AccessProgram, type ProgramInput, type ProgramStatus } from '../../lib/api-programs';

/** Tri-state per flag: undefined = inherit, true/false = program override. */
type FlagChoice = 'inherit' | 'on' | 'off';

function toDateInput(v: string | null | undefined): string {
  return v ? new Date(v).toISOString().slice(0, 10) : '';
}

export function ProgramFormModal({
  open,
  program,
  onClose,
  onSaved,
}: {
  open: boolean;
  program?: AccessProgram | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const isEdit = !!program;

  const [registry, setRegistry] = useState<FeatureFlagDef[]>([]);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProgramStatus>('draft');
  const [countries, setCountries] = useState('');
  const [planKeys, setPlanKeys] = useState('');
  const [flags, setFlags] = useState<Record<string, FlagChoice>>({});
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api.features
      .get()
      .then((r) => setRegistry(r.registry.filter((f) => f.type === 'boolean')))
      .catch(() => setRegistry([]));
    setKey(program?.key ?? '');
    setName(program?.name ?? '');
    setDescription(program?.description ?? '');
    setStatus(program?.status ?? 'draft');
    setCountries((program?.eligibility.countries ?? []).join(', '));
    setPlanKeys((program?.eligibility.planKeys ?? []).join(', '));
    const f: Record<string, FlagChoice> = {};
    for (const o of program?.featureOverrides ?? []) f[o.key] = o.value ? 'on' : 'off';
    setFlags(f);
    const l: Record<string, string> = {};
    for (const k of LIMIT_KEYS) l[k] = program?.limitOverrides?.[k] != null ? String(program.limitOverrides[k]) : '';
    setLimits(l);
    setStartsAt(toDateInput(program?.startsAt));
    setEndsAt(toDateInput(program?.endsAt));
    setReason('');
    setError(null);
    setSaving(false);
  }, [open, program]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const featureOverrides = Object.entries(flags)
        .filter(([, c]) => c !== 'inherit')
        .map(([k, c]) => ({ key: k, value: c === 'on' }));
      const limitOverrides: Record<string, number | null> = {};
      for (const k of LIMIT_KEYS) {
        const raw = limits[k]?.trim();
        if (raw === '' || raw === undefined) limitOverrides[k] = null;
        else {
          const n = Number(raw);
          if (!Number.isInteger(n) || n < 0) throw new Error(`${LIMIT_LABELS[k]} must be a whole number`);
          limitOverrides[k] = n;
        }
      }
      const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
      const payload: ProgramInput = {
        name: name.trim(),
        description: description.trim(),
        status,
        eligibility: { countries: csv(countries).map((c) => c.toUpperCase()), planKeys: csv(planKeys).map((p) => p.toLowerCase()) },
        featureOverrides,
        limitOverrides,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(`${endsAt}T23:59:59Z`).toISOString() : null,
      };
      payload.reason = reason.trim();
      if (isEdit && program) {
        // PATCH may only move between draft and active; closing is a separate action.
        if (payload.status === 'closed') delete payload.status;
        await programsApi.update(program._id, payload);
        toast.success('Program updated');
      } else {
        await programsApi.create({ ...payload, key: key.trim().toLowerCase() });
        toast.success('Program created');
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const valid = reason.trim().length >= 4 && name.trim().length >= 2 && (isEdit || /^[a-z0-9][a-z0-9-_]{1,63}$/.test(key.trim().toLowerCase()));

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? `Edit program` : 'New access program'}
      description={isEdit ? `Editing "${program?.name}" (key is immutable).` : 'A named cohort of stores with feature and limit overrides.'}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!valid}>{isEdit ? 'Save changes' : 'Create program'}</Button>
        </>
      }
    >
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pg-key">Key <span className="text-destructive">*</span></Label>
            <Input id="pg-key" value={key} disabled={isEdit} onChange={(e) => setKey(e.target.value)} placeholder="pilot" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pg-name">Name <span className="text-destructive">*</span></Label>
            <Input id="pg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pilot Program" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pg-desc">Description</Label>
          <Textarea id="pg-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pg-status">Status</Label>
            <Select id="pg-status" value={status} disabled={program?.status === 'closed'} onChange={(e) => setStatus(e.target.value as ProgramStatus)}>
              <option value="draft">Draft (inactive)</option>
              <option value="active">Active</option>
              {program?.status === 'closed' && <option value="closed">Closed (cannot reopen)</option>}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pg-start">Starts</Label>
            <Input id="pg-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pg-end">Ends</Label>
            <Input id="pg-end" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pg-countries">Eligible countries (ISO2, comma-separated)</Label>
            <Input id="pg-countries" value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="SD, EG" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pg-plans">Eligible plan keys (comma-separated)</Label>
            <Input id="pg-plans" value={planKeys} onChange={(e) => setPlanKeys(e.target.value)} placeholder="trial, starter" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Eligibility is informational — membership is managed explicitly on the Members tab.</p>

        <div>
          <p className="mb-1 text-sm font-medium">Feature overrides</p>
          <p className="mb-2 text-xs text-muted-foreground">Inherit leaves the plan/global value; On/Off forces it for every member.</p>
          <div className="divide-y rounded-md border">
            {registry.map((def) => {
              const c = flags[def.key] ?? 'inherit';
              return (
                <div key={def.key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{def.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{def.key}</p>
                  </div>
                  <Select
                    aria-label={`${def.label} override`}
                    value={c}
                    onChange={(e) => setFlags((f) => ({ ...f, [def.key]: e.target.value as FlagChoice }))}
                    className="w-28 shrink-0"
                  >
                    <option value="inherit">Inherit</option>
                    <option value="on">Force on</option>
                    <option value="off">Force off</option>
                  </Select>
                </div>
              );
            })}
            {registry.length === 0 && <p className="p-3 text-xs text-muted-foreground">Loading flags…</p>}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Limit overrides</p>
          <p className="mb-2 text-xs text-muted-foreground">Blank = inherit from the plan. Not enforced yet — shown on the usage tab.</p>
          <div className="grid grid-cols-2 gap-3">
            {LIMIT_KEYS.map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`pg-lim-${k}`}>{LIMIT_LABELS[k]}</Label>
                <Input id={`pg-lim-${k}`} type="number" min={0} value={limits[k] ?? ''} onChange={(e) => setLimits((l) => ({ ...l, [k]: e.target.value }))} placeholder="inherit" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pg-reason">Reason <span className="text-destructive">*</span> <span className="font-normal text-muted-foreground">(audited)</span></Label>
          <Input id="pg-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={isEdit ? 'e.g. extend pilot to Q4' : 'e.g. Q4 pilot for Khartoum merchants'} />
        </div>
      </div>
    </Modal>
  );
}

/** Tiny inline switch used by list rows (kept here so the page stays small). */
export function StatusToggle({ program, onChange, disabled }: { program: AccessProgram; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <Toggle checked={program.status === 'active'} disabled={disabled || program.status === 'closed'} onChange={onChange} label={`${program.name} active`} />;
}
