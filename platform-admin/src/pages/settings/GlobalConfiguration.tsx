import { useCallback, useEffect, useMemo, useState } from 'react';
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import { settingsApi, type PlatformSetting, type SettingValue } from '../../lib/api-settings';
import { useAuth } from '../../contexts/auth-context';
import { useReauth } from '../../components/useReauth';
import { Button } from '../../components/ui/Button';
import { Input, Label } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { SlidersHorizontal, RefreshCw, Pencil, RotateCcw, Lock } from 'lucide-react';

/**
 * Platform → Global configuration.
 *
 * One page for the platform-wide constants: the editable subset (uploads,
 * commerce catalogs, console defaults) is changed one row at a time with a
 * reason and a fresh re-authentication; everything else (schema enums,
 * process limits) is shown read-only with a note. Mobile-first: rows stack.
 */
export default function GlobalConfiguration() {
  const toast = useToast();
  const { user } = useAuth();
  const reauth = useReauth();
  const canWrite = hasScope(user, PLATFORM_SCOPES.FLAGS_WRITE);

  const [rows, setRows] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlatformSetting | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows((await settingsApi.get()).settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const by: Record<string, PlatformSetting[]> = {};
    for (const r of rows) {
      if (!by[r.group]) {
        by[r.group] = [];
        order.push(r.group);
      }
      by[r.group].push(r);
    }
    return order.map((g) => ({ group: g, items: by[g] }));
  }, [rows]);

  const save = async (setting: PlatformSetting, value: SettingValue | null, reason: string) => {
    try {
      await reauth.ensure();
    } catch {
      return; // cancelled — keep the editor open quietly
    }
    const res = await settingsApi.update([{ key: setting.key, value }], reason);
    setRows(res.settings);
    toast.success(value === null ? 'Reset to default' : 'Saved');
    setEditing(null);
  };

  if (loading) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <SlidersHorizontal className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Global configuration</h1>
            <p className="text-sm text-muted-foreground">
              Platform-wide constants in one place. Editable values apply to every store within 30 seconds;
              read-only values are fixed in code or schemas.
              {!canWrite && ' (read-only — you lack the flags.write scope)'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {groups.map(({ group, items }) => (
        <section key={group} className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3 text-sm font-semibold">{group}</div>
          <div className="divide-y">
            {items.map((s) => (
              <div key={s.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{s.label}</span>
                    {!s.editable && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Lock className="h-3 w-3" /> code
                      </Badge>
                    )}
                    {s.overridden && <Badge variant="secondary" className="text-[10px]">overridden</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                  <code className="mt-1 block text-[11px] text-muted-foreground/80">{s.key}</code>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:max-w-[55%] sm:justify-end">
                  <ValueChip value={s.value} type={s.type} />
                  {s.editable && canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(s)} aria-label={`Edit ${s.label}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <EditModal setting={editing} onClose={() => setEditing(null)} onSave={save} />
      {reauth.modal}
    </div>
  );
}

function ValueChip({ value, type }: { value: SettingValue; type: PlatformSetting['type'] }) {
  if (type === 'integer') {
    return <span className="font-mono text-sm tabular-nums">{String(value)}</span>;
  }
  const list = Array.isArray(value) ? value : [];
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {list.map((v) => (
        <Badge key={v} variant="outline" className="font-mono text-[11px]">{v}</Badge>
      ))}
    </div>
  );
}

function EditModal({
  setting,
  onClose,
  onSave,
}: {
  setting: PlatformSetting | null;
  onClose: () => void;
  onSave: (s: PlatformSetting, value: SettingValue | null, reason: string) => Promise<void>;
}) {
  const [numValue, setNumValue] = useState('');
  const [listValue, setListValue] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!setting) return;
    setNumValue(setting.type === 'integer' ? String(setting.value) : '');
    setListValue(setting.type === 'stringList' && Array.isArray(setting.value) ? setting.value : []);
    setReason('');
    setErr(null);
    setBusy(false);
  }, [setting]);

  if (!setting) return null;
  const b = setting.bounds || {};
  const allow = b.allowlist || [];

  const clientValid = (() => {
    if (setting.type === 'integer') {
      const n = Number(numValue);
      return Number.isInteger(n) && (b.min == null || n >= b.min) && (b.max == null || n <= b.max);
    }
    return listValue.length >= (b.min ?? 1) && listValue.every((v) => allow.includes(v));
  })();
  const canSubmit = clientValid && reason.trim().length >= 4 && !busy;

  const submit = async (reset = false) => {
    setBusy(true);
    setErr(null);
    try {
      const value: SettingValue | null = reset ? null : setting.type === 'integer' ? Number(numValue) : listValue;
      await onSave(setting, value, reason.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (code: string) =>
    setListValue((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));

  return (
    <Modal
      open={!!setting}
      onClose={busy ? () => {} : onClose}
      title={setting.label}
      description={setting.description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          {setting.overridden && (
            <Button variant="outline" onClick={() => submit(true)} disabled={reason.trim().length < 4 || busy}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset to default
            </Button>
          )}
          <Button onClick={() => submit(false)} disabled={!canSubmit} loading={busy}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{err}</div>
        )}
        {setting.type === 'integer' ? (
          <div className="space-y-1.5">
            <Label htmlFor="cfg-value">
              Value {b.min != null && b.max != null ? `(${b.min}–${b.max})` : ''}
            </Label>
            <Input
              id="cfg-value"
              type="number"
              inputMode="numeric"
              min={b.min}
              max={b.max}
              value={numValue}
              onChange={(e) => setNumValue(e.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">Default: {String(setting.default)}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Enabled values ({listValue.length} selected, at least {b.min ?? 1})</Label>
            <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto rounded-md border p-2">
              {allow.map((code) => {
                const on = listValue.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={busy}
                    onClick={() => toggle(code)}
                    className={`rounded-full border px-2.5 py-1 font-mono text-xs transition disabled:opacity-50 ${
                      on ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Default: {Array.isArray(setting.default) ? setting.default.join(', ') : ''}
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="cfg-reason">Reason <span className="text-destructive">*</span></Label>
          <Input
            id="cfg-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this changes (recorded in the audit log)"
            disabled={busy}
          />
        </div>
        <p className="text-xs text-muted-foreground">Saving asks you to confirm your identity.</p>
      </div>
    </Modal>
  );
}
